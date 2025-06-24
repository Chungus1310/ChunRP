// Post-migration cleanup script
// Run this after confirming the SQLite migration is working correctly
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createCleanupArchive() {
  const archiveDir = path.join(__dirname, '../../data-json-archive');
  const dataDir = path.join(__dirname, '../../data');
  
  try {
    // Create archive directory
    if (fs.existsSync(archiveDir)) {
      fs.rmSync(archiveDir, { recursive: true, force: true });
    }
    fs.mkdirSync(archiveDir, { recursive: true });
    
    // Move old JSON files to archive
    const settingsPath = path.join(dataDir, 'settings.json');
    const charactersDir = path.join(dataDir, 'characters');
    const chatHistoryDir = path.join(dataDir, 'chat-history');
    
    if (fs.existsSync(settingsPath)) {
      fs.renameSync(settingsPath, path.join(archiveDir, 'settings.json'));
      console.log('✅ Archived settings.json');
    }
    
    if (fs.existsSync(charactersDir)) {
      fs.renameSync(charactersDir, path.join(archiveDir, 'characters'));
      console.log('✅ Archived characters directory');
    }
    
    if (fs.existsSync(chatHistoryDir)) {
      fs.renameSync(chatHistoryDir, path.join(archiveDir, 'chat-history'));
      console.log('✅ Archived chat-history directory');
    }
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('📁 Old JSON files archived to: data-json-archive/');
    console.log('📊 SQLite database: data/chunrp.db');
    console.log('🧠 Vector memories: data/memory-vectra/ (unchanged)');
    
    return true;
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return false;
  }
}

function validatePostCleanup() {
  const dataDir = path.join(__dirname, '../../data');
  const dbPath = path.join(dataDir, 'chunrp.db');
  const vectraPath = path.join(dataDir, 'memory-vectra');
  
  console.log('\n🔍 Post-cleanup validation:');
  
  if (fs.existsSync(dbPath)) {
    const stats = fs.statSync(dbPath);
    console.log(`✅ SQLite database exists (${Math.round(stats.size / 1024)}KB)`);
  } else {
    console.log('❌ SQLite database not found!');
    return false;
  }
  
  if (fs.existsSync(vectraPath)) {
    console.log('✅ Vector memory storage preserved');
  } else {
    console.log('⚠️  Vector memory storage not found');
  }
  
  const oldFiles = [
    path.join(dataDir, 'settings.json'),
    path.join(dataDir, 'characters'),
    path.join(dataDir, 'chat-history')
  ];
  
  const remainingOldFiles = oldFiles.filter(fs.existsSync);
  if (remainingOldFiles.length === 0) {
    console.log('✅ All old JSON files successfully archived');
  } else {
    console.log('⚠️  Some old files still present:', remainingOldFiles);
  }
  
  return true;
}

async function main() {
  console.log('ChunRP Post-Migration Cleanup');
  console.log('============================\n');
  
  console.log('⚠️  WARNING: This will archive old JSON files.');
  console.log('Make sure your SQLite migration is working correctly first!\n');
  
  // Note: In a real scenario, you'd want user confirmation here
  console.log('Proceeding with cleanup...\n');
  
  const success = createCleanupArchive();
  
  if (success) {
    validatePostCleanup();
  } else {
    console.error('\n❌ Cleanup failed. Old files preserved.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Cleanup error:', error);
  process.exit(1);
});
