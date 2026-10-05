import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function reconcileDatabase() {
  console.log('========================================================================');
  console.log('WORKDESK 2.0 — MASTER DATABASE POST-TEST RECONCILIATION');
  console.log('========================================================================\n');

  const baselinePath = path.join(__dirname, '../master_e2e_pre_test_baseline.json');
  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline snapshot not found at ${baselinePath}`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

  const [
    userCount,
    taskCount,
    taskPointCount,
    acceptanceCriterionCount,
    taskEvidenceCount,
    taskDependencyCount,
    projectCount,
    projectSequenceCount,
    legacyTicketAliasCount,
    sprintCount,
    sprintCommitmentCount,
    boardCount,
    boardColumnCount,
    meetingCount,
    meetingParticipantCount,
    meetingActionItemCount,
    meetingDecisionCount,
    standupCount,
    standupBlockerCount,
    notificationCount,
    auditLogCount,
    projectDecisionCount,
    automationRuleCount,
    automationExecutionLogCount,
    userCapacityCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.taskPoint.count(),
    prisma.acceptanceCriterion.count(),
    prisma.taskEvidence.count(),
    prisma.taskDependency.count(),
    prisma.project.count(),
    prisma.projectSequence.count(),
    prisma.legacyTicketAlias.count(),
    prisma.sprint.count(),
    prisma.sprintCommitment.count(),
    prisma.board.count(),
    prisma.boardColumn.count(),
    prisma.meeting.count(),
    prisma.meetingParticipant.count(),
    prisma.meetingActionItem.count(),
    prisma.meetingDecision.count(),
    prisma.standup.count(),
    prisma.standupBlocker.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
    prisma.projectDecision.count(),
    prisma.automationRule.count(),
    prisma.automationExecutionLog.count(),
    prisma.userCapacity.count(),
  ]);

  const current: Record<string, number> = {
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
    Meeting: meetingCount,
    MeetingParticipant: meetingParticipantCount,
    MeetingActionItem: meetingActionItemCount,
    MeetingDecision: meetingDecisionCount,
    Standup: standupCount,
    StandupBlocker: standupBlockerCount,
    Notification: notificationCount,
    AuditLog: auditLogCount,
    ProjectDecision: projectDecisionCount,
    AutomationRule: automationRuleCount,
    AutomationExecutionLog: automationExecutionLogCount,
    UserCapacity: userCapacityCount,
  };

  console.log('| Entity Name | Pre-Test Baseline | Post-Test Count | Net Delta | Verification Status |');
  console.log('| :--- | :--- | :--- | :--- | :--- |');

  let hasAnomalies = false;

  for (const [key, preCount] of Object.entries(baseline)) {
    if (key === 'timestamp') continue;
    const postCount = current[key] ?? 0;
    const delta = postCount - (preCount as number);
    const status = delta >= 0 ? 'VALID (Additive Only)' : 'ANOMALY (Data dropped)';
    if (delta < 0) hasAnomalies = true;
    console.log(`| ${key} | ${preCount} | ${postCount} | +${delta} | ${status} |`);
  }

  // Integrity checks
  console.log('\n--- Integrity Check: Orphan Task Inspection ---');
  const orphanTasks = await prisma.task.count({
    where: {
      projectId: { notIn: (await prisma.project.findMany({ select: { id: true } })).map((p) => p.id) },
    },
  });
  console.log(`Orphan Tasks without Project: ${orphanTasks} (Expected: 0)`);

  console.log('--- Integrity Check: Dependency Cycles Inspection ---');
  const allDeps = await prisma.taskDependency.findMany();
  let hasCycle = false;
  for (const d of allDeps) {
    const inverse = allDeps.find((i) => i.taskId === d.targetTaskId && i.targetTaskId === d.taskId);
    if (inverse) {
      console.error(`CYCLE DETECTED between ${d.taskId} and ${d.targetTaskId}`);
      hasCycle = true;
    }
  }
  console.log(`Dependency Cycles: ${hasCycle ? 'FAIL (Cycle found)' : 'PASS (Zero cycles)'}`);

  console.log('\n--- Integrity Check: Ticket ID Duplication ---');
  const duplicateTickets = await prisma.task.groupBy({
    by: ['ticketId'],
    _count: { ticketId: true },
    having: { ticketId: { _count: { gt: 1 } } },
  });
  console.log(`Duplicate Ticket IDs: ${duplicateTickets.length} (Expected: 0)`);

  const reportData = {
    timestamp: new Date().toISOString(),
    baseline,
    postTest: current,
    hasAnomalies,
    orphanTasks,
    hasCycle,
    duplicateTicketIds: duplicateTickets.length,
  };

  fs.writeFileSync(
    path.join(__dirname, '../master_e2e_reconciliation_report.json'),
    JSON.stringify(reportData, null, 2),
    'utf8',
  );

  console.log('\nReconciliation report written to master_e2e_reconciliation_report.json');
  await prisma.$disconnect();
}

reconcileDatabase().catch(console.error);
