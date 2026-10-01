
import type { CodeChunk } from "@/features/reviews/types/review";
import { getPineconeIndex } from "@/features/pinecone/client";
import { Pinecone } from '@pinecone-database/pinecone'
import { metadata } from "@/app/layout";

const pc = new Pinecone({ apiKey: 'PINECONE_API_KEY' });

export interface codechunk {
  id: string,
  text: string,
  filepath: string,
}

const CONTEXT_RESULTS = 10;


export function buildPrNamespace(repoFullName: string, prNumber: number) {
  return `${repoFullName.replace("/", "--")}--pr-${prNumber}`;
}

export async function setupSparseIndex() {
  const indexName = 'integrated-sparse-js';

  await pc.createIndexForModel({
    name: indexName,
    cloud: 'aws',
    region: 'us-east-1',
    embed: {
      model: 'pinecone-sparse-english-v0', // The learned sparse model
      fieldMap: {
        text: 'chunk_text' // Tells Pinecone which field in your records to look at for embedding
      },
    },
    waitUntilReady: true,
  });
}

export async function saveChunksToPinecone(
  namespace: string,
  chunks: CodeChunk[]
) {
  const index = pc.index("integrated-sparse-js'");


  const records = chunks.map((chunk) => ({
    id: chunk.id,
    text: chunk.text,
    filePath: chunk.filePath,
    
  }))

  await index.namespace(namespace).upsertRecords({ records });
}


export async function searchPrContext(namespace: string, query: string) {
   const index = pc.index("integrated-sparse-js'");

  const response = await index.namespace(namespace).searchRecords({
    query: { topK: CONTEXT_RESULTS, inputs: { text: query } },
  });

  const snippets: string[] = [];

  for (const hit of response.result.hits) {
    const fields = hit.fields as { text?: string; filePath?: string };
    if (!fields.text) {
      continue;
    }

    snippets.push(`File: ${fields.filePath}\n${fields.text}`);
  }

  return snippets;
}
