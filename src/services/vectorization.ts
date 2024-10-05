import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "langchain/document";
import { ChromaClient } from 'chromadb';
import { splitTextIntoSentences, createChunks, removeUnwantedCharacters } from '../utils/textProcessing';
import { readTextFiles } from '../utils/fileOperations';

export async function vectorizeNovelChapters(directoryPath: string) {
  let allText = await readTextFiles(directoryPath);

  allText = removeUnwantedCharacters(allText);

  const sentences = splitTextIntoSentences(allText);

  const chunkSize = 1000;
  const chunks = createChunks(sentences, chunkSize);

  const documents = chunks.map(chunk => new Document({ pageContent: chunk }));

  const client = new ChromaClient({
    path: "http://localhost:8000",
  });

  const embeddings = new OpenAIEmbeddings(
    {
      verbose: true,
      openAIApiKey: process.env.OPENAI_API_KEY,
    }
  );
  const vectorStore = await Chroma.fromDocuments(documents, embeddings, {
    collectionName: "novel_chapters",
    url: "http://localhost:8000",
    collectionMetadata: {
      "hnsw:space": "cosine",
    },
  });

  console.log("Vectorization complete!");
  return vectorStore;
}
