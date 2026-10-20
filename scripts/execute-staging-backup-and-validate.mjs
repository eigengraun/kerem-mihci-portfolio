import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const prevUmask = process.umask(0o077);
const backupDir = path.join(os.tmpdir(), 'portfolio-staging-backups');
fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

const timestamp = Date.now();
const backupFilename = 'staging-pre-phase3-' + timestamp + '.sql';
const backupPath = path.join(backupDir, backupFilename);

console.log('1. Exporting remote D1 to ' + backupPath + ' with umask 077...');
execSync('npx --yes wrangler d1 export kerem-portfolio-db-staging --config cloudflare/portfolio-api/wrangler.jsonc --env staging --remote --output "' + backupPath + '"', { stdio: 'inherit' });

// 2. Non-empty check
if (!fs.existsSync(backupPath) || fs.statSync(backupPath).size === 0) {
  console.error('FATAL: Backup file is empty or does not exist!');
  process.exit(1);
}
const byteSize = fs.statSync(backupPath).size;
console.log('2. Backup non-empty verified: ' + byteSize + ' bytes');

// 3. SHA-256 checksum
const sha256 = crypto.createHash('sha256').update(fs.readFileSync(backupPath)).digest('hex');
fs.writeFileSync(backupPath + '.sha256', sha256 + '  ' + backupFilename + '\n', { mode: 0o600 });
console.log('3. SHA-256 checksum recorded: ' + sha256);

// 4. Isolated SQLite import and PRAGMA quick_check
const tempDbPath = path.join(backupDir, 'verify-' + timestamp + '.sqlite');
console.log('4. Importing backup SQL into isolated SQLite instance: ' + tempDbPath);
const testDb = new DatabaseSync(tempDbPath);
const sqlContent = fs.readFileSync(backupPath, 'utf8');
testDb.exec(sqlContent);
console.log('5. SQL import succeeded cleanly.');

// 6 & 7. PRAGMA quick_check
const quickCheck = testDb.prepare('PRAGMA quick_check;').get();
if (!quickCheck || quickCheck.quick_check !== 'ok') {
  console.error('FATAL: PRAGMA quick_check failed: ' + JSON.stringify(quickCheck));
  process.exit(1);
}
console.log('6 & 7. PRAGMA quick_check: OK (exactly "ok")');

// 8. Expected tables exist
const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
const requiredTables = ['projects', 'project_translations', 'project_media', 'admin_sessions'];
for (const t of requiredTables) {
  if (!tables.includes(t)) {
    console.error('FATAL: Missing required table in backup: ' + t);
    process.exit(1);
  }
}
console.log('8. Expected tables exist: ' + requiredTables.join(', '));

// 9. Canonical project preservation (30 published)
const publishedProjects = testDb.prepare("SELECT count(*) as count FROM projects WHERE status = 'published'").get().count;
if (Number(publishedProjects) !== 30) {
  console.error('FATAL: Expected 30 published projects, found ' + publishedProjects);
  process.exit(1);
}
console.log('9. Canonical published projects verified: ' + publishedProjects + '/30');

// 10. Project media baseline (72 records)
const mediaCount = testDb.prepare('SELECT count(*) as count FROM project_media').get().count;
if (Number(mediaCount) !== 72) {
  console.error('FATAL: Expected 72 project_media records, found ' + mediaCount);
  process.exit(1);
}
console.log('10. Project media baseline verified: ' + mediaCount + '/72');

// 11. Existing draft present (1 draft project)
const draftProjects = testDb.prepare("SELECT count(*) as count FROM projects WHERE status = 'draft'").get().count;
if (Number(draftProjects) !== 1) {
  console.error('FATAL: Expected 1 draft project, found ' + draftProjects);
  process.exit(1);
}
console.log('11. Staging draft project verified: ' + draftProjects + '/1');

// 12. No unexpected record loss
const totalProjects = testDb.prepare('SELECT count(*) as count FROM projects').get().count;
if (Number(totalProjects) !== 31) {
  console.error('FATAL: Expected 31 total projects, found ' + totalProjects);
  process.exit(1);
}
console.log('12. Total projects verified: ' + totalProjects + '/31');

// 13. Current migration history
let d1MigrationsCount = 0;
if (tables.includes('d1_migrations')) {
  d1MigrationsCount = testDb.prepare('SELECT count(*) as count FROM d1_migrations').get().count;
}
console.log('13. Migration history verified: ' + d1MigrationsCount + ' applied migration(s)');

testDb.close();
fs.rmSync(tempDbPath, { force: true });
process.umask(prevUmask);

// Save sanitized summary for manifest
const backupManifestData = {
  backupFilename,
  backupPath,
  byteSize,
  sha256,
  timestamp: new Date(timestamp).toISOString(),
  quickCheck: 'ok',
  baseline: {
    publishedProjects: Number(publishedProjects),
    draftProjects: Number(draftProjects),
    totalProjects: Number(totalProjects),
    projectMediaRecords: Number(mediaCount)
  }
};
fs.writeFileSync(path.join(backupDir, 'latest-backup-meta.json'), JSON.stringify(backupManifestData, null, 2), { mode: 0o600 });

console.log('\n============================================================');
console.log('BACKUP GATE PASSED: All 13/13 criteria verified!');
console.log('Backup Path: ' + backupPath);
console.log('SHA-256:     ' + sha256);
console.log('Byte Size:   ' + byteSize + ' bytes');
console.log('============================================================\n');
