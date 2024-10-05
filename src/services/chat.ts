import { OpenAIEmbeddings } from "@langchain/openai";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import * as readline from 'readline';
import { ChromaClient } from 'chromadb';
import { BufferMemory } from "langchain/memory";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

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
    streaming: true, // ストリーミングを有効化
  });

  console.log("Initializing memory...");
  const memory = new BufferMemory();

  console.log("Creating retrieval chain...");
  const prompt = ChatPromptTemplate.fromTemplate(`
    You are a specialized assistant for novelists, focusing on ensuring narrative coherence and character consistency. Response in 日本語.

    When interacting with the user, consider the following context and chat history to provide insightful feedback and suggestions.
    Context is arranged in the order of appearance in the novel. It is important to consider the relationships and foreshadowing before and after:
    Context: {context}
    Chat History: {chat_history}

    Human: {input}
    Assistant: 
  `);

  const chain = RunnableSequence.from([
    {
      input: (input: string) => input,
      chat_history: async () => await memory.loadMemoryVariables({}).then(vars => vars.history),
      context: async (input: string) => {
        const results = await vectorStore.similaritySearchWithScore(input, 10);
        
        // ファイル名とチャンクインデックスでソート
        results.sort((a, b) => {
          const aMetadata = a[0].metadata;
          const bMetadata = b[0].metadata;
          if (aMetadata.filename !== bMetadata.filename) {
            return aMetadata.filename.localeCompare(bMetadata.filename);
          }
          return aMetadata.chunkIndex - bMetadata.chunkIndex;
        });

        // デバッグ用のメタデータと類似度スコアの出力（ソート後）
        results.forEach(([doc, score], index) => {
          console.log(`Debug - Document ${index + 1}:`);
          console.log(`  Content: ${doc.pageContent.substring(0, 50)}...`);
          console.log(`  Metadata:`, doc.metadata);
          console.log(`  Similarity Score: ${score}`);
        });

        // ソートされた結果からコンテキストを生成
        return results.map(([doc, _]) => doc.pageContent).join("\n");
      },
    },
    prompt,
    model,
    new StringOutputParser(),
  ]);

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
        console.log("AI: ");
        const stream = await chain.stream(input);
        let fullResponse = "";

        for await (const chunk of stream) {
          process.stdout.write(chunk);
          fullResponse += chunk;
        }
        console.log("\n");

        // Store the interaction in memory
        await memory.saveContext(
          { input: input },
          { output: fullResponse }
        );
      } catch (error) {
        console.error("Error during query:", error);
      }

      askQuestion();
    });
  };

  askQuestion();
}
