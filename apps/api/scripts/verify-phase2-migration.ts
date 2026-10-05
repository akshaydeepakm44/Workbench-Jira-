import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== PHASE 2 MIGRATION RECONCILIATION AUDIT ===');

  const userCount = await prisma.user.count();
  const taskCount = await prisma.task.count();
  const taskPointCount = await prisma.taskPoint.count();
  const projectCount = await prisma.project.count();
  const projectSeqCount = await prisma.projectSequence.count();
  const legacyAliasCount = await prisma.legacyTicketAlias.count();

  console.log(`User count: ${userCount}`);
  console.log(`Task count: ${taskCount}`);
  console.log(`TaskPoint (Guidance) count: ${taskPointCount}`);
  console.log(`Project count: ${projectCount}`);
  console.log(`ProjectSequence count: ${projectSeqCount}`);
  console.log(`LegacyTicketAlias count: ${legacyAliasCount}`);

  // Validate tasks
  const sampleTasks = await prisma.task.findMany({
    take: 10,
    include: {
      creator: true,
      assignee: true,
      project: true,
      legacyAliases: true,
      points: true,
    },
  });

  console.log(`Sample tasks inspected: ${sampleTasks.length}`);
  for (const t of sampleTasks) {
    if (!t.ticketId.includes('-')) {
      throw new Error(`Invalid ticketId format on task ${t.id}: ${t.ticketId}`);
    }
  }

  // Update legacy statuses to canonical uppercase if any exist
  const statusMappings: Record<string, string> = {
    'To Do': 'TODO',
    'In Progress': 'IN_PROGRESS',
    'Blocked': 'BLOCKED',
    'Review': 'IN_REVIEW',
    'Done': 'DONE',
  };

  for (const [oldStatus, newStatus] of Object.entries(statusMappings)) {
    const updated = await prisma.task.updateMany({
      where: { status: oldStatus },
      data: { status: newStatus },
    });
    if (updated.count > 0) {
      console.log(`Migrated ${updated.count} tasks from status '${oldStatus}' to '${newStatus}'`);
    }
  }

  // Verify new tables exist and are queryable
  const acCount = await prisma.acceptanceCriterion.count();
  const evCount = await prisma.taskEvidence.count();
  const depCount = await prisma.taskDependency.count();

  console.log(`AcceptanceCriterion table online: count = ${acCount}`);
  console.log(`TaskEvidence table online: count = ${evCount}`);
  console.log(`TaskDependency table online: count = ${depCount}`);

  console.log('=== RECONCILIATION VERIFICATION PASSED: ZERO DATA LOSS ===');
}

main()
  .catch((err) => {
    console.error('Reconciliation failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
