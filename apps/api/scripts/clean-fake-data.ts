import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanFakeData() {
  console.log('========================================================================');
  console.log('PURGING ALL FAKE / DEMO / TEST DATA FROM WORKDESK');
  console.log('========================================================================\n');

  // Find the primary Manager user
  const primaryManager = await prisma.user.findFirst({
    where: { email: 'akshay.m@datai2i.com' },
    include: { role: true },
  });

  if (!primaryManager) {
    console.error('ERROR: Primary manager akshay.m@datai2i.com not found!');
    process.exit(1);
  }

  console.log(`Preserving primary manager: ${primaryManager.fullName} (${primaryManager.email}) [Role: ${primaryManager.role.code}]`);

  // Delete dependent records
  console.log('1. Clearing task attachments, criteria, points, dependencies, and evidence...');
  await prisma.taskEvidence.deleteMany({});
  await prisma.acceptanceCriterion.deleteMany({});
  await prisma.taskPoint.deleteMany({});
  await prisma.taskComment.deleteMany({});
  await prisma.taskActivity.deleteMany({});
  await prisma.taskWatcher.deleteMany({});
  await prisma.taskDependency.deleteMany({});
  await prisma.legacyTicketAlias.deleteMany({});

  console.log('2. Clearing sprint commitments...');
  await prisma.sprintCommitment.deleteMany({});

  console.log('3. Clearing meetings and standups...');
  await prisma.meetingActionItem.deleteMany({});
  await prisma.meetingDecision.deleteMany({});
  await prisma.meetingParticipant.deleteMany({});
  await prisma.meetingAgendaItem.deleteMany({});
  await prisma.meeting.deleteMany({});
  await prisma.standupBlocker.deleteMany({});
  await prisma.standup.deleteMany({});

  console.log('4. Clearing decisions, automations, and boards...');
  await prisma.projectDecision.deleteMany({});
  await prisma.automationExecutionLog.deleteMany({});
  await prisma.automationRule.deleteMany({});
  await prisma.boardColumn.deleteMany({});
  await prisma.board.deleteMany({});

  console.log('5. Clearing tasks...');
  await prisma.task.deleteMany({});

  console.log('6. Clearing sprints...');
  await prisma.sprint.deleteMany({});

  console.log('7. Clearing project sequences, members, and projects...');
  await prisma.projectSequence.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});

  console.log('8. Clearing team memberships and teams...');
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});

  console.log('9. Clearing notifications, preferences, capacities, and sessions...');
  await prisma.userCapacity.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.notificationPreference.deleteMany({
    where: { userId: { not: primaryManager.id } },
  });
  await prisma.session.deleteMany({
    where: { userId: { not: primaryManager.id } },
  });
  await prisma.emailLog.deleteMany({});
  await prisma.auditLog.deleteMany({});

  console.log('10. Deleting all fake / test user accounts...');
  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { not: primaryManager.id } },
  });
  console.log(`Deleted ${deletedUsers.count} test users.`);

  // Ensure primary manager is APPROVED, ACTIVE, and employeeId is clean
  await prisma.user.update({
    where: { id: primaryManager.id },
    data: {
      approvalStatus: 'APPROVED',
      isActive: true,
      employeeId: 'EMP-0001',
    },
  });

  console.log('\n========================================================================');
  console.log('CLEANUP COMPLETE: APPLICATION DATABASE IS COMPLETELY PRISTINE');
  console.log(`Primary Manager: ${primaryManager.fullName} (${primaryManager.email}) [ID: EMP-0001]`);
  console.log('Tasks: 0 | Projects: 0 | Sprints: 0 | Boards: 0 | Teams: 0');
  console.log('========================================================================\n');

  await prisma.$disconnect();
}

cleanFakeData().catch((err) => {
  console.error('Cleanup failed:', err);
  prisma.$disconnect();
  process.exit(1);
});
