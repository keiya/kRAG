import * as fs from 'fs';
import * as path from 'path';
import { TextLoader } from "langchain/document_loaders/fs/text";

export async function readTextFiles(directoryPath: string): Promise<Array<{ content: string, filename: string }>> {
  const files = fs.readdirSync(directoryPath).filter(file => file.endsWith('.txt'));
  const results = [];

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const loader = new TextLoader(filePath);
    const docs = await loader.load();
    results.push({
      content: docs[0].pageContent,
      filename: file
    });
  }

  return results;
}
