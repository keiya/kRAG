import dotenv from 'dotenv';
import { vectorizeNovelChapters } from './services/vectorization';

dotenv.config();

const chaptersDirectory = "/Users/dux/Documents/novel/part";
vectorizeNovelChapters(chaptersDirectory).then(() => {
  console.log("Process completed.");
}).catch((error) => {
  console.error("An error occurred:", error);
});
