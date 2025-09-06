// Turso/libSQL optional sync (remote-only push/pull with robust conflict resolution)
// ----------------------------------------------------------------------------------
// Previous approach used embedded replica (file:local.db + syncUrl) which failed in
// some environments (missing wal_index). We now maintain the authoritative local
// better-sqlite3 DB and use an @libsql/client remote connection ONLY for:
//   1. Bootstrap pull (if local empty & remote has data)
//   2. Bidirectional sync with timestamp-based conflict resolution
//   3. Character-level data replacement for chat messages and memories when timestamps differ significantly
// Conflict Strategy: 
//   - characters: last-write-wins based on modified_at timestamp
//   - chat_messages: character-level replacement when timestamps differ by >1 minute
//   - memories: character-level replacement when timestamps differ by >5 minutes
// Character-level replacement logic:
//   - Compare latest timestamps per character between local and remote
//   - If one source has significantly newer data (configurable threshold), replace all data for that character
//   - This handles cases where one device was used offline and has a complete conversation history
//   - Prevents fragmented conversations from appearing when syncing between devices
// Deletions:
//   - characters: ON DELETE CASCADE clears chats; we record tombstones in turso_tombstones (entity, id, ts)
//   - chat messages: not currently deleted in app (skip)
//   - memories per character: create tombstone rows (entity='memories_character', id=<character name>)
// Limitations: Not a full CRDT; race conditions within same ms may flip-flop across devices. Acceptable for this use case.

import { createClient } from '@libsql/client';
import { getDatabase } from './database.js';

let remote = null;
let config = null;
let status = {
  active: false,
  lastPush: null,
  lastPull: null,
  lastError: null,
  bootstrap: null,
  cycleCount: 0
};
let timer = null;

// Ensure local auxiliary tables for sync bookkeeping
function ensureBookkeepingTables(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS turso_tombstones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity TEXT NOT NULL,
    ref TEXT NOT NULL,
    ts INTEGER NOT NULL
  );`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_turso_tombstones_entity_ref ON turso_tombstones(entity, ref);`);
  db.exec(`CREATE TABLE IF NOT EXISTS turso_sync_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    last_full_pull INTEGER,
    last_push_ts INTEGER,
    last_conflict_resolution INTEGER
  );`);
  
  // Handle migration for existing databases missing the last_conflict_resolution column
  try {
    const columns = db.prepare('PRAGMA table_info(turso_sync_state)').all();
    const hasConflictColumn = columns.some(col => col.name === 'last_conflict_resolution');
    if (!hasConflictColumn) {
      db.exec('ALTER TABLE turso_sync_state ADD COLUMN last_conflict_resolution INTEGER');
      console.log('Turso sync: Added missing last_conflict_resolution column to existing database');
    }
  } catch (e) {
    console.warn('Turso sync: Failed to check/add last_conflict_resolution column:', e.message);
  }
  
  const row = db.prepare('SELECT id FROM turso_sync_state WHERE id=1').get();
  if (!row) db.prepare('INSERT INTO turso_sync_state (id,last_full_pull,last_push_ts,last_conflict_resolution) VALUES (1,NULL,NULL,NULL)').run();
}

function isLocalEmpty(db) {
  try {
    const c1 = db.prepare('SELECT COUNT(*) c FROM characters').get().c;
    const c2 = db.prepare('SELECT COUNT(*) c FROM chat_messages').get().c;
    let c3 = 0; try { c3 = db.prepare('SELECT COUNT(*) c FROM memories').get().c; } catch {}
    return (c1 + c2 + c3) === 0;
  } catch { return false; }
}

// Helper function to safely execute remote queries with fallback
async function safeRemoteExecute(query, params = []) {
  try {
    return await remote.execute(query, params);
  } catch (error) {
    console.warn(`Turso sync: Remote query failed (${query}):`, error.message);
    return { rows: [] };
  }
}

// Record sync conflict resolution event
function recordConflictResolution(db, type, characterId, action) {
  try {
    const now = Date.now();
    db.prepare('UPDATE turso_sync_state SET last_conflict_resolution = ? WHERE id = 1').run(now);
    console.log(`Turso sync: Conflict resolution - ${type} for character ${characterId}: ${action} (${new Date(now).toISOString()})`);
  } catch (error) {
    console.warn('Turso sync: Failed to record conflict resolution:', error.message);
  }
}

async function ensureRemoteSchema() {
  if (!remote) return;
  // Minimal mirror tables (same definitions but without FKs for simplicity)
  // We create if absent. Remote may already have them.
  try {
    await remote.batch([
      `CREATE TABLE IF NOT EXISTS characters (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, description TEXT, current_scenario TEXT, persona TEXT, appearance TEXT, avatar_url TEXT, first_message TEXT, last_journal_index INTEGER DEFAULT 0, settings_override TEXT DEFAULT '{}', created_at INTEGER NOT NULL, modified_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY, character_id INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, timestamp INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS memories (rowid INTEGER PRIMARY KEY, id TEXT, character TEXT, summary TEXT, timestamp INTEGER NOT NULL, importance REAL, data TEXT, embedding BLOB)` ,
      `CREATE TABLE IF NOT EXISTS turso_tombstones (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT NOT NULL, ref TEXT NOT NULL, ts INTEGER NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name)`,
      `CREATE INDEX IF NOT EXISTS idx_chat_messages_char_ts ON chat_messages(character_id,timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_memories_character ON memories(character)`
    ], 'write');
  } catch (e) {
    status.lastError = 'remote schema: ' + (e.message || String(e));
  }
}

// Pull remote rows not present locally or newer.
async function pullOnce() {
  if (!remote) return;
  const db = getDatabase();
  ensureBookkeepingTables(db);
  try {
    // Characters: timestamp-based conflict resolution
    const remoteChars = await remote.execute(`SELECT * FROM characters`);
    const upsertChar = db.prepare(`INSERT INTO characters (id,name,description,current_scenario,persona,appearance,avatar_url,first_message,last_journal_index,settings_override,created_at,modified_at)
      VALUES (@id,@name,@description,@current_scenario,@persona,@appearance,@avatar_url,@first_message,@last_journal_index,@settings_override,@created_at,@modified_at)
      ON CONFLICT(name) DO UPDATE SET description=excluded.description,current_scenario=excluded.current_scenario,persona=excluded.persona,appearance=excluded.appearance,avatar_url=excluded.avatar_url,first_message=excluded.first_message,last_journal_index=excluded.last_journal_index,settings_override=excluded.settings_override,modified_at=excluded.modified_at WHERE excluded.modified_at > modified_at`);
    const localMod = db.prepare('SELECT modified_at FROM characters WHERE name=?');
    for (const r of remoteChars.rows) {
      const existing = localMod.get(r.name);
      if (!existing || existing.modified_at < r.modified_at) {
        upsertChar.run(r);
      }
    }
    
    // Chat messages: timestamp-based conflict resolution with character-level data replacement
    const remoteChats = await safeRemoteExecute(`SELECT * FROM chat_messages ORDER BY character_id, timestamp`);
    
    // Group remote chats by character and get latest timestamp per character
    const remoteCharTimestamps = new Map();
    const remoteCharMessages = new Map();
    for (const msg of remoteChats.rows) {
      const charId = msg.character_id;
      if (!remoteCharTimestamps.has(charId) || msg.timestamp > remoteCharTimestamps.get(charId)) {
        remoteCharTimestamps.set(charId, msg.timestamp);
      }
      if (!remoteCharMessages.has(charId)) {
        remoteCharMessages.set(charId, []);
      }
      remoteCharMessages.get(charId).push(msg);
    }
    
    // Get local character timestamps
    const localCharTimestamps = new Map();
    const localChats = db.prepare('SELECT character_id, MAX(timestamp) as latest_timestamp FROM chat_messages GROUP BY character_id').all();
    for (const chat of localChats) {
      localCharTimestamps.set(chat.character_id, chat.latest_timestamp);
    }
    
    // Process each character's chat history
    for (const [charId, remoteLatest] of remoteCharTimestamps) {
      const localLatest = localCharTimestamps.get(charId) || 0;
      
      // If remote has significantly newer data (more than 1 minute newer), replace local data
      if (remoteLatest > localLatest + 60000) {
        recordConflictResolution(db, 'chat_messages', charId, 'replaced_local_with_remote');
        
        // Delete local chat messages for this character
        db.prepare('DELETE FROM chat_messages WHERE character_id = ?').run(charId);
        
        // Insert all remote messages for this character
        const insChat = db.prepare(`INSERT INTO chat_messages (id,character_id,role,content,timestamp) VALUES (?,?,?,?,?)`);
        for (const msg of remoteCharMessages.get(charId)) {
          insChat.run(msg.id, msg.character_id, msg.role, msg.content, msg.timestamp);
        }
      } else if (localLatest > remoteLatest + 60000) {
        // Local is significantly newer - we'll push this data in pushOnce
        recordConflictResolution(db, 'chat_messages', charId, 'local_newer_will_push');
      } else {
        // Timestamps are close or remote is slightly newer - do incremental merge
        const localChatIds = new Set(db.prepare('SELECT id FROM chat_messages WHERE character_id = ?').all(charId).map(r => r.id));
        const insChat = db.prepare(`INSERT OR IGNORE INTO chat_messages (id,character_id,role,content,timestamp) VALUES (?,?,?,?,?)`);
        for (const msg of remoteCharMessages.get(charId)) {
          if (!localChatIds.has(msg.id)) {
            insChat.run(msg.id, msg.character_id, msg.role, msg.content, msg.timestamp);
          }
        }
      }
    }
    
    // Handle characters that exist locally but not remotely
    for (const [charId, localLatest] of localCharTimestamps) {
      if (!remoteCharTimestamps.has(charId)) {
        recordConflictResolution(db, 'chat_messages', charId, 'local_only_will_push');
      }
    }
    
    // Memories: timestamp-based conflict resolution
    const remoteMems = await safeRemoteExecute(`SELECT rowid,id,character,summary,timestamp,importance,data,embedding FROM memories`);
    
    // Get local and remote memory timestamps by character
    const remoteMemTimestamps = new Map();
    const remoteMemsByChar = new Map();
    for (const mem of remoteMems.rows) {
      const char = mem.character || 'global';
      if (!remoteMemTimestamps.has(char) || mem.timestamp > remoteMemTimestamps.get(char)) {
        remoteMemTimestamps.set(char, mem.timestamp);
      }
      if (!remoteMemsByChar.has(char)) {
        remoteMemsByChar.set(char, []);
      }
      remoteMemsByChar.get(char).push(mem);
    }
    
    const localMemTimestamps = new Map();
    let localMems = [];
    try { 
      localMems = db.prepare('SELECT character, MAX(timestamp) as latest_timestamp FROM memories GROUP BY character').all();
    } catch {}
    for (const mem of localMems) {
      localMemTimestamps.set(mem.character || 'global', mem.latest_timestamp);
    }
    
    // Process memories by character
    for (const [char, remoteLatest] of remoteMemTimestamps) {
      const localLatest = localMemTimestamps.get(char) || 0;
      
      // If remote has significantly newer data, replace local memories for this character
      if (remoteLatest > localLatest + 300000) { // 5 minutes threshold for memories
        recordConflictResolution(db, 'memories', char, 'replaced_local_with_remote');
        
        // Delete local memories for this character
        db.prepare('DELETE FROM memories WHERE character = ? OR (character IS NULL AND ? = "global")').run(char, char);
        
        // Insert remote memories
        const insMem = db.prepare(`INSERT INTO memories (rowid,id,character,summary,timestamp,importance,data,embedding) VALUES (?,?,?,?,?,?,?,?)`);
        for (const mem of remoteMemsByChar.get(char)) {
          try {
            insMem.run(mem.rowid, mem.id, mem.character, mem.summary, mem.timestamp, mem.importance, mem.data, mem.embedding);
          } catch (e) {
            // Handle rowid conflicts by letting SQLite assign new rowid
            const insMemAuto = db.prepare(`INSERT INTO memories (id,character,summary,timestamp,importance,data,embedding) VALUES (?,?,?,?,?,?,?)`);
            insMemAuto.run(mem.id, mem.character, mem.summary, mem.timestamp, mem.importance, mem.data, mem.embedding);
          }
        }
      } else if (localLatest > remoteLatest + 300000) {
        recordConflictResolution(db, 'memories', char, 'local_newer_will_push');
      } else {
        // Incremental merge for memories
        const localMemIds = new Set(db.prepare('SELECT rowid FROM memories WHERE character = ? OR (character IS NULL AND ? = "global")').all(char, char).map(r => r.rowid));
        const insMem = db.prepare(`INSERT INTO memories (rowid,id,character,summary,timestamp,importance,data,embedding) VALUES (?,?,?,?,?,?,?,?)`);
        for (const mem of remoteMemsByChar.get(char)) {
          if (!localMemIds.has(mem.rowid)) {
            try {
              insMem.run(mem.rowid, mem.id, mem.character, mem.summary, mem.timestamp, mem.importance, mem.data, mem.embedding);
            } catch (e) {
              // Handle rowid conflicts
              const insMemAuto = db.prepare(`INSERT INTO memories (id,character,summary,timestamp,importance,data,embedding) VALUES (?,?,?,?,?,?,?)`);
              insMemAuto.run(mem.id, mem.character, mem.summary, mem.timestamp, mem.importance, mem.data, mem.embedding);
            }
          }
        }
      }
    }
    
    // Handle characters that exist locally but not remotely
    for (const [char, localLatest] of localMemTimestamps) {
      if (!remoteMemTimestamps.has(char)) {
        recordConflictResolution(db, 'memories', char, 'local_only_will_push');
      }
    }
    
    status.lastPull = Date.now();
    status.lastError = null;
  } catch (e) {
    status.lastError = 'pull: ' + (e.message || String(e));
  }
}

// Push newer / missing rows to remote.
async function pushOnce() {
  if (!remote) return;
  const db = getDatabase();
  ensureBookkeepingTables(db);
  try {
    // Characters: fetch remote modified times into map
    const remoteChars = await remote.execute(`SELECT name, modified_at FROM characters`);
    const rMap = new Map(remoteChars.rows.map(r => [r.name, r.modified_at]));
    const locals = db.prepare('SELECT * FROM characters').all();
    const stmts = [];
    for (const c of locals) {
      const rm = rMap.get(c.name);
      if (rm == null || rm < c.modified_at) {
        stmts.push({ sql: `INSERT INTO characters (id,name,description,current_scenario,persona,appearance,avatar_url,first_message,last_journal_index,settings_override,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET description=excluded.description,current_scenario=excluded.current_scenario,persona=excluded.persona,appearance=excluded.appearance,avatar_url=excluded.avatar_url,first_message=excluded.first_message,last_journal_index=excluded.last_journal_index,settings_override=excluded.settings_override,modified_at=excluded.modified_at WHERE excluded.modified_at > modified_at`, args: [c.id,c.name,c.description,c.current_scenario,c.persona,c.appearance,c.avatar_url,c.first_message,c.last_journal_index,c.settings_override,c.created_at,c.modified_at] });
      }
    }
    
    // Chat messages: timestamp-based conflict resolution with character-level data replacement
    const remoteChats = await safeRemoteExecute(`SELECT character_id, MAX(timestamp) as latest_timestamp FROM chat_messages GROUP BY character_id`);
    const remoteCharTimestamps = new Map(remoteChats.rows.map(r => [r.character_id, r.latest_timestamp]));
    
    // Get local character timestamps
    const localCharTimestamps = new Map();
    const localChats = db.prepare('SELECT character_id, MAX(timestamp) as latest_timestamp FROM chat_messages GROUP BY character_id').all();
    for (const chat of localChats) {
      localCharTimestamps.set(chat.character_id, chat.latest_timestamp);
    }
    
    // Process each character's chat history
    for (const [charId, localLatest] of localCharTimestamps) {
      const remoteLatest = remoteCharTimestamps.get(charId) || 0;
      
      // If local has significantly newer data, replace remote data
      if (localLatest > remoteLatest + 60000) {
        recordConflictResolution(db, 'chat_messages', charId, 'replacing_remote_with_local');
        
        // Delete remote chat messages for this character
        stmts.push({ sql: `DELETE FROM chat_messages WHERE character_id = ?`, args: [charId] });
        
        // Push all local messages for this character
        const charMessages = db.prepare('SELECT * FROM chat_messages WHERE character_id = ? ORDER BY timestamp').all(charId);
        for (const msg of charMessages) {
          stmts.push({ sql: `INSERT INTO chat_messages (id,character_id,role,content,timestamp) VALUES (?,?,?,?,?)`, args: [msg.id,msg.character_id,msg.role,msg.content,msg.timestamp] });
        }
      } else if (remoteLatest > localLatest + 60000) {
        // Remote is significantly newer - don't push anything, it will be pulled next cycle
        recordConflictResolution(db, 'chat_messages', charId, 'remote_newer_skipping_push');
      } else {
        // Incremental push - add missing messages
        const allRemoteChatsRes = await safeRemoteExecute(`SELECT id FROM chat_messages WHERE character_id = ?`, [charId]);
        const remoteChatIds = new Set(allRemoteChatsRes.rows.map(r => r.id));
        const charMessages = db.prepare('SELECT * FROM chat_messages WHERE character_id = ?').all(charId);
        for (const msg of charMessages) {
          if (!remoteChatIds.has(msg.id)) {
            stmts.push({ sql: `INSERT INTO chat_messages (id,character_id,role,content,timestamp) VALUES (?,?,?,?,?)`, args: [msg.id,msg.character_id,msg.role,msg.content,msg.timestamp] });
          }
        }
      }
    }
    
    // Memories: timestamp-based conflict resolution by character
    const remoteMemsTime = await safeRemoteExecute(`SELECT character, MAX(timestamp) as latest_timestamp FROM memories GROUP BY character`);
    const remoteMemTimestamps = new Map(remoteMemsTime.rows.map(r => [r.character || 'global', r.latest_timestamp]));
    
    const localMemTimestamps = new Map();
    let localMems = [];
    try { 
      localMems = db.prepare('SELECT character, MAX(timestamp) as latest_timestamp FROM memories GROUP BY character').all();
    } catch {}
    for (const mem of localMems) {
      localMemTimestamps.set(mem.character || 'global', mem.latest_timestamp);
    }
    
    // Process memories by character
    for (const [char, localLatest] of localMemTimestamps) {
      const remoteLatest = remoteMemTimestamps.get(char) || 0;
      
      // If local has significantly newer data, replace remote memories for this character
      if (localLatest > remoteLatest + 300000) { // 5 minutes threshold for memories
        recordConflictResolution(db, 'memories', char, 'replacing_remote_with_local');
        
        // Delete remote memories for this character
        stmts.push({ sql: `DELETE FROM memories WHERE character = ? OR (character IS NULL AND ? = 'global')`, args: [char, char] });
        
        // Push all local memories for this character
        const charMemories = db.prepare('SELECT rowid,id,character,summary,timestamp,importance,data,embedding FROM memories WHERE character = ? OR (character IS NULL AND ? = "global")').all(char, char);
        for (const mem of charMemories) {
          stmts.push({ sql: `INSERT INTO memories (rowid,id,character,summary,timestamp,importance,data,embedding) VALUES (?,?,?,?,?,?,?,?)`, args: [mem.rowid,mem.id,mem.character,mem.summary,mem.timestamp,mem.importance,mem.data,mem.embedding] });
        }
      } else if (remoteLatest > localLatest + 300000) {
        // Remote is significantly newer - don't push anything
        recordConflictResolution(db, 'memories', char, 'remote_newer_skipping_push');
      } else {
        // Incremental push - add missing memories
        const remoteMemsRes = await safeRemoteExecute(`SELECT rowid FROM memories WHERE character = ? OR (character IS NULL AND ? = 'global')`, [char, char]);
        const remoteMemSet = new Set(remoteMemsRes.rows.map(r => r.rowid));
        const charMemories = db.prepare('SELECT rowid,id,character,summary,timestamp,importance,data,embedding FROM memories WHERE character = ? OR (character IS NULL AND ? = "global")').all(char, char);
        for (const mem of charMemories) {
          if (!remoteMemSet.has(mem.rowid)) {
            stmts.push({ sql: `INSERT INTO memories (rowid,id,character,summary,timestamp,importance,data,embedding) VALUES (?,?,?,?,?,?,?,?)`, args: [mem.rowid,mem.id,mem.character,mem.summary,mem.timestamp,mem.importance,mem.data,mem.embedding] });
          }
        }
      }
    }
    
    if (stmts.length) await remote.batch(stmts,'write');
    status.lastPush = Date.now();
    status.lastError = null;
  } catch (e) {
    status.lastError = 'push: ' + (e.message || String(e));
  }
}

async function bootstrap(db) {
  const empty = isLocalEmpty(db);
  status.bootstrap = { started: Date.now(), localEmpty: empty };
  
  if (empty) {
    // Local is empty, pull all remote data
    console.log('Turso sync: Local database is empty, pulling all remote data...');
    await pullOnce();
  } else {
    // Both have data, perform bidirectional sync with conflict resolution
    console.log('Turso sync: Both local and remote have data, performing conflict resolution...');
    
    try {
      // Check if remote has data at all
      const remoteCharCount = await remote.execute(`SELECT COUNT(*) as count FROM characters`);
      const remoteChatCount = await remote.execute(`SELECT COUNT(*) as count FROM chat_messages`);
      
      if (remoteCharCount.rows[0].count === 0 && remoteChatCount.rows[0].count === 0) {
        // Remote is empty, push all local data
        console.log('Turso sync: Remote database is empty, pushing all local data...');
        await pushOnce();
      } else {
        // Both have data, do full bidirectional sync
        console.log('Turso sync: Both databases have data, performing bidirectional sync...');
        
        // Pull first to get remote changes, then push local changes
        await pullOnce();
        await pushOnce();
        
        // Additional logging for conflict resolution status
        const localCharCount = db.prepare('SELECT COUNT(*) as count FROM characters').get().count;
        const localChatCount = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get().count;
        
        console.log(`Turso sync: Bootstrap completed. Local: ${localCharCount} characters, ${localChatCount} messages. Remote: ${remoteCharCount.rows[0].count} characters, ${remoteChatCount.rows[0].count} messages.`);
      }
    } catch (error) {
      console.error('Turso sync: Bootstrap error:', error);
      status.lastError = 'bootstrap: ' + (error.message || String(error));
      
      // Fallback: try push-only if pull fails
      try {
        console.log('Turso sync: Attempting fallback push-only bootstrap...');
        await pushOnce();
      } catch (pushError) {
        console.error('Turso sync: Fallback push also failed:', pushError);
        status.lastError = 'bootstrap fallback: ' + (pushError.message || String(pushError));
      }
    }
  }
  
  status.bootstrap.completed = Date.now();
}

async function cycle() {
  status.cycleCount += 1;
  // Pull then push each cycle to absorb remote changes then publish local ones.
  await pullOnce();
  await pushOnce();
}

export function startTursoSync({ url, authToken, intervalMs = 60000 } = {}) {
  stopTursoSync();
  if (!url || !authToken) return false;
  remote = createClient({ url, authToken });
  config = { url, intervalMs };
  status.active = true;
  status.lastError = null;
  const db = getDatabase();
  ensureBookkeepingTables(db);
  ensureRemoteSchema().then(() => bootstrap(db));
  timer = setInterval(() => { cycle(); }, Math.max(15000, intervalMs));
  return true;
}

export function stopTursoSync() {
  if (timer) clearInterval(timer);
  timer = null;
  remote = null;
  config = null;
  status.active = false;
}

export function getTursoSyncStatus() {
  return { ...status, config };
}

export function isTursoSyncing() { return status.active; }

// Record tombstone helper (currently only used for character & memories bulk delete hooks later)
export function recordTombstone(entity, ref) {
  try {
    const db = getDatabase();
    ensureBookkeepingTables(db);
    db.prepare('INSERT INTO turso_tombstones(entity,ref,ts) VALUES (?,?,?)').run(entity, ref, Date.now());
  } catch (e) {
    status.lastError = 'tombstone: ' + (e.message || String(e));
  }
}
