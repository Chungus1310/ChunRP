// Legacy vectra index migration to sqlite-vec storage inside SQLite.
// Safe to run multiple times; will skip if directory or vectra not present.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDataDirectory } from './app-paths.js';
import { insertItem } from './vector-store-sqlite-vec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function migrateLegacyVectra() {
  const dataDir = getDataDirectory();
  const legacyDir = path.join(dataDir, 'memory-vectra');
  if (!fs.existsSync(legacyDir)) {
    return { skipped: true, reason: 'legacy directory missing' };
  }
  let LocalIndex;
  try {
    ({ LocalIndex } = await import('vectra'));
  } catch (e) {
    return { skipped: true, reason: 'vectra package not installed' };
  }
  try {
    const idx = new LocalIndex(legacyDir);
    if (!(await idx.isIndexCreated())) {
      return { skipped: true, reason: 'no vectra index present' };
    }
    const items = await idx.listItems();
    let migrated = 0;
    for (const it of items) {
      const meta = it.metadata || {};
      if (!meta.character || !it.vector) continue;
      await insertItem({ vector: it.vector, metadata: meta });
      migrated++;
    }
    // Remove directory after success
    fs.rmSync(legacyDir, { recursive: true, force: true });
    return { migrated };
  } catch (e) {
    return { error: e.message || String(e) };
  }
}
