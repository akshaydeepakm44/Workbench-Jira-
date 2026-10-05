import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function snapshot() {
  const counts = {
    timestamp: new Date().toISOString(),
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
    ProjectDecision: await prisma.projectDecision.count(),
    AutomationRule: await prisma.automationRule.count(),
    AutomationExecutionLog: await prisma.automationExecutionLog.count(),
  };
  const outPath = path.join(__dirname, '..', 'master_e2e_pre_test_baseline.json');
  fs.writeFileSync(outPath, JSON.stringify(counts, null, 2));
  console.log('Pre-test snapshot captured to:', outPath);
  console.log(counts);
}

snapshot()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
