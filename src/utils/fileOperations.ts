import * as fs from 'fs';
import * as path from 'path';
import { TextLoader } from "langchain/document_loaders/fs/text";

export async function readTextFiles(directoryPath: string): Promise<string> {
  const files = fs.readdirSync(directoryPath).filter(file => file.endsWith('.txt'));
  let allText = '';

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const loader = new TextLoader(filePath);
    const docs = await loader.load();
    allText += docs[0].pageContent;
  }

  return allText;
}
