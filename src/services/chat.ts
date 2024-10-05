import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatOpenAI } from "@langchain/openai";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as readline from 'readline';
import { ChromaClient } from 'chromadb';

const COLLECTION_NAME = "novel_chapters";
const CHROMA_URL = "http://localhost:8000";

export async function chatWithNovel(directoryPath: string) {
  console.log("Initializing chat...");

  const client = new ChromaClient({
    path: CHROMA_URL,
  });

  try {
    const collections = await client.listCollections();
    console.log("Available collections:", collections);

    if (!collections.some(c => c.name === COLLECTION_NAME)) {
      console.error(`Collection "${COLLECTION_NAME}" not found. Please vectorize the novel first.`);
      return;
    }
  } catch (error) {
    console.error("Error connecting to ChromaDB:", error);
    return;
  }

  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-large", // Use the desired model
  });

  console.log("Creating vector store...");
  const vectorStore = await Chroma.fromExistingCollection(embeddings, {
    collectionName: COLLECTION_NAME,
    url: CHROMA_URL,
  });

  console.log("Initializing ChatOpenAI model...");
  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  console.log("Creating retrieval chain...");
  const prompt = ChatPromptTemplate.fromTemplate(`
    Answer the question based on the following context:
    {context}

    Question: {input}
  `);

  const combineDocsChain = await createStuffDocumentsChain({
    llm: model,
    prompt,
  });

  const chain = await createRetrievalChain({
    combineDocsChain,
    retriever: vectorStore.asRetriever(),
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log("Chat with the novel. Type 'exit' to quit.");

  const askQuestion = () => {
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === 'exit') {
        rl.close();
        return;
      }

      try {
        console.log("Querying the chain...");
        const response = await chain.invoke({ input });
        console.log("AI:", response.answer);
      } catch (error) {
        console.error("Error during query:", error);
      }

      askQuestion();
    });
  };

  askQuestion();
}
