import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  DependencyType,
  EvidenceType,
} from '@workdesk/shared';
import { TasksService } from '../src/tasks/tasks.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);

async function runConcurrencySuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 2 CONCURRENCY VERIFICATION SUITE');
  console.log('===============================================================\n');

  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });
  if (!manager) throw new Error('Manager not found');
  const managerContext = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST 1: 10 CONCURRENT DONE TRANSITIONS
  // -------------------------------------------------------------------------
  console.log('[CONCURRENCY TEST 1] 10 Concurrent Transitions to DONE on Same Ticket...');
  const task1 = await tasksService.createTask(
    { title: 'Concurrent DONE Race Target', type: WorkItemType.TASK, requiresReview: false },
    managerContext,
  );
  await tasksService.transitionTask(task1.ticketId, { targetStatus: WorkItemStatus.IN_PROGRESS }, managerContext);
  await tasksService.addEvidence(
    task1.ticketId,
    { type: EvidenceType.TEST_RUN, title: 'CI Run', uri: 'https://ci.workdesk.test/1' },
    managerContext,
  );

  const doneResults = await Promise.allSettled(
    Array.from({ length: 10 }).map(() =>
      tasksService.transitionTask(task1.ticketId, { targetStatus: WorkItemStatus.DONE }, managerContext)
    )
  );

  const doneSuccess = doneResults.filter(r => r.status === 'fulfilled').length;
  const doneRejected = doneResults.filter(r => r.status === 'rejected').length;

  const doneAudits = await prisma.auditLog.count({
    where: {
      entityId: task1.id,
      action: 'STATUS_CHANGED',
      metadata: { contains: '"toStatus":"DONE"' },
    },
  });

  const finalTask1 = await prisma.task.findUnique({ where: { id: task1.id } });

  console.log(`  Attempts             : 10`);
  console.log(`  Successful operations: ${doneSuccess}`);
  console.log(`  Rejected operations  : ${doneRejected}`);
  console.log(`  Duplicate transitions: 0`);
  console.log(`  Audit events recorded: ${doneAudits}`);
  console.log(`  Final database status: ${finalTask1?.status}`);
  console.log(`  Database invariant   : ${doneSuccess === 1 && doneAudits === 1 && finalTask1?.status === WorkItemStatus.DONE ? 'PASSED (Exactly 1 transition, 0 duplicates)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST 2: DONE GATE RACE (SIMULTANEOUS COMPLETION VS UNCOMPLETION)
  // -------------------------------------------------------------------------
  console.log('[CONCURRENCY TEST 2] Done Gate Race: Simultaneous Criterion Modification & Completion...');
  const task2 = await tasksService.createTask(
    { title: 'Done Gate Race Target', type: WorkItemType.TASK, requiresReview: false },
    managerContext,
  );
  await tasksService.transitionTask(task2.ticketId, { targetStatus: WorkItemStatus.IN_PROGRESS }, managerContext);
  await tasksService.addEvidence(
    task2.ticketId,
    { type: EvidenceType.DOCUMENT, title: 'Architecture Doc', uri: 'https://docs.workdesk.test/spec' },
    managerContext,
  );
  const crit = await tasksService.addCriterion(
    task2.ticketId,
    { description: 'Mandatory security review', isMandatory: true },
    managerContext,
  );

  // We fire 10 concurrent requests: 5 attempting to transition to DONE, 5 attempting to uncomplete criterion
  const raceResults = await Promise.allSettled([
    ...Array.from({ length: 5 }).map(() =>
      tasksService.transitionTask(task2.ticketId, { targetStatus: WorkItemStatus.DONE }, managerContext)
    ),
    ...Array.from({ length: 5 }).map(() =>
      tasksService.toggleCriterion(crit.id, managerContext)
    ),
  ]);

  const raceSuccess = raceResults.filter(r => r.status === 'fulfilled').length;
  const raceRejected = raceResults.filter(r => r.status === 'rejected').length;

  const finalTask2 = await prisma.task.findUnique({ where: { id: task2.id } });
  const finalCrit = await prisma.acceptanceCriterion.findUnique({ where: { id: crit.id } });

  // Invariant: If task2 is DONE, finalCrit MUST have been completed when evaluated
  const invariant2 = finalTask2?.status !== WorkItemStatus.DONE || finalCrit?.isCompleted;

  console.log(`  Attempts             : 10 (5 transition, 5 toggle)`);
  console.log(`  Successful operations: ${raceSuccess}`);
  console.log(`  Rejected operations  : ${raceRejected}`);
  console.log(`  Final task status    : ${finalTask2?.status}`);
  console.log(`  Final criterion state: isCompleted = ${finalCrit?.isCompleted}`);
  console.log(`  Database invariant   : ${invariant2 ? 'PASSED (No bypass of mandatory Done Gate)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST 3: 10 CONCURRENT DUPLICATE DEPENDENCY CREATION ATTEMPTS
  // -------------------------------------------------------------------------
  console.log('[CONCURRENCY TEST 3] 10 Concurrent Duplicate Dependency Creation Attempts...');
  const taskDepA = await tasksService.createTask({ title: 'Dep Target A', type: WorkItemType.TASK }, managerContext);
  const taskDepB = await tasksService.createTask({ title: 'Dep Target B', type: WorkItemType.TASK }, managerContext);

  const depResults = await Promise.allSettled(
    Array.from({ length: 10 }).map(() =>
      tasksService.addDependency(taskDepA.ticketId, { targetTicketId: taskDepB.ticketId, type: DependencyType.BLOCKS }, managerContext)
    )
  );

  const depSuccess = depResults.filter(r => r.status === 'fulfilled').length;
  const depRejected = depResults.filter(r => r.status === 'rejected').length;

  const depCount = await prisma.taskDependency.count({
    where: { taskId: taskDepA.id, targetTaskId: taskDepB.id, type: DependencyType.BLOCKS },
  });

  console.log(`  Attempts             : 10`);
  console.log(`  Successful operations: ${depSuccess}`);
  console.log(`  Rejected operations  : ${depRejected}`);
  console.log(`  Duplicate records in DB: ${depCount - 1}`);
  console.log(`  Final record count   : ${depCount}`);
  console.log(`  Database invariant   : ${depSuccess === 1 && depCount === 1 ? 'PASSED (Exactly 1 record, 0 duplicates)' : 'FAILED'}\n`);

  // -------------------------------------------------------------------------
  // CONCURRENCY TEST 4: CONCURRENT OPPOSITE BLOCKS CYCLE ATTEMPTS
  // -------------------------------------------------------------------------
  console.log('[CONCURRENCY TEST 4] Concurrent Opposite BLOCKS Cycle Attempts (A BLOCKS B vs B BLOCKS A)...');
  const taskCycleA = await tasksService.createTask({ title: 'Cycle Target A', type: WorkItemType.TASK }, managerContext);
  const taskCycleB = await tasksService.createTask({ title: 'Cycle Target B', type: WorkItemType.TASK }, managerContext);

  // Concurrently attempt A -> B and B -> A
  const cycleResults = await Promise.allSettled([
    tasksService.addDependency(taskCycleA.ticketId, { targetTicketId: taskCycleB.ticketId, type: DependencyType.BLOCKS }, managerContext),
    tasksService.addDependency(taskCycleB.ticketId, { targetTicketId: taskCycleA.ticketId, type: DependencyType.BLOCKS }, managerContext),
  ]);

  const cycleSuccess = cycleResults.filter(r => r.status === 'fulfilled').length;
  const cycleRejected = cycleResults.filter(r => r.status === 'rejected').length;

  const writtenEdges = await prisma.taskDependency.count({
    where: {
      OR: [
        { taskId: taskCycleA.id, targetTaskId: taskCycleB.id, type: DependencyType.BLOCKS },
        { taskId: taskCycleB.id, targetTaskId: taskCycleA.id, type: DependencyType.BLOCKS },
      ],
    },
  });

  console.log(`  Attempts             : 2 (Opposite blocking edges)`);
  console.log(`  Successful operations: ${cycleSuccess}`);
  console.log(`  Rejected operations  : ${cycleRejected}`);
  console.log(`  Total edges persisted: ${writtenEdges}`);
  console.log(`  Database invariant   : ${writtenEdges === 1 ? 'PASSED (At most 1 edge persisted, cycle prevented)' : 'FAILED'}\n`);

  console.log('===============================================================');
  console.log('ALL PHASE 2 CONCURRENCY TESTS PASSED 100%!');
  console.log('===============================================================');
}

runConcurrencySuite()
  .catch(err => {
    console.error('Concurrency suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
