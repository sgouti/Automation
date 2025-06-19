import * as http from 'http';
import * as url from 'url';
import { StringDecoder } from 'string_decoder';
import { Pool } from 'pg';
import { convertNaturalToSQL } from './nlp_to_sql'; // Import the new module

// Database connection pool
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'postgres',
  password: 'mysecretpassword',
  port: 5432,
});

interface QueryParams {
  query?: string;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url || '', true);
  const path = parsedUrl.pathname;
  const trimmedPath = path?.replace(/^\/+|\/+$/g, '');

  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'POST' && trimmedPath === 'query') {
    const decoder = new StringDecoder('utf-8');
    let buffer = '';
    req.on('data', (data) => {
      buffer += decoder.write(data);
    });
    req.on('end', async () => {
      buffer += decoder.end();
      let requestBody: QueryParams = {};
      try {
        if (buffer) {
          requestBody = JSON.parse(buffer);
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
        return;
      }

      const naturalQuery = requestBody.query;

      if (!naturalQuery) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Missing "query" field in request body' }));
        return;
      }

      const nlpResult = convertNaturalToSQL(naturalQuery);

      if (nlpResult.error || !nlpResult.sql) {
        res.writeHead(400);
        res.end(JSON.stringify({
            error: 'Could not understand or convert the query.',
            details: nlpResult.error,
            originalQuery: naturalQuery
        }));
        return;
      }

      const sqlQuery = nlpResult.sql;

      try {
        console.log(`Executing SQL: ${sqlQuery}`);
        const dbResponse = await pool.query(sqlQuery);
        res.writeHead(200);
        res.end(JSON.stringify({
            query: naturalQuery,
            sql: sqlQuery,
            parsedTokens: nlpResult, // Include parsed info for debugging/transparency
            results: dbResponse.rows
        }));
      } catch (dbError: any) {
        console.error('Database error:', dbError);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Error executing query against the database', details: dbError.message }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not Found' }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  console.log('Available endpoint: POST /query');
  console.log('Example usage: curl -X POST -H "Content-Type: application/json" -d \'{"query": "show all products"}\' http://localhost:3000/query');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  console.log('Database pool closed.');
  server.close(() => {
    console.log('Server shut down.');
    process.exit(0);
  });
});
