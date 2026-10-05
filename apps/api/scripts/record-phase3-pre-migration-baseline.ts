import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function recordBaseline() {
  console.log('Recording Phase 3 Pre-Migration Baseline...');

  const userCount = await prisma.user.count();
  const taskCount = await prisma.task.count();
  const taskPointCount = await prisma.taskPoint.count();
  const acceptanceCriterionCount = await prisma.acceptanceCriterion.count();
  const taskEvidenceCount = await prisma.taskEvidence.count();
  const taskDependencyCount = await prisma.taskDependency.count();
  const projectCount = await prisma.project.count();
  const projectSequenceCount = await prisma.projectSequence.count();
  const legacyTicketAliasCount = await prisma.legacyTicketAlias.count();

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
    },
    tasks: allTasks,
  };

  const outputPath = path.resolve(__dirname, '../phase3_pre_migration_baseline.json');
  fs.writeFileSync(outputPath, JSON.stringify(baselineData, null, 2), 'utf-8');

  console.log('Phase 3 Pre-Migration Baseline Recorded:');
  console.table(baselineData.counts);
  console.log(`Saved ${allTasks.length} task records to ${outputPath}`);
}

recordBaseline()
  .catch((err) => {
    console.error('Error recording baseline:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
