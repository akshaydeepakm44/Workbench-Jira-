import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function applyPhase4aMigration() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — APPLYING PHASE 4A SCHEMA MIGRATION');
  console.log('===============================================================\n');

  const sqlPath = path.resolve(__dirname, '../prisma/phase4a_migration.sql');
  const migrationSql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('Executing phase4a_migration.sql...');
  const statements = migrationSql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const statement of statements) {
    console.log(`Executing: ${statement.slice(0, 60)}...`);
    await prisma.$executeRawUnsafe(statement);
  }

  console.log('\nMigration executed successfully. Running reconciliation...');

  const baselinePath = path.resolve(__dirname, '../phase4a_pre_migration_baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

  const currentCounts = {
    User: await prisma.user.count(),
    Task: await prisma.task.count(),
    TaskPoint: await prisma.taskPoint.count(),
    AcceptanceCriterion: await prisma.acceptanceCriterion.count(),
    TaskEvidence: await prisma.taskEvidence.count(),
    TaskDependency: await prisma.taskDependency.count(),
    Project: await prisma.project.count(),
    ProjectSequence: await prisma.projectSequence.count(),
    LegacyTicketAlias: await prisma.legacyTicketAlias.count(),
    Sprint: await prisma.sprint.count(),
    SprintCommitment: await prisma.sprintCommitment.count(),
    Board: await prisma.board.count(),
    BoardColumn: await prisma.boardColumn.count(),
    UserCapacity: await prisma.userCapacity.count(),
  };

  console.log('\nPost-Migration Reconciliation:');
  console.table(currentCounts);

  let matched = 0;
  for (const bTask of baseline.tasks) {
    const cur = await prisma.task.findUnique({
      where: { id: bTask.id },
      select: {
        id: true,
        ticketId: true,
        type: true,
        status: true,
        projectId: true,
      },
    });
    if (cur && cur.ticketId === bTask.ticketId) {
      matched++;
    }
  }

  console.log(`\nReconciled Tasks: ${matched} / ${baseline.tasks.length}`);
  if (matched !== baseline.tasks.length) {
    throw new Error('Task count mismatch after migration!');
  }

  console.log('===============================================================');
  console.log('PHASE 4A MIGRATION APPLIED & RECONCILED SUCCESSFULLY!');
  console.log('===============================================================');
}

applyPhase4aMigration()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
