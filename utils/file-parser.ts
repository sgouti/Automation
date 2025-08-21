import fs from 'fs';
import pdf from 'pdf-parse';
import { parse } from 'csv-parse/sync';

export async function parsePdf(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdf(dataBuffer);
  return data.text;
}

export function parseCsv(filePath:string): any[] {
    const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
    const records = parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });
    return records;
}
