/**
 * Cleanup script for MockView
 *
 * This script cleans up expired sessions and orphaned files.
 * Run with: npx ts-node scripts/cleanup.ts
 *
 * For scheduled cleanup, add to crontab:
 * 0 * * * * cd /path/to/mockview && npx ts-node scripts/cleanup.ts >> /var/log/mockview-cleanup.log 2>&1
 */

import { runFullCleanup, getCleanupStats } from '../src/lib/services/cleanup';
import { getSequelize } from '../src/lib/db/connection';

async function main() {
  console.log('='.repeat(50));
  console.log(`MockView Cleanup - ${new Date().toISOString()}`);
  console.log('='.repeat(50));

  try {
    // Get stats before cleanup
    console.log('\n📊 Pre-cleanup statistics:');
    const preStats = await getCleanupStats();
    console.log(`  Total sessions: ${preStats.totalSessions}`);
    console.log(`  Expired sessions: ${preStats.expiredSessions}`);
    if (preStats.oldestSession) {
      console.log(`  Oldest session: ${preStats.oldestSession.toISOString()}`);
    }

    // Run cleanup
    console.log('\n🧹 Running cleanup...');
    const result = await runFullCleanup();

    // Report results
    console.log('\n✅ Cleanup complete:');
    console.log(`  Expired sessions removed: ${result.expiredSessions}`);
    console.log(`  Orphaned uploads deleted: ${result.deletedFiles.uploads}`);
    console.log(`  Orphaned audio deleted: ${result.deletedFiles.audio}`);
    console.log(`  Duration: ${result.duration_ms}ms`);

    if (result.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered (${result.errors.length}):`);
      result.errors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    }

    // Get stats after cleanup
    console.log('\n📊 Post-cleanup statistics:');
    const postStats = await getCleanupStats();
    console.log(`  Total sessions: ${postStats.totalSessions}`);
    console.log(`  Expired sessions: ${postStats.expiredSessions}`);

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exitCode = 1;
  } finally {
    // Close database connection
    const sequelize = getSequelize();
    await sequelize.close();
    console.log('\n' + '='.repeat(50));
  }
}

main();
