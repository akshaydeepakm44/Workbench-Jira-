import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  DependencyType,
  EvidenceType,
  TaskPriority,
} from '@workdesk/shared';
import { TasksService } from '../src/tasks/tasks.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);

async function runPhase2Tests() {
  console.log('====================================================');
  console.log('WORKDESK 2.0 — PHASE 2 ENGINE & DONE GATE TEST SUITE');
  console.log('====================================================\n');

  // Load test users
  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
    include: { role: true },
  });
  if (!manager) throw new Error('Manager user not found');

  const employee = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_EMPLOYEE } },
    include: { role: true },
  });
  if (!employee) throw new Error('Employee user not found');

  const managerContext = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };
  const employeeContext = { id: employee.id, roleCode: RoleCode.ROLE_EMPLOYEE };

  // -------------------------------------------------------------------------
  // TEST SUITE 1: CANONICAL HIERARCHY VALIDATION (ALL 10 CONCRETE TYPES)
  // -------------------------------------------------------------------------
  console.log('[TEST 1] Canonical Hierarchy Placement & Parent-Child Rules...');

  // 1.1 INITIATIVE must be root (no parent)
  tasksService.validateHierarchy(WorkItemType.INITIATIVE, undefined);
  try {
    tasksService.validateHierarchy(WorkItemType.INITIATIVE, WorkItemType.EPIC);
    throw new Error('FAIL: INITIATIVE with parent should be rejected');
  } catch (err: any) {
    if (!err.message?.includes('INITIATIVE is a root item')) throw err;
  }
  console.log('  ✓ INITIATIVE root placement validated');

  // 1.2 EPIC must have INITIATIVE parent
  tasksService.validateHierarchy(WorkItemType.EPIC, WorkItemType.INITIATIVE);
  try {
    tasksService.validateHierarchy(WorkItemType.EPIC, undefined);
    throw new Error('FAIL: Orphan EPIC should be rejected');
  } catch (err: any) {
    if (!err.message?.includes('EPIC must have an INITIATIVE as its parent')) throw err;
  }
  try {
    tasksService.validateHierarchy(WorkItemType.EPIC, WorkItemType.TASK);
    throw new Error('FAIL: EPIC under TASK should be rejected');
  } catch (err: any) {
    if (!err.message?.includes('EPIC can only have an INITIATIVE')) throw err;
  }
  console.log('  ✓ EPIC strict INITIATIVE parent validated');

  // 1.3 Level-3 items must have EPIC parent
  const level3Types = [
    WorkItemType.STORY,
    WorkItemType.TASK,
    WorkItemType.BUG,
    WorkItemType.REQUEST,
    WorkItemType.IMPROVEMENT,
    WorkItemType.ACTION_ITEM,
  ];
  for (const t of level3Types) {
    tasksService.validateHierarchy(t, WorkItemType.EPIC);
    try {
      tasksService.validateHierarchy(t, WorkItemType.INITIATIVE);
      throw new Error(`FAIL: ${t} directly under INITIATIVE should be rejected`);
    } catch (err: any) {
      if (!err.message?.includes('can only have an EPIC as parent')) throw err;
    }
  }
  console.log('  ✓ Level-3 types strict EPIC parent validated');

  // 1.4 SUBTASK must have Level-3 parent
  tasksService.validateHierarchy(WorkItemType.SUBTASK, WorkItemType.TASK);
  tasksService.validateHierarchy(WorkItemType.SUBTASK, WorkItemType.BUG);
  tasksService.validateHierarchy(WorkItemType.SUBTASK, WorkItemType.STORY);
  try {
    tasksService.validateHierarchy(WorkItemType.SUBTASK, WorkItemType.EPIC);
    throw new Error('FAIL: SUBTASK directly under EPIC should be rejected');
  } catch (err: any) {
    if (!err.message?.includes('SUBTASK can only have a Level-3 item')) throw err;
  }
  try {
    tasksService.validateHierarchy(WorkItemType.SUBTASK, WorkItemType.SUBTASK);
    throw new Error('FAIL: SUBTASK under SUBTASK should be rejected');
  } catch (err: any) {
    if (!err.message?.includes('SUBTASK can only have a Level-3 item')) throw err;
  }
  console.log('  ✓ SUBTASK strict Level-3 parent validated');

  // 1.5 MILESTONE placement
  tasksService.validateHierarchy(WorkItemType.MILESTONE, WorkItemType.INITIATIVE);
  tasksService.validateHierarchy(WorkItemType.MILESTONE, WorkItemType.EPIC);
  try {
    tasksService.validateHierarchy(WorkItemType.MILESTONE, WorkItemType.TASK);
    throw new Error('FAIL: MILESTONE under TASK should be rejected');
  } catch (err: any) {
    if (!err.message?.includes('MILESTONE can only have an INITIATIVE or EPIC')) throw err;
  }
  console.log('  ✓ MILESTONE placement validated');

  // -------------------------------------------------------------------------
  // TEST SUITE 2: CREATION & ATOMIC IDENTITY
  // -------------------------------------------------------------------------
  console.log('\n[TEST 2] WorkItem Creation with Canonical Identity...');
  const initiative = await tasksService.createTask(
    { title: 'Core Q4 Initiative', type: WorkItemType.INITIATIVE },
    managerContext,
  );
  console.log(`  ✓ Created INITIATIVE: ${initiative.ticketId}`);

  const epic = await tasksService.createTask(
    { title: 'Auth Subsystem Modernization', type: WorkItemType.EPIC, parentTaskId: initiative.id },
    managerContext,
  );
  console.log(`  ✓ Created EPIC: ${epic.ticketId} under ${initiative.ticketId}`);

  const taskItem = await tasksService.createTask(
    {
      title: 'Enforce JWT Refresh Handshake',
      type: WorkItemType.TASK,
      parentTaskId: epic.id,
      assigneeId: employee.id,
      requiresReview: true,
    },
    managerContext,
  );
  console.log(`  ✓ Created TASK: ${taskItem.ticketId} under ${epic.ticketId} assigned to Employee`);

  // -------------------------------------------------------------------------
  // TEST SUITE 3: PATCH BOUNDARY PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n[TEST 3] PATCH Boundary Protection...');
  try {
    await tasksService.updateTask(
      taskItem.ticketId,
      { status: WorkItemStatus.DONE } as any,
      managerContext,
    );
    throw new Error('FAIL: Status in generic PATCH must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('Status mutation must be performed via /transition')) throw err;
    console.log('  ✓ PATCH /tasks rejects status mutation');
  }

  try {
    await tasksService.updateTask(
      taskItem.ticketId,
      { parentTaskId: initiative.id } as any,
      managerContext,
    );
    throw new Error('FAIL: parentTaskId in generic PATCH must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('Parent mutation must be performed via /reparent')) throw err;
    console.log('  ✓ PATCH /tasks rejects parent mutation');
  }

  // Actual hours validation
  try {
    await tasksService.updateTask(
      taskItem.ticketId,
      { actualHours: -5 },
      managerContext,
    );
    throw new Error('FAIL: Negative actualHours must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('actualHours must be a non-negative integer')) throw err;
    console.log('  ✓ PATCH /tasks validates actualHours non-negative boundary');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 4: CANONICAL STATUS TRANSITIONS & REVIEW GATE
  // -------------------------------------------------------------------------
  console.log('\n[TEST 4] Status State Machine & Review Invariants...');

  // Start work: TODO -> IN_PROGRESS
  const started = await tasksService.transitionTask(
    taskItem.ticketId,
    { targetStatus: WorkItemStatus.IN_PROGRESS },
    employeeContext,
  );
  if (started.status !== WorkItemStatus.IN_PROGRESS) throw new Error('FAIL: Expected IN_PROGRESS');
  console.log('  ✓ Valid transition: TODO -> IN_PROGRESS');

  // Attempt direct jump IN_PROGRESS -> DONE on review-required item (must be rejected)
  try {
    await tasksService.transitionTask(
      taskItem.ticketId,
      { targetStatus: WorkItemStatus.DONE },
      employeeContext,
    );
    throw new Error('FAIL: Should reject transition to DONE when review is required');
  } catch (err: any) {
    if (!err.message?.includes('requires review and must be APPROVED first')) throw err;
    console.log('  ✓ Blocked direct completion: review gate enforced');
  }

  // Transition to IN_REVIEW
  const inReview = await tasksService.transitionTask(
    taskItem.ticketId,
    { targetStatus: WorkItemStatus.IN_REVIEW },
    employeeContext,
  );
  if (inReview.status !== WorkItemStatus.IN_REVIEW) throw new Error('FAIL: Expected IN_REVIEW');
  console.log('  ✓ Valid transition: IN_PROGRESS -> IN_REVIEW');

  // Employee attempting self-approval (must be rejected)
  try {
    await tasksService.transitionTask(
      taskItem.ticketId,
      { targetStatus: WorkItemStatus.APPROVED },
      employeeContext,
    );
    throw new Error('FAIL: Employee must not self-approve');
  } catch (err: any) {
    if (!err.message?.includes('Only Leads and Managers can review and approve')) throw err;
    console.log('  ✓ Employee self-approval rejected');
  }

  // Manager approves review: IN_REVIEW -> APPROVED
  const approved = await tasksService.transitionTask(
    taskItem.ticketId,
    { targetStatus: WorkItemStatus.APPROVED, comment: 'Code review passed cleanly' },
    managerContext,
  );
  if (approved.status !== WorkItemStatus.APPROVED) throw new Error('FAIL: Expected APPROVED');
  console.log('  ✓ Manager approved review: IN_REVIEW -> APPROVED');

  // -------------------------------------------------------------------------
  // TEST SUITE 5: SERVER-SIDE DONE GATE
  // -------------------------------------------------------------------------
  console.log('\n[TEST 5] Authoritative Server-Side Done Gate...');

  // Add 1 mandatory acceptance criterion and 1 required guidance point
  const criterion = await tasksService.addCriterion(
    taskItem.ticketId,
    { description: 'Verify refresh token rotation in database', isMandatory: true },
    managerContext,
  );
  console.log(`  ✓ Added mandatory acceptance criterion: "${criterion.description}"`);

  const guidance = await tasksService.addGuidancePoint(
    taskItem.ticketId,
    'Ensure timing-safe HMAC equality check',
    true,
    managerContext,
  );
  console.log(`  ✓ Added required guidance directive: "${guidance.content}"`);

  // Attempt transition to DONE: must fail Done Gate due to incomplete criteria, guidance, and evidence
  try {
    await tasksService.transitionTask(
      taskItem.ticketId,
      { targetStatus: WorkItemStatus.DONE },
      managerContext,
    );
    throw new Error('FAIL: Done Gate must reject completion');
  } catch (err: any) {
    const errors = err.response?.outstandingRequirements || [];
    console.log('  ✓ Done Gate rejected with explicit checklist:');
    for (const e of errors) {
      console.log(`     • ${e}`);
    }
    if (errors.length < 3) {
      throw new Error('FAIL: Expected at least 3 outstanding requirements in Done Gate');
    }
  }

  // Satisfy Acceptance Criterion
  await tasksService.toggleCriterion(criterion.id, employeeContext);
  console.log('  ✓ Completed mandatory acceptance criterion');

  // Satisfy Guidance Point
  await tasksService.toggleGuidancePoint(guidance.id, employeeContext);
  console.log('  ✓ Completed required guidance point');

  // Still failing due to missing evidence
  try {
    await tasksService.transitionTask(
      taskItem.ticketId,
      { targetStatus: WorkItemStatus.DONE },
      managerContext,
    );
    throw new Error('FAIL: Done Gate must still require evidence for Level-3 task');
  } catch (err: any) {
    const errors = err.response?.outstandingRequirements || [];
    if (!errors.some((e: string) => e.includes('Completion evidence required'))) {
      throw new Error('FAIL: Missing evidence error not raised');
    }
    console.log('  ✓ Done Gate rejected: Completion evidence required');
  }

  // Attach Work Evidence
  const evidence = await tasksService.addEvidence(
    taskItem.ticketId,
    {
      type: EvidenceType.PULL_REQUEST,
      title: 'PR #108 - JWT Handshake Rotation',
      uri: 'https://github.com/datai2i/workdesk/pull/108',
      notes: 'Passes all unit and integration tests',
    },
    employeeContext,
  );
  console.log(`  ✓ Attached completion evidence: ${evidence.title} (${evidence.uri})`);

  // Now Done Gate should succeed!
  const completed = await tasksService.transitionTask(
    taskItem.ticketId,
    { targetStatus: WorkItemStatus.DONE },
    managerContext,
  );
  if (completed.status !== WorkItemStatus.DONE) throw new Error('FAIL: Expected DONE status');
  console.log('  ✓ Done Gate PASSED: Work item transitioned to DONE!');

  // -------------------------------------------------------------------------
  // TEST SUITE 6: DEPENDENCIES & DFS CYCLE DETECTION
  // -------------------------------------------------------------------------
  console.log('\n[TEST 6] Dependencies & DFS Cycle Detection...');
  const taskA = await tasksService.createTask({ title: 'Task A (Dependency Test)', type: WorkItemType.TASK }, managerContext);
  const taskB = await tasksService.createTask({ title: 'Task B (Dependency Test)', type: WorkItemType.TASK }, managerContext);
  const taskC = await tasksService.createTask({ title: 'Task C (Dependency Test)', type: WorkItemType.TASK }, managerContext);

  // Self-dependency rejection
  try {
    await tasksService.addDependency(taskA.ticketId, { targetTicketId: taskA.ticketId, type: DependencyType.BLOCKS }, managerContext);
    throw new Error('FAIL: Self dependency must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('cannot depend on itself')) throw err;
    console.log('  ✓ Self-dependency rejected');
  }

  // A BLOCKS B
  await tasksService.addDependency(taskA.ticketId, { targetTicketId: taskB.ticketId, type: DependencyType.BLOCKS }, managerContext);
  console.log(`  ✓ Linked: ${taskA.ticketId} BLOCKS ${taskB.ticketId}`);

  // Duplicate rejection
  try {
    await tasksService.addDependency(taskA.ticketId, { targetTicketId: taskB.ticketId, type: DependencyType.BLOCKS }, managerContext);
    throw new Error('FAIL: Duplicate dependency must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('relationship already exists')) throw err;
    console.log('  ✓ Duplicate dependency rejected');
  }

  // Direct cycle: B BLOCKS A (must be rejected)
  try {
    await tasksService.addDependency(taskB.ticketId, { targetTicketId: taskA.ticketId, type: DependencyType.BLOCKS }, managerContext);
    throw new Error('FAIL: Direct cycle B -> A must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('Circular blocking dependency detected')) throw err;
    console.log('  ✓ Direct cycle B -> A rejected');
  }

  // Transitive cycle: B BLOCKS C, then C BLOCKS A (must be rejected)
  await tasksService.addDependency(taskB.ticketId, { targetTicketId: taskC.ticketId, type: DependencyType.BLOCKS }, managerContext);
  console.log(`  ✓ Linked: ${taskB.ticketId} BLOCKS ${taskC.ticketId}`);

  try {
    await tasksService.addDependency(taskC.ticketId, { targetTicketId: taskA.ticketId, type: DependencyType.BLOCKS }, managerContext);
    throw new Error('FAIL: Transitive cycle C -> A must be rejected');
  } catch (err: any) {
    if (!err.message?.includes('Circular blocking dependency detected')) throw err;
    console.log('  ✓ Transitive cycle C -> A rejected via DFS cycle detection');
  }

  // -------------------------------------------------------------------------
  // TEST SUITE 7: REPARENTING & CIRCULAR ANCESTRY DETECTION
  // -------------------------------------------------------------------------
  console.log('\n[TEST 7] Reparenting & Circular Ancestry...');
  const epic2 = await tasksService.createTask(
    { title: 'Billing Epic', type: WorkItemType.EPIC, parentTaskId: initiative.id },
    managerContext,
  );
  // Reparent taskA from default/root to epic2
  const reparented = await tasksService.reparentTask(taskA.ticketId, epic2.ticketId, managerContext);
  if (reparented.parentTaskId !== epic2.id) throw new Error('FAIL: Expected reparented parentId');
  console.log(`  ✓ Reparented ${taskA.ticketId} to ${epic2.ticketId}`);

  // -------------------------------------------------------------------------
  // TEST SUITE 8: CONCURRENCY INVARIANTS
  // -------------------------------------------------------------------------
  console.log('\n[TEST 8] Concurrency Invariants & Transition Race...');
  // Create an item ready for completion
  const concurrencyTask = await tasksService.createTask(
    { title: 'Concurrent Race Test', type: WorkItemType.TASK, requiresReview: false },
    managerContext,
  );
  await tasksService.transitionTask(concurrencyTask.ticketId, { targetStatus: WorkItemStatus.IN_PROGRESS }, managerContext);
  await tasksService.addEvidence(
    concurrencyTask.ticketId,
    { type: EvidenceType.TEST_RUN, title: 'CI Run', uri: 'https://ci.workdesk.internal/run/1' },
    managerContext,
  );

  // Fire 10 simultaneous requests attempting to transition to DONE
  console.log('  Firing 10 concurrent requests to transition to DONE...');
  const results = await Promise.allSettled(
    Array.from({ length: 10 }).map(() =>
      tasksService.transitionTask(
        concurrencyTask.ticketId,
        { targetStatus: WorkItemStatus.DONE },
        managerContext,
      ),
    ),
  );

  const fulfilled = results.filter((r) => r.status === 'fulfilled');
  const rejected = results.filter((r) => r.status === 'rejected');

  console.log(`  Concurrent results: ${fulfilled.length} succeeded, ${rejected.length} rejected`);
  if (fulfilled.length !== 1) {
    throw new Error(`FAIL: Invariant violated! Expected exactly 1 transition to succeed, got ${fulfilled.length}`);
  }

  // Verify exactly 1 STATUS_CHANGED audit event was written for this transition
  const statusAuditLogs = await prisma.auditLog.findMany({
    where: {
      entityId: concurrencyTask.id,
      action: 'STATUS_CHANGED',
      metadata: { contains: '"toStatus":"DONE"' },
    },
  });
  console.log(`  Audit events written for DONE transition: ${statusAuditLogs.length}`);
  if (statusAuditLogs.length !== 1) {
    throw new Error(`FAIL: Expected exactly 1 audit event for DONE transition, got ${statusAuditLogs.length}`);
  }
  console.log('  ✓ Concurrency invariant verified: exactly 1 success, 0 duplicate transitions, 0 duplicate audits!');

  console.log('\n====================================================');
  console.log('ALL PHASE 2 ENGINE & DONE GATE TESTS PASSED 100%!');
  console.log('====================================================');
}

runPhase2Tests()
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
