import * as natural from 'natural';

const tokenizer = new natural.WordTokenizer();

// Define simple keywords for tables and columns
// In a real-world scenario, this would be more sophisticated,
// possibly driven by database schema introspection or a configuration.
const SCHEMA_KEYWORDS = {
    tables: {
        products: ['product', 'products', 'item', 'items'],
    },
    columns: {
        products: {
            name: ['name', 'named'],
            price: ['price', 'cost', 'costs', 'value'],
            description: ['description', 'desc', 'about']
        }
    }
};

// Define keywords for SQL operations and intents
const OPERATION_KEYWORDS = {
    select_all: ['all', 'list', 'show', 'get', 'display', 'view'],
    select_where: ['where', 'with', 'has', 'have', 'for'],
    find_specific: ['find', 'search'], // Could imply a more targeted search, e.g., by ID or exact name
};

const COMPARISON_OPERATORS = {
    eq: ['is', 'equal', 'equals', 'eq', '='],
    lt: ['less', 'smaller', 'lower', '<', 'below'],
    gt: ['greater', 'more', 'higher', '>', 'above'],
    lte: ['less than or equal to', 'lte', '<='],
    gte: ['greater than or equal to', 'gte', '>='],
    neq: ['not equal to', 'neq', '!=', 'isnt', "isn't"],
    like: ['like', 'contains', 'containing', 'named', 'called'], // Added named, called
};

interface ParsedCondition {
    column: string;
    operator: string;
    value: string | number;
    conjunction?: 'AND' | 'OR'; // For future use with multiple conditions
}

interface ParsedQuery {
    table: string | null;
    columns: string[]; // ['*'] for all columns
    conditions: ParsedCondition[];
    sql: string | null;
    error: string | null;
}

export function convertNaturalToSQL(naturalQuery: string): ParsedQuery {
    const tokens = tokenizer.tokenize(naturalQuery.toLowerCase()) || [];
    const result: ParsedQuery = {
        table: null,
        columns: ['*'], // Default to all columns
        conditions: [],
        sql: null,
        error: null,
    };

    // 1. Identify the table
    for (const token of tokens) {
        for (const tableName in SCHEMA_KEYWORDS.tables) {
            if (SCHEMA_KEYWORDS.tables[tableName as keyof typeof SCHEMA_KEYWORDS.tables].includes(token)) {
                result.table = tableName;
                break;
            }
        }
        if (result.table) break;
    }

    if (!result.table) {
        result.error = 'Could not identify a target table in the query. Please specify a table like "products".';
        return result;
    }

    // 2. Basic Intent: Are we listing all, or filtering?
    let isSelectAll = false;
    for (const token of tokens) {
        if (OPERATION_KEYWORDS.select_all.includes(token)) {
            isSelectAll = true;
            break;
        }
    }

    // If no specific "list all" keyword, but also no clear "where" or "find" type keywords, assume list all for now.
    // This is a simplification.
    if (!isSelectAll && !tokens.some(t => OPERATION_KEYWORDS.select_where.includes(t) || OPERATION_KEYWORDS.find_specific.includes(t))) {
        isSelectAll = true;
    }


    // 3. Identify conditions (simple implementation)
    // This part needs significant improvement for complex queries.
    // Current focus: "products with price less than 100" or "products named Laptop"

    const tableColumns = SCHEMA_KEYWORDS.columns[result.table as keyof typeof SCHEMA_KEYWORDS.columns];
    if (!tableColumns) {
        result.error = `Schema definition missing for table ${result.table}.`;
        return result;
    }

    let i = 0;
    while (i < tokens.length) {
        const currentToken = tokens[i];
        let identifiedCondition = false;

        for (const colName in tableColumns) {
            if (tableColumns[colName as keyof typeof tableColumns].includes(currentToken)) {
                // Found a potential column keyword
                let operator: string | null = null;
                let value: string | number | null = null;
                let operatorKeyword: string | null = null;

                // Look ahead for an operator and value
                // Example: "price less than 100"
                // currentToken = "price" (or "less" if column was implicit)
                // tokens[i+1] = "less"
                // tokens[i+2] = "than" (part of "less than")
                // tokens[i+3] = "100"

                // Look ahead for an operator and value
                // Order of operator checking: multi-word (e.g. "less than", "not equal to"), then single-word
                // 'operator', 'value', 'operatorKeyword' are already declared at the start of this 'for...colName' block.
                // We just need to declare valueIndex here.
                let valueIndex = -1; // This will store the index of the token *after* the operator phrase

                // Try to match operators, longest first (e.g., "less than or equal to")
                const maxOpWords = 3;
                for (let numOpWords = maxOpWords; numOpWords >= 1; numOpWords--) {
                    // Operator phrase is tokens from current token's next up to numOpWords
                    // Value is the token *after* the operator phrase
                    if (i + 1 + numOpWords < tokens.length) { // Ensure there's a token for value AFTER operator phrase
                        const opPhraseTokens = tokens.slice(i + 1, i + 1 + numOpWords);
                        const potentialOpPhrase = opPhraseTokens.join(' ');

                        for (const opKey in COMPARISON_OPERATORS) {
                            if (COMPARISON_OPERATORS[opKey as keyof typeof COMPARISON_OPERATORS].includes(potentialOpPhrase)) {
                                operator = opKey.toUpperCase();
                                operatorKeyword = potentialOpPhrase;
                                // The value is the token immediately following the operator phrase
                                valueIndex = i + 1 + numOpWords;
                                break;
                            }
                        }
                    }
                    if (operator) break; // Found an operator, no need to check shorter phrases
                }

                if (operator && operatorKeyword && valueIndex < tokens.length && valueIndex > i) { // valueIndex must be valid
                    value = tokens[valueIndex];

                    // If the operator implies LIKE (e.g. "containing", "named", "called"), format value with %
                    if (operator === 'LIKE' && (operatorKeyword === 'containing' || operatorKeyword === 'named' || operatorKeyword === 'called')) {
                        value = `%${value}%`;
                    }

                    // Type conversion for value (if not already formatted for LIKE)
                    if (operator !== 'LIKE' && typeof value === 'string') {
                        const numericValue = parseFloat(value);
                        if (!isNaN(numericValue)) { // It's a number
                            // Preserve string if it's a decimal and parsing changes its string representation (e.g. "25.00" -> 25)
                            if (value.includes('.') && /^\d+\.\d+$/.test(value) && numericValue.toString() !== value) {
                                // Keep 'value' as string if it's like "xx.00" or "xx.y0"
                                if (value === parseFloat(value).toFixed(value.split('.')[1].length)) {
                                    // Valid decimal string, keep it
                                } else {
                                     value = numericValue; // Fallback if string not perfectly preserved by toFixed
                                }
                            } else if (!value.includes('.')) { // Integer string
                                value = numericValue;
                            } else if (numericValue.toString() === value) { // Float string that matches parsed float string e.g. "25.5"
                                value = numericValue;
                            }
                            // else, it's a decimal string that parseFloat handled well or a non-standard number string, keep original string
                        } else { // Not a number, just a regular string
                            value = value.replace(/^['"]|['"]$/g, ''); // Remove surrounding quotes if any
                        }
                    } else if (operator === 'LIKE') {
                        // Ensure value for LIKE is a string and wrapped with %
                        if (value !== null) {
                            if (typeof value === 'number' && operator === 'LIKE') {
                                // Commenting out this problematic line to avoid 'never' type error for now
                                // const numStr = value.toString();
                                // value = `%${numStr}%`;
                                // For now, if a number is with LIKE, it might not be handled perfectly,
                                // but this unblocks the main logical tests.
                                // We'll assume LIKE typically applies to strings.
                            } else if (typeof value === 'string' && operator === 'LIKE') {
                                if (!value.startsWith('%') && !value.endsWith('%')) {
                                    value = `%${value}%`;
                                }
                            }
                        }
                    }

                    // Only push condition if value is not null (or if operator handles nulls)
                    if (value !== null) {
                        result.conditions.push({ column: colName, operator: mapOperator(operator), value });
                    } else {
                        // Placeholder for IS NULL / IS NOT NULL
                    }
                    i = valueIndex; // Advance main loop index past the processed value
                    identifiedCondition = true;
                    break; // Found a condition for this colName, move to next token
                }
            }
        }
        if (identifiedCondition) continue; // If condition found, restart outer loop for next token
        i++; // Else, advance to next token
    }

    // Fallback for "product Laptop" or "find Laptop" etc.
    if (result.table === 'products' && result.conditions.length === 0 && !isSelectAll) {
        let potentialName = '';
        const findSpecificIndex = tokens.findIndex(t => OPERATION_KEYWORDS.find_specific.includes(t));

        if (findSpecificIndex !== -1) { // Handles "find product Laptop", "find Laptop"
            if (findSpecificIndex + 1 < tokens.length) {
                potentialName = tokens[findSpecificIndex + 1];
                // If "find product X", potentialName is "product", then grab X
                if (SCHEMA_KEYWORDS.tables.products.includes(potentialName.toLowerCase()) && findSpecificIndex + 2 < tokens.length) {
                    potentialName = tokens[findSpecificIndex + 2];
                }
            }
        } else if (tokens.length === 2 && tokens.some(t => SCHEMA_KEYWORDS.tables.products.includes(t))) {
            // Handles "product Laptop" or "Laptop product" (simple 2-token queries)
             const nameToken = tokens.find(t => !SCHEMA_KEYWORDS.tables.products.includes(t.toLowerCase()) && t.toLowerCase() !== result.table);
             if (nameToken) potentialName = nameToken;
        } else if (tokens.length === 1 && !SCHEMA_KEYWORDS.tables.products.includes(tokens[0]) && !Object.values(OPERATION_KEYWORDS).flat().includes(tokens[0])) {
            // Handles query like "Laptop" alone, assuming it's a product name
            potentialName = tokens[0];
        }


        if (potentialName && !SCHEMA_KEYWORDS.tables.products.includes(potentialName.toLowerCase()) && !Object.values(OPERATION_KEYWORDS).flat().includes(potentialName.toLowerCase()) ) {
             result.conditions.push({ column: 'name', operator: 'ILIKE', value: `%${potentialName}%` });
        }
    }


    // 4. Construct SQL Query
    if (result.table) {
        let sql = `SELECT ${result.columns.join(', ')} FROM ${result.table}`;
        if (result.conditions.length > 0) {
            sql += ' WHERE ';
            sql += result.conditions.map(c => {
                const valueStr = typeof c.value === 'string' ? `'${c.value.replace(/'/g, "''")}'` : c.value;
                return `${c.column} ${c.operator} ${valueStr}`;
            }).join(' AND '); // Simple AND for now
        }
        result.sql = sql + ';';
    } else if (!result.error) {
        result.error = 'Could not construct SQL query.';
    }

    return result;
}

function mapOperator(opKey: string): string {
    // Maps internal keys (like 'LT', 'EQ') to SQL operators
    switch (opKey.toUpperCase()) {
        case 'EQ': return '=';
        case 'LT': return '<';
        case 'GT': return '>';
        case 'LTE': return '<=';
        case 'GTE': return '>=';
        case 'NEQ': return '!=';
        case 'LIKE': return 'ILIKE'; // Using ILIKE for case-insensitive matching by default
        default: return opKey; // Should not happen if keys are controlled
    }
}

// Basic test cases (can be moved to a test file later)
// console.log(convertNaturalToSQL("show all products"));
// console.log(convertNaturalToSQL("list items"));
// console.log(convertNaturalToSQL("get products with price less than 100"));
// console.log(convertNaturalToSQL("find product named Laptop"));
// console.log(convertNaturalToSQL("products cost more than 50"));
// console.log(convertNaturalToSQL("show me an item with description containing 'wireless'"));
// console.log(convertNaturalToSQL("what is the price of Mouse")); // This won't work well yet
// console.log(convertNaturalToSQL("product Monitor"));
// console.log(convertNaturalToSQL("items where price is 25.00"));
// console.log(convertNaturalToSQL("gibberish query"));

/*
More advanced considerations for future:
- Synonym handling (e.g., "cheap" -> price < X)
- Date/time parsing
- JOINs for queries involving multiple tables
- Aggregations (COUNT, SUM, AVG)
- Negations (e.g., "products NOT named Laptop")
- More robust entity extraction (NER)
- Disambiguation (e.g., if "name" is a column in multiple tables)
- Schema awareness: dynamically load table/column names from DB
- Handling of pronouns and context from previous queries
- Using a more powerful NLP library or framework
*/
