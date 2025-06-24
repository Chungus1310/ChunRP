// Wrapper to migrate LanceDB usage to vectra
import { LocalIndex } from 'vectra';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getMemoryStoragePath } from './app-paths.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_DIR = getMemoryStoragePath();
if (!fs.existsSync(INDEX_DIR)) {
  fs.mkdirSync(INDEX_DIR, { recursive: true });
}

const index = new LocalIndex(INDEX_DIR);

export async function ensureIndex() {
  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }
  return index;
}

export async function insertItem({ vector, metadata }) {
  await ensureIndex();
  return index.insertItem({ vector, metadata });
}

export async function queryItems(vector, k = 5) {
  await ensureIndex();
  return index.queryItems(vector, k);
}

export async function deleteItemsByCharacter(characterName) {
  try {
    await ensureIndex();
    // Get all items from the index
    const items = await index.listItems();
    
    // Filter items that belong to the specified character
    const itemsToDelete = items.filter(item => 
      item.metadata && item.metadata.character === characterName
    );
    
    // Delete each item
    for (const item of itemsToDelete) {
      await index.deleteItem(item.id);
    }
    
    console.log(`Deleted ${itemsToDelete.length} memory items for character: ${characterName}`);
    return itemsToDelete.length;
  } catch (error) {
    console.error(`Error deleting memory items for character ${characterName}:`, error);
    return 0;
  }
}

export default index;
