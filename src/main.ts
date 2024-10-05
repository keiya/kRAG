#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { vectorizeNovelChapters } from './services/vectorization';
import { chatWithNovel } from './services/chat';

dotenv.config();

const program = new Command();

program
  .name('krag')
  .description('CLI to vectorize novels and chat with them using RAG')
  .version('1.0.0');

program
  .command('vectorize')
  .alias('-v')
  .description('Vectorize and save a novel')
  .argument('<directory>', 'Path to the directory containing novel text files')
  .option('--no-cleanup', 'Skip cleanup of existing data')
  .action(async (directory, options) => {
    try {
      if (options.cleanup) {
        console.log("Cleaning up existing data...");
        // クリーンアップ関数を呼び出す（vectorizeNovelChapters内で実行されるため、ここでは不要）
      }
      await vectorizeNovelChapters(directory);
      console.log("Vectorization completed successfully.");
    } catch (error) {
      console.error("An error occurred during vectorization:", error);
    }
  });

program
  .command('chat')
  .alias('-c')
  .description('Chat with a vectorized novel using RAG')
  .argument('<directory>', 'Path to the directory containing novel text files')
  .action(async (directory) => {
    try {
      await chatWithNovel(directory);
    } catch (error) {
      console.error("An error occurred during chat:", error);
    }
  });

// コマンドライン引数を解析
program.parse();

// 引数がない場合はヘルプを表示
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
