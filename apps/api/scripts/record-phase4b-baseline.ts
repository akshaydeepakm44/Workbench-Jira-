import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function recordPhase4bBaseline() {
  console.log('Recording Phase 4B-4D Pre-Migration Baseline...');

  const counts = {
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
    Meeting: await prisma.meeting.count(),
    MeetingParticipant: await prisma.meetingParticipant.count(),
    MeetingActionItem: await prisma.meetingActionItem.count(),
    MeetingDecision: await prisma.meetingDecision.count(),
    Standup: await prisma.standup.count(),
    StandupBlocker: await prisma.standupBlocker.count(),
    Notification: await prisma.notification.count(),
    AuditLog: await prisma.auditLog.count(),
  };

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
    counts,
    tasks: allTasks,
  };

  const outputPath = path.resolve(__dirname, '../phase4b_pre_migration_baseline.json');
  fs.writeFileSync(outputPath, JSON.stringify(baselineData, null, 2), 'utf-8');

  console.log('Phase 4B Pre-Migration Baseline Recorded:');
  console.table(baselineData.counts);
  console.log(`Saved ${allTasks.length} task records to ${outputPath}`);
}

recordPhase4bBaseline()
  .catch((err) => {
    console.error('Error recording baseline:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
