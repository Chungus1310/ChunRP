// sqlite-vec backed vector store replacing legacy vectra-wrapper.
// Maintains API parity with vectra-wrapper functions used by memory-system:
//   ensureIndex(), insertItem({ vector, metadata }), queryItems(vector, k), deleteItemsByCharacter(characterName)
// Data is stored in a single SQLite database (better-sqlite3) inside two tables:
//   memories (rowid PK) -> metadata JSON + embedding BLOB (Float32Array)
//   memories_vec (sqlite-vec virtual table) -> embedding float[DIM] for KNN (DIM discovered lazily on first insert)
// If sqlite-vec extension or virtual table is unavailable, falls back to brute-force cosine scoring across memories.

import { getDatabase } from './database.js';
import * as sqliteVec from 'sqlite-vec';

const VEC_TABLE = 'memories_vec';
let vecLoaded = false;

function loadVec(db) {
  if (vecLoaded) return;
  try {
    sqliteVec.load(db);
    vecLoaded = true;
  } catch (e) {
    // Extension not available – fallback path will be used.
    console.warn('sqlite-vec load skipped / failed (fallback to brute-force):', e.message || e);
  }
}

function ensureBaseTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS memories (
    id TEXT,
    character TEXT,
    summary TEXT,
    timestamp INTEGER NOT NULL,
    importance REAL,
    data TEXT,              -- full metadata JSON
    embedding BLOB NOT NULL -- Float32Array bytes
  );
  `);
  // Self-heal legacy variants missing columns.
  try {
    const info = db.prepare("PRAGMA table_info(memories)").all();
    const colNames = new Set(info.map(c => c.name));
    const addColumn = (name, ddl, post = null) => {
      try {
        db.exec(ddl);
        console.log(`[memories] Added missing column: ${name}`);
        if (post) post();
      } catch (e) {
        if (!/duplicate column/i.test(e.message)) {
          console.warn(`[memories] Failed adding column ${name}:`, e.message || e);
        }
      }
    };
    if (!colNames.has('character')) addColumn('character', 'ALTER TABLE memories ADD COLUMN character TEXT');
    if (!colNames.has('summary')) addColumn('summary', 'ALTER TABLE memories ADD COLUMN summary TEXT');
    if (!colNames.has('timestamp')) {
      addColumn('timestamp', 'ALTER TABLE memories ADD COLUMN timestamp INTEGER', () => {
        // Prefer existing created_at if present
        if (colNames.has('created_at')) {
          try { db.exec('UPDATE memories SET timestamp = created_at WHERE timestamp IS NULL'); } catch {}
        } else {
          try { db.exec("UPDATE memories SET timestamp = CAST(strftime('%s','now')*1000 AS INTEGER) WHERE timestamp IS NULL"); } catch {}
        }
      });
    }
    if (!colNames.has('importance')) addColumn('importance', 'ALTER TABLE memories ADD COLUMN importance REAL');
    if (!colNames.has('data')) addColumn('data', 'ALTER TABLE memories ADD COLUMN data TEXT');
    // embedding column cannot be simply added meaningfully if missing; skip (would indicate severe legacy mismatch)
  } catch (e) {
    console.warn('Could not verify/add columns on memories:', e.message || e);
  }
  // Ensure index if column exists
  try { db.exec('CREATE INDEX IF NOT EXISTS idx_memories_character ON memories(character)'); } catch {}
}

function tableExists(db, name) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);
}

function createVecTableIfMissing(db, dim) {
  if (!Number.isInteger(dim) || dim <= 0) throw new Error('Invalid embedding dimension for vec table');
  if (tableExists(db, VEC_TABLE)) return;
  db.exec(`CREATE VIRTUAL TABLE ${VEC_TABLE} USING vec0(embedding float[${dim}])`);
}

// Public: ensureIndex (kept name for compatibility)
export async function ensureIndex() {
  const db = getDatabase();
  ensureBaseTables(db);
  loadVec(db); // best-effort
  return true;
}

// Insert a vector + metadata. Metadata object matches previous usage (includes character, summary, importance etc.)
export async function insertItem({ vector, metadata }) {
  if (!Array.isArray(vector) || vector.length === 0) return null;
  if (!metadata || typeof metadata !== 'object') metadata = {};
  const db = getDatabase();
  ensureBaseTables(db);

  const float = vector instanceof Float32Array ? vector : new Float32Array(vector);
  const blob = Buffer.from(float.buffer);

  // Detect legacy column character_name (NOT NULL) – if it exists, populate both for compatibility.
  let hasCharacterName = false;
  try {
    const cols = db.prepare("PRAGMA table_info(memories)").all();
    hasCharacterName = cols.some(c => c.name === 'character_name');
  } catch {}

  let info;
  if (hasCharacterName) {
    const insert = db.prepare(`INSERT INTO memories (id, character_name, character, summary, timestamp, importance, data, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const characterVal = metadata.character || 'unknown';
    info = insert.run(
      metadata.id || null,
      characterVal,
      characterVal,
      metadata.summary || '',
      metadata.timestamp || Date.now(),
      typeof metadata.importance === 'number' ? metadata.importance : null,
      JSON.stringify(metadata),
      blob
    );
  } else {
    const insert = db.prepare(`INSERT INTO memories (id, character, summary, timestamp, importance, data, embedding)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
    info = insert.run(
      metadata.id || null,
      metadata.character || 'unknown',
      metadata.summary || '',
      metadata.timestamp || Date.now(),
      typeof metadata.importance === 'number' ? metadata.importance : null,
      JSON.stringify(metadata),
      blob
    );
  }
  const rowid = Number(info.lastInsertRowid);

  // Try to add to vector index (safe failures)
  try {
    loadVec(db);
    if (vecLoaded) {
      createVecTableIfMissing(db, float.length);
      db.prepare(`INSERT INTO ${VEC_TABLE}(rowid, embedding) VALUES (?, ? )`).run(rowid, blob);
    }
  } catch (e) {
    // ignore
  }
  return rowid;
}

function cosineDistance(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i];
    const bv = b[i];
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  return 1 - (dot / denom);
}

// Query top-k similar vectors. Returns array like vectra: [{ item: { metadata }, score }]
export async function queryItems(queryVector, k = 5) {
  const db = getDatabase();
  ensureBaseTables(db);
  if (!Array.isArray(queryVector) || queryVector.length === 0) return [];
  const floatQ = queryVector instanceof Float32Array ? queryVector : new Float32Array(queryVector);
  const blobQ = Buffer.from(floatQ.buffer);

  // Fast path via sqlite-vec
  try {
    loadVec(db);
    if (vecLoaded && tableExists(db, VEC_TABLE)) {
      const stmt = db.prepare(`WITH nn AS (
          SELECT rowid, distance
          FROM ${VEC_TABLE}
          WHERE embedding MATCH ?
          ORDER BY distance
          LIMIT ?
        )
        SELECT m.rowid, m.data, nn.distance AS distance
        FROM nn JOIN memories m ON m.rowid = nn.rowid
        ORDER BY nn.distance
        LIMIT ?`);
      const rows = stmt.all(blobQ, k, k);
      return rows.map(r => ({
        item: { metadata: JSON.parse(r.data) },
        score: r.distance
      }));
    }
  } catch (e) {
    // fallback
  }

  // Brute-force fallback
  const rows = db.prepare('SELECT rowid, data, embedding FROM memories').all();
  const scored = [];
  for (const r of rows) {
    const emb = new Float32Array(Buffer.from(r.embedding).buffer);
    if (emb.length !== floatQ.length) continue; // skip dimension mismatch
    const dist = cosineDistance(floatQ, emb);
    scored.push({ item: { metadata: JSON.parse(r.data) }, score: dist });
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.slice(0, k);
}

export async function deleteItemsByCharacter(characterName) {
  const db = getDatabase();
  ensureBaseTables(db);
  let rows = [];
  try {
    rows = db.prepare('SELECT rowid FROM memories WHERE character = ?').all(characterName);
  } catch (e) {
    // Column might still be missing in some edge case - fallback: scan metadata JSON
    console.warn('Fallback deletion path (no character column):', e.message || e);
    rows = db.prepare('SELECT rowid, data FROM memories').all()
      .filter(r => {
        try { return JSON.parse(r.data).character === characterName; } catch { return false; }
      })
      .map(r => ({ rowid: r.rowid }));
  }
  const rowids = rows.map(r => r.rowid);
  const delMem = db.prepare('DELETE FROM memories WHERE rowid = ?');
  const delVec = vecLoaded && tableExists(db, VEC_TABLE)
    ? db.prepare(`DELETE FROM ${VEC_TABLE} WHERE rowid = ?`) : null;
  const tx = db.transaction(() => {
    for (const id of rowids) {
      delMem.run(id);
      if (delVec) try { delVec.run(id); } catch {}
    }
  });
  tx();
  return rowids.length;
}
