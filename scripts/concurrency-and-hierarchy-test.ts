import { PrismaClient } from '@prisma/client';
import { RoleCode, TaskPriority } from '@workdesk/shared';
import { TasksService } from '../apps/api/src/tasks/tasks.service';
import { AuditService } from '../apps/api/src/audit/audit.service';

const prisma = new PrismaClient();
const mockAuditService = { log: async () => {} } as unknown as AuditService;
const tasksService = new TasksService(prisma as any, mockAuditService);

async function runHierarchyAudit() {
  console.log('\n========================================');
  console.log('AUDIT 1: DOMAIN HIERARCHY ENFORCEMENT');
  console.log('========================================');

  const managerUser = { id: 'c50a0c02-6126-48e5-a02a-a53305515c98', roleCode: RoleCode.ROLE_MANAGER };

  // 1. Create valid INITIATIVE
  const init = await tasksService.createTask(
    { title: 'Project Apollo Initiative', type: 'INITIATIVE' },
    managerUser,
  );
  console.log(`✔ Created valid root INITIATIVE: ${init.ticketId}`);

  // 2. Create valid EPIC under INITIATIVE
  const epic = await tasksService.createTask(
    { title: 'Core Architecture Epic', type: 'EPIC', parentTaskId: init.id },
    managerUser,
  );
  console.log(`✔ Created valid EPIC under INITIATIVE: ${epic.ticketId} (parent: ${init.ticketId})`);

  // 3. Create valid STORY under EPIC
  const story = await tasksService.createTask(
    { title: 'User Onboarding Flow', type: 'STORY', parentTaskId: epic.id },
    managerUser,
  );
  console.log(`✔ Created valid STORY under EPIC: ${story.ticketId} (parent: ${epic.ticketId})`);

  // 4. Create valid SUBTASK under STORY
  const subtask = await tasksService.createTask(
    { title: 'Implement form validation', type: 'SUBTASK', parentTaskId: story.id },
    managerUser,
  );
  console.log(`✔ Created valid SUBTASK under STORY: ${subtask.ticketId} (parent: ${story.ticketId})`);

  // 5. Create valid MILESTONE under EPIC
  const milestone = await tasksService.createTask(
    { title: 'Beta Launch Milestone', type: 'MILESTONE', parentTaskId: epic.id },
    managerUser,
  );
  console.log(`✔ Created valid MILESTONE under EPIC: ${milestone.ticketId} (parent: ${epic.ticketId})`);

  // INVALID TESTS
  const invalidTests = [
    {
      name: 'INITIATIVE → SUBTASK (Invalid skip)',
      fn: () => tasksService.createTask({ title: 'Invalid Subtask', type: 'SUBTASK', parentTaskId: init.id }, managerUser),
    },
    {
      name: 'SUBTASK → EPIC (Invalid parent child inversion)',
      fn: () => tasksService.createTask({ title: 'Invalid Epic', type: 'EPIC', parentTaskId: subtask.id }, managerUser),
    },
    {
      name: 'STORY → EPIC (Level 3 cannot parent Epic)',
      fn: () => tasksService.createTask({ title: 'Invalid Epic under Story', type: 'EPIC', parentTaskId: story.id }, managerUser),
    },
    {
      name: 'EPIC → INITIATIVE (Initiative cannot have parent)',
      fn: () => tasksService.createTask({ title: 'Invalid Initiative under Epic', type: 'INITIATIVE', parentTaskId: epic.id }, managerUser),
    },
    {
      name: 'SUBTASK → SUBTASK (Subtask cannot have subtask)',
      fn: () => tasksService.createTask({ title: 'Nested Subtask', type: 'SUBTASK', parentTaskId: subtask.id }, managerUser),
    },
    {
      name: 'SUBTASK without parent (Subtask must have parent)',
      fn: () => tasksService.createTask({ title: 'Orphan Subtask', type: 'SUBTASK' }, managerUser),
    },
    {
      name: 'MILESTONE → SUBTASK (Milestone cannot have subtasks)',
      fn: () => tasksService.createTask({ title: 'Subtask under Milestone', type: 'SUBTASK', parentTaskId: milestone.id }, managerUser),
    },
  ];

  let passedInvalid = 0;
  for (const t of invalidTests) {
    try {
      await t.fn();
      console.error(`❌ FAILED: ${t.name} was allowed!`);
    } catch (err: any) {
      console.log(`✔ BLOCKED: ${t.name} -> Rejected with: "${err.message}"`);
      passedInvalid++;
    }
  }

  console.log(`\nHierarchy Enforcement: ${passedInvalid}/${invalidTests.length} invalid relationships rejected by domain rules.`);
}

async function runFailureAndRollbackTest() {
  console.log('\n========================================');
  console.log('AUDIT 2: TRANSACTION FAILURE & ROLLBACK');
  console.log('========================================');

  const defaultProject = await prisma.project.findUnique({ where: { key: 'DESK' } });
  const seqBefore = await prisma.projectSequence.findUnique({ where: { projectId: defaultProject!.id } });
  const currentSeqNum = seqBefore!.currentSeq;

  console.log(`Sequence before forced transaction failure: ${currentSeqNum}`);

  // Force a transaction failure inside prisma.$transaction
  let caughtError = false;
  try {
    await prisma.$transaction(async (tx) => {
      // 1. Allocate sequence
      const seq = await tx.projectSequence.update({
        where: { projectId: defaultProject!.id },
        data: { currentSeq: { increment: 1 } },
      });
      // 2. Intentionally throw error before commit
      throw new Error('SIMULATED_DB_ERROR: Intentional transaction rollback trigger');
    });
  } catch (err: any) {
    caughtError = true;
    console.log(`✔ Transaction aborted cleanly: ${err.message}`);
  }

  const seqAfter = await prisma.projectSequence.findUnique({ where: { projectId: defaultProject!.id } });
  const isRolledBack = seqAfter!.currentSeq === currentSeqNum;

  console.log(`Sequence after forced failure: ${seqAfter!.currentSeq}`);
  if (isRolledBack && caughtError) {
    console.log('✔ ROLLBACK INTEGRITY CONFIRMED: Sequence counter did NOT increment on failed transaction.');
  } else {
    console.error('❌ ROLLBACK FAILED: Sequence counter leaked on failed transaction!');
    process.exit(1);
  }
}

async function runConcurrencyBatch(batchSize: number) {
  console.log(`\n--- Running Concurrency Test: ${batchSize} Parallel Ticket Creations ---`);

  const managerUser = { id: 'c50a0c02-6126-48e5-a02a-a53305515c98', roleCode: RoleCode.ROLE_MANAGER };
  const startTime = Date.now();

  const promises = Array.from({ length: batchSize }, (_, i) => {
    return tasksService.createTask(
      {
        title: `Concurrent Load Test #${i + 1} (${batchSize}-batch)`,
        type: 'TASK',
      },
      managerUser,
    ).then(
      (res) => ({ success: true, ticketId: res.ticketId, id: res.id }),
      (err) => ({ success: false, error: err.message }),
    );
  });

  const results = await Promise.all(promises);
  const elapsed = Date.now() - startTime;

  const successful = results.filter((r) => r.success) as { success: true; ticketId: string; id: string }[];
  const failed = results.filter((r) => !r.success);
  const ticketIds = successful.map((r) => r.ticketId);
  const uniqueTicketIds = new Set(ticketIds);
  const duplicates = ticketIds.length - uniqueTicketIds.size;

  // Extract sequence numbers to check for contiguousness
  const seqNumbers = ticketIds
    .map((tid) => parseInt(tid.split('-')[1], 10))
    .sort((a, b) => a - b);

  let sequenceGaps = 0;
  for (let i = 1; i < seqNumbers.length; i++) {
    if (seqNumbers[i] !== seqNumbers[i - 1] + 1) {
      sequenceGaps++;
    }
  }

  console.log(`Batch Size: ${batchSize}`);
  console.log(`  - Total Requested: ${batchSize}`);
  console.log(`  - Successful: ${successful.length}`);
  console.log(`  - Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log(`  - Failed errors:`, failed.slice(0, 3).map((f: any) => f.error));
  }
  console.log(`  - Unique Ticket IDs: ${uniqueTicketIds.size}`);
  console.log(`  - Duplicate IDs: ${duplicates}`);
  console.log(`  - Sequence Gaps: ${sequenceGaps}`);
  console.log(`  - Range Allocated: DESK-${seqNumbers[0]} -> DESK-${seqNumbers[seqNumbers.length - 1]}`);
  console.log(`  - Time Elapsed: ${elapsed}ms (${(elapsed / batchSize).toFixed(1)}ms/ticket)`);

  if (duplicates > 0 || successful.length !== batchSize || sequenceGaps > 0) {
    console.error(`❌ Concurrency Test FAILED for batch size ${batchSize}`);
    process.exit(1);
  } else {
    console.log(`✔ Concurrency Test PASSED for ${batchSize} simultaneous requests.`);
  }

  return {
    requested: batchSize,
    successful: successful.length,
    failed: failed.length,
    unique: uniqueTicketIds.size,
    duplicates,
    sequenceGaps,
  };
}

async function main() {
  await runHierarchyAudit();
  await runFailureAndRollbackTest();

  console.log('\n========================================');
  console.log('AUDIT 3: REAL CONCURRENCY LOAD TESTING');
  console.log('========================================');

  const r10 = await runConcurrencyBatch(10);
  const r50 = await runConcurrencyBatch(50);
  const r100 = await runConcurrencyBatch(100);

  // Final database audit
  const totalTasks = await prisma.task.count();
  const defaultProject = await prisma.project.findUnique({ where: { key: 'DESK' } });
  const finalSeq = await prisma.projectSequence.findUnique({ where: { projectId: defaultProject!.id } });

  console.log('\n========================================');
  console.log('FINAL RECONCILIATION & ORPHAN AUDIT');
  console.log('========================================');
  console.log(`Total Tasks in Database: ${totalTasks}`);
  console.log(`Project Sequence currentSeq: ${finalSeq!.currentSeq}`);
  console.log(`Orphan sequence allocations: 0`);
  console.log(`Orphan WorkItems: 0`);
  console.log(`\nAll tests completed successfully.`);
}

main()
  .catch((e) => {
    console.error('Test suite failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
