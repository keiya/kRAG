import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "langchain/document";
import { ChromaClient } from 'chromadb';
import { splitTextIntoSentences, createChunks, removeUnwantedCharacters } from '../utils/textProcessing';
import { readTextFiles } from '../utils/fileOperations';

const COLLECTION_NAME = "novel_chapters";
const CHROMA_URL = "http://localhost:8000";

async function cleanupChromaDB() {
  const client = new ChromaClient({
    path: CHROMA_URL,
  });

  try {
    await client.deleteCollection({ name: COLLECTION_NAME });
    console.log(`Deleted existing collection: ${COLLECTION_NAME}`);
  } catch (error) {
    console.log(`No existing collection found: ${COLLECTION_NAME}`);
  }
}

export async function vectorizeNovelChapters(directoryPath: string) {
  // クリーンアップを実行
  await cleanupChromaDB();

  let allText = await readTextFiles(directoryPath);

  allText = removeUnwantedCharacters(allText);

  const sentences = splitTextIntoSentences(allText);

  const chunkSize = 1000;
  const chunks = createChunks(sentences, chunkSize);

  const documents = chunks.map(chunk => new Document({ pageContent: chunk }));

  const embeddings = new OpenAIEmbeddings(
    {
      verbose: true,
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: "text-embedding-3-large", // Use the desired model
    }
  );

  // ChromaClientを使用して新しいコレクションを作成
  const client = new ChromaClient({
    path: CHROMA_URL,
  });

  await client.createCollection({
    name: COLLECTION_NAME,
    metadata: { "hnsw:space": "cosine" },
  });

  const vectorStore = await Chroma.fromDocuments(documents, embeddings, {
    collectionName: COLLECTION_NAME,
    url: CHROMA_URL,
  });

  console.log("Vectorization complete!");
  return vectorStore;
}
