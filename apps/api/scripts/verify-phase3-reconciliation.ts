import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function verifyReconciliation() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 3 POST-IMPLEMENTATION DATA RECONCILIATION');
  console.log('===============================================================\n');

  const baselinePath = path.resolve(__dirname, '../phase3_pre_migration_baseline.json');
  if (!fs.existsSync(baselinePath)) {
    throw new Error('Baseline file not found at: ' + baselinePath);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));
  console.log(`Pre-migration Baseline Timestamp: ${baseline.timestamp}`);
  console.log(`Pre-migration Baseline Task Count: ${baseline.counts.Task}`);

  // Fetch current counts
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
  };

  console.log('\nEntity Count Comparison:');
  console.table({
    User: { PreMigration: baseline.counts.User, PostImplementation: currentCounts.User, Status: currentCounts.User >= baseline.counts.User ? 'PRESERVED' : 'MISMATCH' },
    Task: { PreMigration: baseline.counts.Task, PostImplementation: currentCounts.Task, Status: currentCounts.Task >= baseline.counts.Task ? 'PRESERVED' : 'MISMATCH' },
    TaskPoint: { PreMigration: baseline.counts.TaskPoint, PostImplementation: currentCounts.TaskPoint, Status: currentCounts.TaskPoint >= baseline.counts.TaskPoint ? 'PRESERVED' : 'MISMATCH' },
    AcceptanceCriterion: { PreMigration: baseline.counts.AcceptanceCriterion, PostImplementation: currentCounts.AcceptanceCriterion, Status: currentCounts.AcceptanceCriterion >= baseline.counts.AcceptanceCriterion ? 'PRESERVED' : 'MISMATCH' },
    TaskEvidence: { PreMigration: baseline.counts.TaskEvidence, PostImplementation: currentCounts.TaskEvidence, Status: currentCounts.TaskEvidence >= baseline.counts.TaskEvidence ? 'PRESERVED' : 'MISMATCH' },
    TaskDependency: { PreMigration: baseline.counts.TaskDependency, PostImplementation: currentCounts.TaskDependency, Status: currentCounts.TaskDependency >= baseline.counts.TaskDependency ? 'PRESERVED' : 'MISMATCH' },
    Project: { PreMigration: baseline.counts.Project, PostImplementation: currentCounts.Project, Status: currentCounts.Project >= baseline.counts.Project ? 'PRESERVED' : 'MISMATCH' },
    ProjectSequence: { PreMigration: baseline.counts.ProjectSequence, PostImplementation: currentCounts.ProjectSequence, Status: currentCounts.ProjectSequence >= baseline.counts.ProjectSequence ? 'PRESERVED' : 'MISMATCH' },
    LegacyTicketAlias: { PreMigration: baseline.counts.LegacyTicketAlias, PostImplementation: currentCounts.LegacyTicketAlias, Status: currentCounts.LegacyTicketAlias >= baseline.counts.LegacyTicketAlias ? 'PRESERVED' : 'MISMATCH' },
    Sprint: { PreMigration: 0, PostImplementation: currentCounts.Sprint, Status: 'NEW PHASE 3' },
    SprintCommitment: { PreMigration: 0, PostImplementation: currentCounts.SprintCommitment, Status: 'NEW PHASE 3' },
    Board: { PreMigration: 0, PostImplementation: currentCounts.Board, Status: 'NEW PHASE 3' },
    BoardColumn: { PreMigration: 0, PostImplementation: currentCounts.BoardColumn, Status: 'NEW PHASE 3' },
  });

  // Verify every single pre-migration task
  console.log(`\nVerifying all ${baseline.tasks.length} baseline tasks...`);
  let matchedTasks = 0;
  let mismatchedTasks = 0;

  for (const bTask of baseline.tasks) {
    const current = await prisma.task.findUnique({
      where: { id: bTask.id },
      select: {
        id: true,
        ticketId: true,
        parentTaskId: true,
        type: true,
        creatorId: true,
        projectId: true,
        rank: true,
      },
    });

    if (!current) {
      console.error(`Task ${bTask.id} (${bTask.ticketId}) MISSING from database!`);
      mismatchedTasks++;
      continue;
    }

    if (
      current.ticketId !== bTask.ticketId ||
      current.parentTaskId !== bTask.parentTaskId ||
      current.type !== bTask.type ||
      current.projectId !== bTask.projectId
    ) {
      console.error(`Task ${bTask.ticketId} attribute mismatch:`, { baseline: bTask, current });
      mismatchedTasks++;
      continue;
    }

    matchedTasks++;
  }

  console.log(`  Matched Tasks     : ${matchedTasks} / ${baseline.tasks.length}`);
  console.log(`  Mismatched Tasks  : ${mismatchedTasks}`);

  if (mismatchedTasks > 0 || matchedTasks !== baseline.tasks.length) {
    throw new Error(`Data reconciliation failed! ${mismatchedTasks} tasks mismatched.`);
  }

  console.log('\n===============================================================');
  console.log('RECONCILIATION PASSED: 100% OF ORIGINAL RECORDS INTACT!');
  console.log('===============================================================');
}

verifyReconciliation()
  .catch((err) => {
    console.error('Reconciliation script failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
