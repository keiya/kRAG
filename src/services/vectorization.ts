import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Document } from "@langchain/core/documents";
import { ChromaClient } from 'chromadb';
import { splitTextIntoSentences, createChunks, removeUnwantedCharacters } from '../utils/textProcessing';
import { readTextFiles } from '../utils/fileOperations';
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";

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
  await cleanupChromaDB();

  const fileContents = await readTextFiles(directoryPath);
  const documents: Document[] = [];
  let previousSummaries = "";

  const chat = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
  });

  const summaryPrompt = PromptTemplate.fromTemplate(
    "前の部分までの内容の要約と、この部分の内容を利用し、1000文字程度でこの部分の内容を要約してください。この部分の要約だけを出力してください。\n\n" +
    "前の部分までの要約:\n{previousSummaries}\n\n" +
    "この部分:\n{chapterContent}\n\n" +
    "要約:"
  );

  for (const [index, { content, filename }] of fileContents.entries()) {
    console.log(`Processing chapter ${index + 1} of ${fileContents.length}`);
    const cleanedText = removeUnwantedCharacters(content);
    
    // Generate summary for the chapter
    const summaryChain = summaryPrompt.pipe(chat);
    const summary = await summaryChain.invoke({
      previousSummaries,
      chapterContent: cleanedText,
    });

    console.log(`Summary: ${summary.content}`);

    // Add summary to previous summaries
    previousSummaries += `Chapter ${index + 1}: ${summary.content}\n\n`;

    // Create documents for the full chapter content
    const sentences = splitTextIntoSentences(cleanedText);
    const chunkSize = 1000;
    const chunks = createChunks(sentences, chunkSize);

    chunks.forEach((chunk, chunkIndex) => {
      documents.push(
        new Document({
          pageContent: chunk,
          metadata: {
            filename,
            chunkIndex,
            type: "full_content"
          }
        })
      );
    });

    // Add the chapter summary as a separate document
    documents.push(
      new Document({
        pageContent: typeof summary.content === 'string' ? summary.content : JSON.stringify(summary.content),
        metadata: {
          filename,
          chunkIndex: index,
          type: "summary"
        }
      })
    );
  }

  const embeddings = new OpenAIEmbeddings(
    {
      verbose: true,
      openAIApiKey: process.env.OPENAI_API_KEY,
      model: "text-embedding-3-large",
    }
  );

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
