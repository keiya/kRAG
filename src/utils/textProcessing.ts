export function splitTextIntoSentences(text: string): string[] {
  return text.match(/[^。]*。?/g)?.filter(Boolean) || [];
}

export function createChunks(sentences: string[], chunkSize: number): string[] {
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize) {
      chunks.push(currentChunk);
      currentChunk = sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

export function removeUnwantedCharacters(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F6FF}]/gu, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}]/gu, '')
    .replace(/\s+/g, ' ');
}
