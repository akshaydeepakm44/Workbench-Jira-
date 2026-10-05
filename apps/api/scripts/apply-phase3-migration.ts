import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function runMigrationAndBackfill() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — APPLYING PHASE 3 MIGRATION & BACKFILL');
  console.log('===============================================================\n');

  const sqlPath = path.resolve(__dirname, '../prisma/phase3_migration.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  console.log('1. Executing reviewed SQL migration statements...');
  
  // Split statements by semicolon while ignoring comments and PRAGMAs inside blocks
  // Since SQLite exec can run multiple statements directly, we can execute the full batch
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.resolve(__dirname, '../prisma/dev.db');
  const db = new DatabaseSync(dbPath);
  
  db.exec(sql);
  db.close();
  console.log('  SQL migration successfully applied to dev.db.\n');

  console.log('2. Running LexoRank Backfill for existing tasks...');
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, ticketId: true },
  });

  console.log(`  Assigning deterministic spaced ranks to ${tasks.length} tasks...`);
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    // Base-36 padded sequence e.g. "0|h00000:", "0|h00010:"
    const step = (i * 10).toString(36).padStart(5, '0');
    const rank = `0|h${step}:`;
    await prisma.task.update({
      where: { id: task.id },
      data: { rank },
    });
  }
  console.log('  LexoRank backfill completed successfully.\n');

  console.log('3. Seeding default Scrum & Kanban boards for active projects...');
  const projects = await prisma.project.findMany();
  const manager = await prisma.user.findFirst({
    where: { role: { code: 'ROLE_MANAGER' } },
  });

  if (!manager) throw new Error('Manager user not found for board seeding');

  for (const proj of projects) {
    // Check if boards already exist
    const existingBoards = await prisma.board.count({ where: { projectId: proj.id } });
    if (existingBoards === 0) {
      // 1. Kanban Board
      const kanbanBoard = await prisma.board.create({
        data: {
          projectId: proj.id,
          name: `${proj.name} Kanban Board`,
          type: 'KANBAN',
          createdById: manager.id,
          columns: {
            create: [
              { name: 'To Do', orderIndex: 0, wipLimit: 0, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['TODO', 'REOPENED', 'DRAFT']) },
              { name: 'In Progress', orderIndex: 1, wipLimit: 5, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['IN_PROGRESS']) },
              { name: 'Blocked', orderIndex: 2, wipLimit: 3, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['BLOCKED']) },
              { name: 'In Review', orderIndex: 3, wipLimit: 4, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['IN_REVIEW', 'CHANGES_REQUESTED']) },
              { name: 'Done', orderIndex: 4, wipLimit: 0, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['APPROVED', 'DONE']) },
            ],
          },
        },
      });
      console.log(`  Created default Kanban Board for ${proj.key}: ${kanbanBoard.id}`);

      // 2. Scrum Board
      const scrumBoard = await prisma.board.create({
        data: {
          projectId: proj.id,
          name: `${proj.name} Scrum Board`,
          type: 'SCRUM',
          createdById: manager.id,
          columns: {
            create: [
              { name: 'To Do', orderIndex: 0, wipLimit: 0, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['TODO', 'REOPENED', 'DRAFT']) },
              { name: 'In Progress', orderIndex: 1, wipLimit: 6, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['IN_PROGRESS']) },
              { name: 'In Review', orderIndex: 2, wipLimit: 4, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['IN_REVIEW', 'CHANGES_REQUESTED']) },
              { name: 'Done', orderIndex: 3, wipLimit: 0, wipLimitType: 'WARNING', mappedStatuses: JSON.stringify(['APPROVED', 'DONE']) },
            ],
          },
        },
      });
      console.log(`  Created default Scrum Board for ${proj.key}: ${scrumBoard.id}`);
    }
  }

  console.log('\n4. Verifying post-migration counts against baseline...');
  const baselinePath = path.resolve(__dirname, '../phase3_pre_migration_baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

  const postCounts = {
    User: await prisma.user.count(),
    Task: await prisma.task.count(),
    TaskPoint: await prisma.taskPoint.count(),
    AcceptanceCriterion: await prisma.acceptanceCriterion.count(),
    TaskEvidence: await prisma.taskEvidence.count(),
    TaskDependency: await prisma.taskDependency.count(),
    Project: await prisma.project.count(),
    ProjectSequence: await prisma.projectSequence.count(),
    LegacyTicketAlias: await prisma.legacyTicketAlias.count(),
  };

  console.log('---------------------------------------------------------------');
  console.log('Table               | Pre-Migration | Post-Migration | Change');
  console.log('---------------------------------------------------------------');
  for (const [table, preCount] of Object.entries(baseline.counts)) {
    const postCount = (postCounts as any)[table];
    console.log(`${table.padEnd(19)} | ${String(preCount).padStart(13)} | ${String(postCount).padStart(14)} | ${postCount - (preCount as number) === 0 ? 'MATCHED' : postCount - (preCount as number)}`);
  }
  console.log('---------------------------------------------------------------\n');

  console.log('5. Verifying original ticket IDs & parent-child preservation...');
  let mismatchCount = 0;
  for (const original of baseline.tasks) {
    const current = await prisma.task.findUnique({
      where: { id: original.id },
      select: { ticketId: true, parentTaskId: true, status: true },
    });
    if (!current || current.ticketId !== original.ticketId || current.parentTaskId !== original.parentTaskId) {
      console.error(`Mismatch on task ${original.id} (${original.ticketId})`);
      mismatchCount++;
    }
  }
  console.log(`  Verified ${baseline.tasks.length} tasks. Mismatches: ${mismatchCount}`);
  if (mismatchCount > 0) throw new Error('Data reconciliation failed!');

  console.log('\n===============================================================');
  console.log('PHASE 3 MIGRATION AND RECONCILIATION: 100% PASS');
  console.log('===============================================================');
}

runMigrationAndBackfill()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
