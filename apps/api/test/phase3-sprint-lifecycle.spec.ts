import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  SprintStatus,
} from '@workdesk/shared';
import { TasksService } from '../src/tasks/tasks.service';
import { SprintsService } from '../src/sprints/sprints.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const sprintsService = new SprintsService(prismaService, auditService, tasksService);

async function runPhase3SprintLifecycleSuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 3 SPRINT LIFECYCLE & COMMITMENT TEST SUITE');
  console.log('===============================================================\n');

  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });
  if (!manager) throw new Error('Manager not found');
  const managerCtx = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };

  // 1. Create a dedicated project
  const project = await prisma.project.create({
    data: {
      key: `LC-${Date.now().toString().slice(-4)}`,
      name: 'Sprint Lifecycle Verification Project',
    },
  });

  // 2. Create Sprint 1 (PLANNED)
  console.log('[STAGE 1] Sprint Creation & Pre-Start Planning...');
  const sprint1 = await sprintsService.createSprint(
    {
      projectId: project.id,
      name: 'Sprint 1 - Foundations',
      goal: 'Deliver core foundation features',
    },
    managerCtx,
  );
  console.log(`  Created Sprint: ${sprint1.name} (Status: ${sprint1.status})`);
  if (sprint1.status !== SprintStatus.PLANNED) throw new Error('Sprint 1 should be PLANNED');

  // Create 2 planned tasks in Sprint 1
  const task1 = await tasksService.createTask(
    {
      title: 'Planned Feature 1',
      type: WorkItemType.STORY,
      projectId: project.id,
      sprintId: sprint1.id,
      storyPoints: 5,
    },
    managerCtx,
  );
  const task2 = await tasksService.createTask(
    {
      title: 'Planned Feature 2',
      type: WorkItemType.STORY,
      projectId: project.id,
      sprintId: sprint1.id,
      storyPoints: 8,
    },
    managerCtx,
  );
  console.log(`  Added Planned Tasks: ${task1.ticketId} (5 pts), ${task2.ticketId} (8 pts)\n`);

  // 3. Start Sprint 1 -> Generates Commitment Ledger
  console.log('[STAGE 2] Sprint Start & Commitment Snapshotting...');
  const now = new Date();
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const startedSprint1 = await sprintsService.startSprint(
    sprint1.id,
    {
      startDate: now.toISOString(),
      endDate: twoWeeksLater.toISOString(),
    },
    managerCtx,
  );
  console.log(`  Sprint 1 Status: ${startedSprint1.status}`);

  // Query commitments for Sprint 1
  const initialCommitments = await prisma.sprintCommitment.findMany({
    where: { sprintId: sprint1.id },
  });
  console.log(`  SprintCommitment records created: ${initialCommitments.length}`);
  const allPlanned = initialCommitments.every((c) => c.wasPlanned === true);
  console.log(`  All commitments flagged wasPlanned = true: ${allPlanned}`);
  const totalPlannedPoints = initialCommitments.reduce((sum, c) => sum + (c.storyPoints || 0), 0);
  console.log(`  Total committed points: ${totalPlannedPoints} (expected 13)`);
  if (initialCommitments.length !== 2 || !allPlanned || totalPlannedPoints !== 13) {
    throw new Error('Stage 2 failed: Commitment snapshot incorrect');
  }
  console.log('  Commitment Snapshot    : PASSED\n');

  // 4. Mid-Sprint Scope Additions (Unplanned scope tracking)
  console.log('[STAGE 3] Mid-Sprint Unplanned Addition (Scope Creep Tracking)...');
  const task3 = await tasksService.createTask(
    {
      title: 'Unplanned Urgent Bug',
      type: WorkItemType.BUG,
      projectId: project.id,
      storyPoints: 3,
    },
    managerCtx,
  );
  // Add task3 to active sprint
  await sprintsService.addTasksToSprint(sprint1.id, [task3.id], managerCtx);

  const midSprintCommitment = await prisma.sprintCommitment.findUnique({
    where: {
      sprintId_taskId: {
        sprintId: sprint1.id,
        taskId: task3.id,
      },
    },
  });
  console.log(`  Unplanned task added: ${task3.ticketId} (3 pts)`);
  console.log(`  Commitment wasPlanned: ${midSprintCommitment?.wasPlanned} (expected false)`);
  if (!midSprintCommitment || midSprintCommitment.wasPlanned !== false) {
    throw new Error('Stage 3 failed: Unplanned task not properly flagged wasPlanned=false');
  }
  console.log('  Scope Creep Tracking   : PASSED\n');

  // 5. Mid-Sprint Scope Removal
  console.log('[STAGE 4] Mid-Sprint Scope Removal...');
  // Remove task2 from sprint
  await sprintsService.removeTaskFromSprint(sprint1.id, task2.id, managerCtx);

  const task2AfterRemoval = await prisma.task.findUnique({ where: { id: task2.id } });
  const task2Commitment = await prisma.sprintCommitment.findUnique({
    where: {
      sprintId_taskId: {
        sprintId: sprint1.id,
        taskId: task2.id,
      },
    },
  });
  console.log(`  Task 2 current sprintId: ${task2AfterRemoval?.sprintId} (expected null)`);
  console.log(`  Commitment removedAt: ${task2Commitment?.removedAt ? 'Recorded' : 'Missing'}`);
  if (task2AfterRemoval?.sprintId !== null || !task2Commitment?.removedAt) {
    throw new Error('Stage 4 failed: Removed task did not record removedAt in commitment ledger');
  }
  console.log('  Scope Removal Tracking : PASSED\n');

  // 6. Complete task1 (transition to DONE)
  console.log('[STAGE 5] Work Execution & Sprint Completion...');
  await tasksService.transitionTask(task1.ticketId, { targetStatus: WorkItemStatus.IN_PROGRESS }, managerCtx);
  await tasksService.transitionTask(task1.ticketId, { targetStatus: WorkItemStatus.DONE }, managerCtx);

  // Create Sprint 2 for carry-over
  const sprint2 = await sprintsService.createSprint(
    { projectId: project.id, name: 'Sprint 2 - Next Phase' },
    managerCtx,
  );

  // Complete Sprint 1, carrying over incomplete tasks (task3) to sprint2
  const completedSprint1 = await sprintsService.completeSprint(
    sprint1.id,
    {
      incompleteTaskAction: 'MOVE_TO_SPRINT',
      targetSprintId: sprint2.id,
    },
    managerCtx,
  );

  console.log(`  Sprint 1 completed status: ${completedSprint1.status}`);
  const task1AfterComplete = await prisma.task.findUnique({ where: { id: task1.id } });
  const task3AfterComplete = await prisma.task.findUnique({ where: { id: task3.id } });

  console.log(`  Task 1 (Done) sprintId: ${task1AfterComplete?.sprintId} (remains in sprint 1: ${task1AfterComplete?.sprintId === sprint1.id})`);
  console.log(`  Task 3 (Incomplete) carried over to Sprint 2: ${task3AfterComplete?.sprintId === sprint2.id}`);

  if (completedSprint1.status !== SprintStatus.COMPLETED) throw new Error('Sprint 1 not completed');
  if (task1AfterComplete?.sprintId !== sprint1.id) throw new Error('Done task did not remain in sprint 1');
  if (task3AfterComplete?.sprintId !== sprint2.id) throw new Error('Incomplete task did not carry over to sprint 2');

  // Verify historical commitments for Sprint 1 are untouched
  const finalSprint1Commitments = await prisma.sprintCommitment.findMany({
    where: { sprintId: sprint1.id },
  });
  console.log(`  Historical commitment records preserved: ${finalSprint1Commitments.length} records`);
  if (finalSprint1Commitments.length !== 3) {
    throw new Error('Historical commitment records were lost or corrupted');
  }
  console.log('  Carry-over & Ledger    : PASSED\n');

  console.log('===============================================================');
  console.log('ALL PHASE 3 SPRINT LIFECYCLE TESTS PASSED 100%!');
  console.log('===============================================================');
}

runPhase3SprintLifecycleSuite()
  .catch((err) => {
    console.error('Sprint lifecycle suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
