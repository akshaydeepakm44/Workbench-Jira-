import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function recordPhase4aBaseline() {
  console.log('Recording Phase 4A Pre-Migration Baseline...');

  const userCount = await prisma.user.count();
  const taskCount = await prisma.task.count();
  const taskPointCount = await prisma.taskPoint.count();
  const acceptanceCriterionCount = await prisma.acceptanceCriterion.count();
  const taskEvidenceCount = await prisma.taskEvidence.count();
  const taskDependencyCount = await prisma.taskDependency.count();
  const projectCount = await prisma.project.count();
  const projectSequenceCount = await prisma.projectSequence.count();
  const legacyTicketAliasCount = await prisma.legacyTicketAlias.count();
  const sprintCount = await prisma.sprint.count();
  const sprintCommitmentCount = await prisma.sprintCommitment.count();
  const boardCount = await prisma.board.count();
  const boardColumnCount = await prisma.boardColumn.count();

  const allTasks = await prisma.task.findMany({
    select: {
      id: true,
      ticketId: true,
      parentTaskId: true,
      status: true,
      type: true,
      creatorId: true,
      assigneeId: true,
      projectId: true,
      sprintId: true,
      rank: true,
      storyPoints: true,
      estimatedHours: true,
      actualHours: true,
      startDate: true,
      deadline: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const baselineData = {
    timestamp: new Date().toISOString(),
    counts: {
      User: userCount,
      Task: taskCount,
      TaskPoint: taskPointCount,
      AcceptanceCriterion: acceptanceCriterionCount,
      TaskEvidence: taskEvidenceCount,
      TaskDependency: taskDependencyCount,
      Project: projectCount,
      ProjectSequence: projectSequenceCount,
      LegacyTicketAlias: legacyTicketAliasCount,
      Sprint: sprintCount,
      SprintCommitment: sprintCommitmentCount,
      Board: boardCount,
      BoardColumn: boardColumnCount,
    },
    tasks: allTasks,
  };

  const outputPath = path.resolve(__dirname, '../phase4a_pre_migration_baseline.json');
  fs.writeFileSync(outputPath, JSON.stringify(baselineData, null, 2), 'utf-8');

  console.log('Phase 4A Pre-Migration Baseline Recorded:');
  console.table(baselineData.counts);
  console.log(`Saved ${allTasks.length} task records to ${outputPath}`);
}

recordPhase4aBaseline()
  .catch((err) => {
    console.error('Error recording baseline:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
