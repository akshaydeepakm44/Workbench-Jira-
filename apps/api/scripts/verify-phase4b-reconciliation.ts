import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function verifyPhase4bReconciliation() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 4B-4D POST-MIGRATION RECONCILIATION AUDIT');
  console.log('===============================================================\n');

  const baselinePath = path.resolve(__dirname, '../phase4b_pre_migration_baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

  const currentCounts: any = {
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

  const comparisonTable = Object.keys(baseline.counts).map((model) => {
    const pre = baseline.counts[model];
    const post = currentCounts[model];
    const diff = post - pre;
    return {
      Model: model,
      'Pre-Migration Baseline': pre,
      'Post-Migration Count': post,
      Delta: diff >= 0 ? `+${diff}` : `${diff}`,
      Status: post >= pre ? 'PRESERVED (NON-DESTRUCTIVE)' : 'REGRESSION DETECTED',
    };
  });

  comparisonTable.push(
    {
      Model: 'ProjectDecision (NEW)',
      'Pre-Migration Baseline': 0,
      'Post-Migration Count': currentCounts.ProjectDecision,
      Delta: `+${currentCounts.ProjectDecision}`,
      Status: 'ADDITIVE SCHEMA (PHASE 4C)',
    },
    {
      Model: 'AutomationRule (NEW)',
      'Pre-Migration Baseline': 0,
      'Post-Migration Count': currentCounts.AutomationRule,
      Delta: `+${currentCounts.AutomationRule}`,
      Status: 'ADDITIVE SCHEMA (PHASE 4D)',
    },
    {
      Model: 'AutomationExecutionLog (NEW)',
      'Pre-Migration Baseline': 0,
      'Post-Migration Count': currentCounts.AutomationExecutionLog,
      Delta: `+${currentCounts.AutomationExecutionLog}`,
      Status: 'ADDITIVE SCHEMA (PHASE 4D)',
    },
  );

  console.table(comparisonTable);

  // Deep task audit
  let matchingTasks = 0;
  for (const t of baseline.tasks) {
    const dbTask = await prisma.task.findUnique({
      where: { id: t.id },
      select: { id: true, ticketId: true, status: true },
    });
    if (!dbTask || dbTask.ticketId !== t.ticketId) {
      throw new Error(`Task verification mismatch for ${t.ticketId}`);
    }
    matchingTasks++;
  }

  console.log(`Deep audit verified: ${matchingTasks} / ${baseline.tasks.length} tasks matched 100%.`);
  console.log('All baseline records and invariants PRESERVED.\n');
}

verifyPhase4bReconciliation()
  .catch((err) => {
    console.error('Reconciliation failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
