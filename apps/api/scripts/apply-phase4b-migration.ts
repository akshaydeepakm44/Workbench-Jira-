import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyPhase4bMigration() {
  console.log('===============================================================');
  console.log('APPLYING REVIEWED PHASE 4B-4D DATABASE MIGRATION');
  console.log('===============================================================\n');

  const sqlPath = path.resolve(__dirname, '../prisma/phase4b_migration.sql');
  const rawSql = fs.readFileSync(sqlPath, 'utf-8');

  // Strip single-line comments
  const cleanSql = rawSql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  // Split and execute SQL statements
  const statements = cleanSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    console.log(`Executing:\n${statement.slice(0, 80)}...\n`);
    await prisma.$executeRawUnsafe(statement);
  }

  console.log('✅ All Phase 4B-4D migration statements executed successfully.\n');

  // Verify tables exist in SQLite catalog
  const tables = await prisma.$queryRaw<any[]>`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN ('ProjectDecision', 'AutomationRule', 'AutomationExecutionLog')
  `;
  console.log('Verified newly created tables in sqlite_master:');
  console.log(tables.map((t) => t.name));

  if (tables.length !== 3) {
    throw new Error(`Expected 3 new tables, found ${tables.length}`);
  }
}

applyPhase4bMigration()
  .catch((err) => {
    console.error('Migration execution failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
