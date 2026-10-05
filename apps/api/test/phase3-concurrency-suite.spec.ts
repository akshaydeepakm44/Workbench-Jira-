import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  WipLimitType,
  SprintStatus,
} from '@workdesk/shared';
import { TasksService } from '../src/tasks/tasks.service';
import { SprintsService } from '../src/sprints/sprints.service';
import { BoardsService } from '../src/boards/boards.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const sprintsService = new SprintsService(prismaService, auditService, tasksService);
const boardsService = new BoardsService(prismaService, auditService, tasksService);

async function runPhase3ConcurrencySuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 3 CONCURRENCY & INTEGRITY TEST SUITE');
  console.log('===============================================================\n');

  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });
  if (!manager) throw new Error('Manager not found');
  const managerCtx = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };

  const project = await prisma.project.findFirst({ where: { key: 'DESK' } });
  if (!project) throw new Error('Project DESK not found');

  // -------------------------------------------------------------------------
  // TEST 1: 10 CONCURRENT REORDERS INTO SAME ADJACENT SLOT
  // -------------------------------------------------------------------------
  console.log('[TEST 1] 10 Concurrent Backlog Reorders into Same Adjacent Slot...');
  // Create Boundary Tasks A and B
  const taskA = await tasksService.createTask(
    { title: 'Boundary Task A', type: WorkItemType.TASK, projectId: project.id },
    managerCtx,
  );
  const taskB = await tasksService.createTask(
    { title: 'Boundary Task B', type: WorkItemType.TASK, projectId: project.id },
    managerCtx,
  );

  // Create 10 floating tasks to concurrently insert between A and B
  const floatingTasks = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      tasksService.createTask(
        { title: `Concurrent Reorder Task ${i + 1}`, type: WorkItemType.TASK, projectId: project.id },
        managerCtx,
      ),
    ),
  );

  // Concurrently reorder all 10 between taskA and taskB
  const reorderResults = await Promise.allSettled(
    floatingTasks.map((t) =>
      tasksService.reorderBacklog(
        project.id,
        {
          ticketId: t.ticketId,
          targetRankAbove: taskA.ticketId,
          targetRankBelow: taskB.ticketId,
        },
        managerCtx,
      ),
    ),
  );

  const reorderSuccess = reorderResults.filter((r) => r.status === 'fulfilled').length;
  const reorderRejected = reorderResults.filter((r) => r.status === 'rejected').length;

  // Query all 10 tasks to verify their assigned ranks
  const updatedFloating = await prisma.task.findMany({
    where: { id: { in: floatingTasks.map((t) => t.id) } },
    select: { ticketId: true, rank: true },
    orderBy: [{ rank: 'asc' }, { ticketId: 'asc' }],
  });

  const uniqueRanks = new Set(updatedFloating.map((t) => t.rank)).size;
  console.log(`  Attempts             : 10`);
  console.log(`  Successful operations: ${reorderSuccess}`);
  console.log(`  Rejected operations  : ${reorderRejected}`);
  console.log(`  Unique ranks assigned: ${uniqueRanks} / 10`);
  const test1Passed = reorderSuccess === 10 && uniqueRanks === 10;
  console.log(
    `  Database invariant   : ${
      test1Passed ? 'PASSED (All 10 succeeded with unique non-colliding LexoRanks)' : 'FAILED'
    }\n`,
  );
  if (!test1Passed) throw new Error('Test 1 failed');

  // -------------------------------------------------------------------------
  // TEST 2: CONCURRENT SPRINT STARTS (ACTIVE SPRINT INVARIANT)
  // -------------------------------------------------------------------------
  console.log('[TEST 2] 10 Concurrent Sprint Starts in Same Scope (Active Sprint Invariant)...');
  // Create an isolated project for sprint concurrency testing
  const sprintProjKey = `SP-${Date.now().toString().slice(-4)}`;
  const sprintProj = await prisma.project.create({
    data: { key: sprintProjKey, name: 'Sprint Race Test Project' },
  });

  // Create 10 sprints in this project, each with 1 task
  const sprints = await Promise.all(
    Array.from({ length: 10 }).map(async (_, i) => {
      const s = await sprintsService.createSprint(
        { projectId: sprintProj.id, name: `Sprint Race Candidate ${i + 1}` },
        managerCtx,
      );
      // Create a task and add to sprint
      const t = await tasksService.createTask(
        { title: `Sprint Race Task ${i + 1}`, projectId: sprintProj.id, sprintId: s.id },
        managerCtx,
      );
      return s;
    }),
  );

  const now = new Date();
  const twoWeeksLater = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Concurrently attempt to start all 10 sprints
  const startResults = await Promise.allSettled(
    sprints.map((s) =>
      sprintsService.startSprint(
        s.id,
        {
          startDate: now.toISOString(),
          endDate: twoWeeksLater.toISOString(),
        },
        managerCtx,
      ),
    ),
  );

  const startSuccess = startResults.filter((r) => r.status === 'fulfilled').length;
  const startRejected = startResults.filter((r) => r.status === 'rejected').length;

  const activeSprintsCount = await prisma.sprint.count({
    where: { projectId: sprintProj.id, status: SprintStatus.ACTIVE },
  });

  console.log(`  Attempts             : 10 concurrent starts`);
  console.log(`  Successful starts    : ${startSuccess}`);
  console.log(`  Rejected (Conflict)  : ${startRejected}`);
  console.log(`  Active sprints in DB : ${activeSprintsCount}`);
  const test2Passed = startSuccess === 1 && startRejected === 9 && activeSprintsCount === 1;
  console.log(
    `  Database invariant   : ${
      test2Passed ? 'PASSED (Single active sprint invariant strictly enforced under race)' : 'FAILED'
    }\n`,
  );
  if (!test2Passed) throw new Error('Test 2 failed');

  // -------------------------------------------------------------------------
  // TEST 3: CONCURRENT MOVES INTO HARD_LIMIT WIP COLUMN
  // -------------------------------------------------------------------------
  console.log('[TEST 3] 10 Concurrent Moves into HARD_LIMIT WIP Column (wipLimit = 1)...');
  // Create dedicated board with Column 1 having HARD_LIMIT = 1
  const wipBoard = await boardsService.createBoard(
    {
      projectId: sprintProj.id,
      name: 'WIP Limit Race Board',
      columns: [
        {
          name: 'Strict WIP Lane',
          orderIndex: 0,
          wipLimit: 1,
          wipLimitType: WipLimitType.HARD_LIMIT,
          mappedStatuses: [WorkItemStatus.IN_PROGRESS],
        },
        {
          name: 'Done',
          orderIndex: 1,
          wipLimit: 0,
          wipLimitType: WipLimitType.WARNING,
          mappedStatuses: [WorkItemStatus.DONE],
        },
      ],
    },
    managerCtx,
  );

  const targetColId = wipBoard.columns[0].id;

  // Create 10 tasks in TODO status
  const wipTasks = await Promise.all(
    Array.from({ length: 10 }).map((_, i) =>
      tasksService.createTask(
        { title: `WIP Target Task ${i + 1}`, projectId: sprintProj.id },
        managerCtx,
      ),
    ),
  );

  // Concurrently attempt to move all 10 into the strict column
  const wipResults = await Promise.allSettled(
    wipTasks.map((t) =>
      boardsService.moveBoardCard(
        wipBoard.id,
        t.ticketId,
        { targetColumnId: targetColId },
        managerCtx,
      ),
    ),
  );

  const wipSuccess = wipResults.filter((r) => r.status === 'fulfilled').length;
  const wipRejected = wipResults.filter((r) => r.status === 'rejected').length;

  const inProgressCount = await prisma.task.count({
    where: { projectId: sprintProj.id, status: WorkItemStatus.IN_PROGRESS },
  });

  console.log(`  Attempts             : 10`);
  console.log(`  Successful moves     : ${wipSuccess}`);
  console.log(`  Rejected (WIP cap)   : ${wipRejected}`);
  console.log(`  Final count in column: ${inProgressCount}`);
  const test3Passed = wipSuccess === 1 && wipRejected === 9 && inProgressCount === 1;
  console.log(
    `  Database invariant   : ${
      test3Passed ? 'PASSED (Hard WIP limit strictly capped at 1 item without race leakage)' : 'FAILED'
    }\n`,
  );
  if (!test3Passed) throw new Error('Test 3 failed');

  // -------------------------------------------------------------------------
  // TEST 4: CONCURRENT SAME-TASK MOVES
  // -------------------------------------------------------------------------
  console.log('[TEST 4] Concurrent Same-Task Moves to Different Positions...');
  const sharedTask = await tasksService.createTask(
    { title: 'Shared Contention Task', projectId: sprintProj.id },
    managerCtx,
  );

  const sameTaskResults = await Promise.allSettled([
    tasksService.reorderBacklog(
      sprintProj.id,
      { ticketId: sharedTask.ticketId, targetRankAbove: taskA.ticketId },
      managerCtx,
    ),
    tasksService.reorderBacklog(
      sprintProj.id,
      { ticketId: sharedTask.ticketId, targetRankBelow: taskB.ticketId },
      managerCtx,
    ),
  ]);

  const sameTaskSuccess = sameTaskResults.filter((r) => r.status === 'fulfilled').length;
  const finalShared = await prisma.task.findUnique({ where: { id: sharedTask.id } });

  console.log(`  Attempts             : 2 simultaneous moves of same task`);
  console.log(`  Successful executions: ${sameTaskSuccess}`);
  console.log(`  Final rank in DB     : ${finalShared?.rank}`);
  const test4Passed = sameTaskSuccess === 2 && finalShared?.rank !== null;
  console.log(
    `  Database invariant   : ${
      test4Passed ? 'PASSED (Serialized cleanly without deadlock or corrupted state)' : 'FAILED'
    }\n`,
  );
  if (!test4Passed) throw new Error('Test 4 failed');

  console.log('===============================================================');
  console.log('ALL PHASE 3 CONCURRENCY TESTS PASSED 100%!');
  console.log('===============================================================');
}

runPhase3ConcurrencySuite()
  .catch((err) => {
    console.error('Concurrency suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
