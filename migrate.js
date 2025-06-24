// Migration runner script
import { runMigration, validateMigration } from './src/backend/migration.js';

async function main() {
  console.log('ChunRP JSON to SQLite Migration Tool');
  console.log('=====================================\n');
  
  const success = await runMigration();
  
  if (success) {
    console.log('\nRunning validation...');
    validateMigration();
  } else {
    console.error('\n❌ Migration failed. Please check the logs above.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Migration error:', error);
  process.exit(1);
});
