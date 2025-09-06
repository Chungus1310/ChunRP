// Utility script to dump current SQLite database schema and sample rows.
// Usage: node dump-db.js
// Optionally set SAMPLE_LIMIT env var to change sample size.
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join('data','chunrp.db');
if (!fs.existsSync(DB_PATH)) {
  console.error('Database file not found at', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);
const SAMPLE_LIMIT = parseInt(process.env.SAMPLE_LIMIT || '5');

function dumpTableInfo(table) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    if (info.length === 0) {
      console.log(`Table ${table} does not exist.`);
      return;
    }
    console.log(`\n=== Table: ${table} ===`);
    console.table(info.map(c => ({ cid: c.cid, name: c.name, type: c.type, notnull: !!c.notnull, dflt: c.dflt_value, pk: !!c.pk })));
    let rowCount = 0;
    try { rowCount = db.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).get().cnt; } catch {}
    console.log(`Row count: ${rowCount}`);
    if (rowCount > 0) {
      let rows = [];
      try { rows = db.prepare(`SELECT * FROM ${table} LIMIT ${SAMPLE_LIMIT}`).all(); } catch {}
      if (rows.length) {
        console.log(`Sample (${rows.length} rows):`);
        for (const r of rows) {
          // Truncate large blobs / embeddings
            const clone = { ...r };
            if (clone.embedding && clone.embedding instanceof Buffer) {
              clone.embedding = `<BLOB ${clone.embedding.length} bytes>`;
            }
            if (clone.data && typeof clone.data === 'string') {
              // shorten long JSON
              if (clone.data.length > 200) clone.data = clone.data.slice(0,200)+'…';
            }
            if (clone.metadata && typeof clone.metadata === 'string' && clone.metadata.length > 200) {
              clone.metadata = clone.metadata.slice(0,200)+'…';
            }
            console.dir(clone, { depth: 3 });
        }
      }
    }
  } catch (e) {
    console.warn('Error dumping table', table, e.message);
  }
}

console.log('SQLite database dump for ChunRP');
const tables = ['settings','characters','character_relationships','chat_messages','memories'];
for (const t of tables) dumpTableInfo(t);

// Extra: show sqlite-vec virtual table status
try {
  const vecInfo = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name LIKE '%memories_vec%'").all();
  if (vecInfo.length) {
    console.log('\nVirtual vector tables:');
    console.table(vecInfo.map(v => ({ name: v.name, sql: v.sql?.slice(0,120)+'…' })));
  } else {
    console.log('\nNo sqlite-vec virtual table present (fallback cosine mode likely in use).');
  }
} catch {}

console.log('\nDone.');
