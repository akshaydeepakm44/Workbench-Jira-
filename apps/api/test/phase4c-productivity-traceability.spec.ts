import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  TaskPriority,
} from '@workdesk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { TasksService } from '../src/tasks/tasks.service';
import { SprintsService } from '../src/sprints/sprints.service';
import { SearchService } from '../src/search/search.service';
import { BulkService } from '../src/bulk/bulk.service';
import { DecisionsService } from '../src/decisions/decisions.service';
import { StandupsService } from '../src/standups/standups.service';
import { MeetingsService } from '../src/meetings/meetings.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const sprintsService = new SprintsService(prismaService, auditService, tasksService);
const searchService = new SearchService(prismaService);
const bulkService = new BulkService(prismaService, tasksService, sprintsService);
const decisionsService = new DecisionsService(prismaService, auditService);
const standupsService = new StandupsService(prismaService, auditService, tasksService);
const meetingsService = new MeetingsService(prismaService, auditService, tasksService);

async function runPhase4CProductivityTraceabilitySuite() {
  console.log('================================================================');
  console.log('WORKDESK 2.0 — PHASE 4C PRODUCTIVITY & TRACEABILITY TEST SUITE');
  console.log('================================================================\n');

  // Load actors
  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });
  if (!manager) throw new Error('Manager not found');
  const managerCtx = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };

  const lead = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_LEAD } },
  });
  if (!lead) throw new Error('Lead not found');
  const leadCtx = { id: lead.id, roleCode: RoleCode.ROLE_LEAD };

  const employee = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_EMPLOYEE } },
  });
  if (!employee) throw new Error('Employee not found');
  const employeeCtx = { id: employee.id, roleCode: RoleCode.ROLE_EMPLOYEE };

  // Create isolated project for Project A
  const projectKey = `P4C-${Date.now().toString().slice(-4)}`;
  const project = await prisma.project.create({
    data: {
      key: projectKey,
      name: 'Phase 4C Main Project',
      leadId: lead.id,
      members: {
        create: [
          { userId: lead.id, roleInProject: 'LEAD' },
          { userId: employee.id, roleInProject: 'CONTRIBUTOR' },
        ],
      },
    },
  });

  // Create an isolated private project B where employee is NOT a member
  const projectSecret = await prisma.project.create({
    data: {
      key: `SEC-${Date.now().toString().slice(-4)}`,
      name: 'Phase 4C Secret Project',
      leadId: manager.id,
      members: {
        create: [{ userId: manager.id, roleInProject: 'LEAD' }],
      },
    },
  });

  console.log(`[SETUP] Projects created: ${project.key} (shared), ${projectSecret.key} (manager-only)`);

  let allPassed = true;
  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
    } else {
      console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
      allPassed = false;
    }
  }

  try {
    // -------------------------------------------------------------
    // TEST GROUP 1: GLOBAL SEARCH & SCOPE-BASED AUTHORIZATION
    // -------------------------------------------------------------
    console.log('\n--- 1. Global Search & Authorization Scope ---');

    // Create tasks in both projects
    const taskShared = await tasksService.createTask(
      {
        projectId: project.id,
        type: WorkItemType.TASK,
        title: 'Searchable Shared Alpha Task',
        description: 'Contains unique keyword ZenithTargetAlpha',
      },
      leadCtx,
    );

    const taskSecret = await tasksService.createTask(
      {
        projectId: projectSecret.id,
        type: WorkItemType.TASK,
        title: 'Searchable Secret Beta Task',
        description: 'Contains unique keyword ZenithTargetBeta',
      },
      managerCtx,
    );

    // Manager searches ZenithTargetBeta -> should find taskSecret
    const managerSearchResults = await searchService.search(
      'ZenithTargetBeta',
      managerCtx,
    );
    assert(
      managerSearchResults.totalResults > 0 &&
        managerSearchResults.results.some((i) => i.id === taskSecret.id),
      'Manager finds secret task in global search',
    );

    // Employee searches ZenithTargetBeta -> MUST NOT find taskSecret (Pre-query scope authorization)
    const employeeSecretSearchResults = await searchService.search(
      'ZenithTargetBeta',
      employeeCtx,
    );
    assert(
      employeeSecretSearchResults.totalResults === 0 &&
        !employeeSecretSearchResults.results.some((i) => i.id === taskSecret.id),
      'Employee CANNOT find out-of-scope secret task (No data leaks)',
    );

    // Employee searches ZenithTargetAlpha -> finds taskShared
    const employeeSharedSearchResults = await searchService.search(
      'ZenithTargetAlpha',
      employeeCtx,
    );
    assert(
      employeeSharedSearchResults.totalResults > 0 &&
        employeeSharedSearchResults.results.some((i) => i.id === taskShared.id),
      'Employee finds in-scope shared task',
    );

    // Search by Ticket ID exact match
    const ticketIdSearch = await searchService.search(
      taskShared.ticketId,
      employeeCtx,
    );
    assert(
      ticketIdSearch.results.some((i) => i.ticketId === taskShared.ticketId),
      'Exact ticketId search locates record correctly',
    );

    // -------------------------------------------------------------
    // TEST GROUP 2: GOVERNED BULK OPERATIONS
    // -------------------------------------------------------------
    console.log('\n--- 2. Governed Bulk Operations ---');

    // Create 3 tasks in project for bulk tests
    const bulkTask1 = await tasksService.createTask(
      {
        projectId: project.id,
        type: WorkItemType.TASK,
        title: 'Bulk Candidate Task 1',
      },
      leadCtx,
    );

    const bulkTask2 = await tasksService.createTask(
      {
        projectId: project.id,
        type: WorkItemType.TASK,
        title: 'Bulk Candidate Task 2',
      },
      leadCtx,
    );

    const bulkTask3 = await tasksService.createTask(
      {
        projectId: project.id,
        type: WorkItemType.TASK,
        title: 'Bulk Candidate Task 3',
      },
      leadCtx,
    );

    // Test 2.1: Bulk Priority Update
    const bulkPriorityRes = await bulkService.executeBulk(
      {
        action: 'UPDATE_PRIORITY',
        taskIds: [bulkTask1.id, bulkTask2.id],
        payload: { priority: TaskPriority.CRITICAL },
      },
      leadCtx,
    );
    assert(
      bulkPriorityRes.succeededCount === 2 && bulkPriorityRes.failedCount === 0,
      'Bulk UPDATE_PRIORITY succeeds for multiple tasks',
    );

    // Test 2.2: Bulk Assignment
    const bulkAssignRes = await bulkService.executeBulk(
      {
        action: 'ASSIGN',
        taskIds: [bulkTask1.id, bulkTask2.id, bulkTask3.id],
        payload: { assigneeId: employee.id },
      },
      leadCtx,
    );
    assert(
      bulkAssignRes.succeededCount === 3 && bulkAssignRes.failedCount === 0,
      'Bulk ASSIGN successfully assigns tasks to employee',
    );

    // Test 2.3: Governed Bulk Transition with Partial Batch Failures
    // Task 1: Currently TODO -> Transition to IN_PROGRESS (Valid!)
    // Task Secret: In secret project, Lead tries to transition it -> Unauthorized / not in project -> Should FAIL!
    const bulkTransitionRes = await bulkService.executeBulk(
      {
        action: 'TRANSITION',
        taskIds: [bulkTask1.id, bulkTask2.id, taskSecret.id],
        payload: { targetStatus: WorkItemStatus.IN_PROGRESS },
      },
      leadCtx, // Lead is not in secret project
    );

    const task1Result = bulkTransitionRes.results.find((r) => r.taskId === bulkTask1.id);
    const secretResult = bulkTransitionRes.results.find((r) => r.taskId === taskSecret.id);

    assert(
      task1Result?.success === true,
      'Bulk transition allows valid transition (TODO -> IN_PROGRESS)',
    );
    assert(
      secretResult?.success === false,
      'Bulk transition blocks unauthorized project task without failing entire batch',
      secretResult?.reason,
    );
    assert(
      bulkTransitionRes.results.length === 3,
      'Bulk operation returns exact per-item outcome status for every item',
    );

    // Test 2.4: Attempt Invalid Transition in Bulk
    const invalidTransitionRes = await bulkService.executeBulk(
      {
        action: 'TRANSITION',
        taskIds: [bulkTask2.id],
        payload: { targetStatus: WorkItemStatus.APPROVED }, // Cannot jump TODO -> APPROVED
      },
      leadCtx,
    );
    assert(
      invalidTransitionRes.results[0].success === false,
      'Transition Engine rules strictly enforced during bulk operations (No status bypass)',
      invalidTransitionRes.results[0].reason,
    );

    // -------------------------------------------------------------
    // TEST GROUP 3: TRACEABILITY: MEETING -> DECISION -> ACTION ITEM -> TASK
    // -------------------------------------------------------------
    console.log('\n--- 3. Traceability: Meeting -> Decision -> Action Item -> Task ---');

    // 3.1 Create Meeting
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Architecture Review Meeting',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        organizerId: lead.id,
        participants: {
          create: [{ userId: lead.id }, { userId: employee.id }],
        },
      },
    });

    // 3.2 Create Action Item in Meeting
    const actionItem = await prisma.meetingActionItem.create({
      data: {
        meetingId: meeting.id,
        description: 'Implement distributed locking mechanism',
        assigneeId: employee.id,
      },
    });

    // 3.3 Convert Action Item to Task using MeetingsService
    const conversionResult = await meetingsService.convertActionItemToTask(
      meeting.id,
      actionItem.id,
      leadCtx,
    );

    assert(
      !!conversionResult.task && !!conversionResult.task.id,
      'Action item converted to Task successfully',
    );

    // Verify traceability link
    const updatedActionItem = await prisma.meetingActionItem.findUnique({
      where: { id: actionItem.id },
    });
    assert(
      updatedActionItem?.convertedTaskId === conversionResult.task.id,
      'Action Item retains explicit reference to convertedTaskId',
    );

    // -------------------------------------------------------------
    // TEST GROUP 4: TRACEABILITY: STANDUP -> BLOCKER -> TASK
    // -------------------------------------------------------------
    console.log('\n--- 4. Traceability: Standup -> Blocker -> Task ---');

    // 4.1 Create Standup
    const standupDate = `2026-10-${Math.floor(10 + Math.random() * 15)}`;
    const standup = await prisma.standup.create({
      data: {
        standupDate,
        userId: employee.id,
        yesterday: 'Worked on database indexes',
        today: 'Implementing cache layer',
        hasBlockers: true,
      },
    });

    // 4.2 Create Standup Blocker
    const blocker = await prisma.standupBlocker.create({
      data: {
        standupId: standup.id,
        blockerText: 'Redis cluster configuration missing credentials',
      },
    });

    // 4.3 Convert Blocker to Task using StandupsService
    const blockerConversionResult = await standupsService.convertBlockerToTask(
      blocker.id,
      leadCtx,
    );

    assert(
      !!blockerConversionResult.task && !!blockerConversionResult.task.id,
      'Standup blocker converted to Task successfully',
    );

    const updatedBlocker = await prisma.standupBlocker.findUnique({
      where: { id: blocker.id },
    });
    assert(
      updatedBlocker?.convertedTaskId === blockerConversionResult.task.id,
      'Standup blocker retains 1:1 reference to convertedTaskId',
    );

    // -------------------------------------------------------------
    // TEST GROUP 5: PROJECT DECISION LOG & AUDIT
    // -------------------------------------------------------------
    console.log('\n--- 5. Project Decision Log & Traceability ---');

    // 5.1 Create Decision linked to Project and Meeting
    const decision = await decisionsService.createDecision(
      {
        projectId: project.id,
        meetingId: meeting.id,
        title: 'Adopt PostgreSQL JSONB for Dynamic Attributes',
        summary: 'Team agreed to use JSONB columns with typed Prisma schema models',
        rationale: 'Avoids premature table proliferation while maintaining ACID guarantees',
        status: 'APPROVED',
      },
      leadCtx,
    );

    assert(
      decision.title === 'Adopt PostgreSQL JSONB for Dynamic Attributes' &&
        decision.meetingId === meeting.id,
      'Project Decision successfully logged with meeting link',
    );

    // 5.2 Fetch Decisions by Project
    const projectDecisions = await decisionsService.getDecisions(
      project.id,
      employeeCtx,
    );
    assert(
      projectDecisions.some((d) => d.id === decision.id),
      'Project decisions retrieved by authorized team member',
    );

    // 5.3 Verify Decision Searchability in Global Search
    const decisionSearchResults = await searchService.search(
      'Dynamic Attributes',
      employeeCtx,
    );
    assert(
      decisionSearchResults.results.some(
        (item) => item.entityType === 'DECISION' && item.id === decision.id,
      ),
      'Project Decisions are indexed and discoverable in scoped Global Search',
    );

    console.log('\n================================================================');
    if (allPassed) {
      console.log('PHASE 4C PRODUCTIVITY & TRACEABILITY TEST SUITE: ALL PASSED');
    } else {
      console.error('PHASE 4C PRODUCTIVITY & TRACEABILITY TEST SUITE: FAILURES DETECTED');
      process.exitCode = 1;
    }
    console.log('================================================================\n');
  } catch (err) {
    console.error('Test execution aborted due to unexpected error:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runPhase4CProductivityTraceabilitySuite();
