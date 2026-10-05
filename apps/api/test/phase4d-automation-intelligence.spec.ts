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
import { AutomationService } from '../src/automation/automation.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AskWorkdeskService } from '../src/ask-workdesk/ask-workdesk.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const automationService = new AutomationService(prismaService, auditService, tasksService);
const notificationsService = new NotificationsService(prismaService);
const askWorkdeskService = new AskWorkdeskService(prismaService);

async function runPhase4DAutomationIntelligenceSuite() {
  console.log('================================================================');
  console.log('WORKDESK 2.0 — PHASE 4D AUTOMATION & INTELLIGENCE TEST SUITE');
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

  // Create isolated project
  const projectKey = `P4D-${Date.now().toString().slice(-4)}`;
  const project = await prisma.project.create({
    data: {
      key: projectKey,
      name: 'Phase 4D Automation & Intelligence Project',
      leadId: lead.id,
      members: {
        create: [
          { userId: lead.id, roleInProject: 'LEAD' },
          { userId: employee.id, roleInProject: 'CONTRIBUTOR' },
        ],
      },
    },
  });

  // Create secret project for unauthorized tests
  const secretProject = await prisma.project.create({
    data: {
      key: `DSEC-${Date.now().toString().slice(-4)}`,
      name: 'Phase 4D Secret Project',
      leadId: manager.id,
      members: {
        create: [{ userId: manager.id, roleInProject: 'LEAD' }],
      },
    },
  });

  console.log(`[SETUP] Projects created: ${project.key} (shared), ${secretProject.key} (manager-only)`);

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
    // TEST GROUP 1: AUTOMATION ENGINE & GOVERNED SAFETY
    // -------------------------------------------------------------
    console.log('\n--- 1. Automation Engine & Governed Safety ---');

    // 1.1 Create Automation Rule: When task created with type TASK -> set priority to CRITICAL
    const rule1 = await automationService.createRule(
      {
        projectId: project.id,
        name: 'Auto Critical Priority for High-Impact Tasks',
        description: 'Elevates tasks matching condition',
        eventType: 'TASK_CREATED',
        conditions: { typeEquals: WorkItemType.TASK },
        actions: { actionType: 'SET_PRIORITY', priority: TaskPriority.CRITICAL },
      },
      leadCtx,
    );

    assert(
      rule1.isEnabled && rule1.name === 'Auto Critical Priority for High-Impact Tasks',
      'Lead creates valid automation rule',
    );

    // 1.2 Employee attempting to create automation rule -> Must be FORBIDDEN
    let employeeBlocked = false;
    try {
      await automationService.createRule(
        {
          projectId: project.id,
          name: 'Employee Unauthorized Rule',
          eventType: 'TASK_CREATED',
          conditions: {},
          actions: {},
        },
        employeeCtx,
      );
    } catch (err: any) {
      employeeBlocked = err.status === 403 || err.message?.includes('Employees cannot');
    }
    assert(employeeBlocked, 'Employees strictly forbidden from creating automation rules');

    // 1.3 Trigger Event with Matching Condition
    const targetTask = await tasksService.createTask(
      {
        projectId: project.id,
        type: WorkItemType.TASK,
        title: 'Task for Automation Trigger',
      },
      leadCtx,
    );

    const triggerRes = await automationService.triggerEvent(
      'TASK_CREATED',
      project.id,
      targetTask.id,
      { type: WorkItemType.TASK },
    );

    assert(
      triggerRes.executed === 1 && triggerRes.aborted === 0,
      'Automation event triggers condition match and executes action successfully',
    );

    // Verify task priority was updated by automation
    const updatedTask = await prisma.task.findUnique({ where: { id: targetTask.id } });
    assert(
      updatedTask?.priority === TaskPriority.CRITICAL,
      'Governed domain action updated Task priority via Automation Engine',
    );

    // 1.4 Trigger Event with Non-Matching Condition
    const nonMatchRes = await automationService.triggerEvent(
      'TASK_CREATED',
      project.id,
      targetTask.id,
      { type: WorkItemType.SUBTASK }, // does not match condition
    );
    assert(
      nonMatchRes.executed === 0 && nonMatchRes.aborted === 0,
      'Conditions prevent execution when criteria not met',
    );

    // 1.5 Recursion Safety Limit (Depth >= 2 aborted)
    const recursionRes = await automationService.triggerEvent(
      'TASK_CREATED',
      project.id,
      targetTask.id,
      { type: WorkItemType.TASK },
      2, // depth = 2
    );
    assert(
      recursionRes.executed === 0 && recursionRes.aborted === 1,
      'Maximum recursion depth limit <= 2 strictly enforced (No infinite loops)',
    );

    // 1.6 Rate Limiting Safety (50 executions / project / minute)
    let rateLimited = false;
    for (let i = 0; i < 55; i++) {
      const res = await automationService.triggerEvent(
        'TASK_CREATED',
        project.id,
        targetTask.id,
        { type: WorkItemType.TASK },
      );
      if (res.rateLimited) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Rate limit of 50 executions / project / min strictly enforced');

    // 1.7 Creator Permission Loss & Automatic Rule Deactivation
    const projectPermLoss = await prisma.project.create({
      data: {
        key: `P4DP-${Date.now().toString().slice(-4)}`,
        name: 'Phase 4D Perm Loss Project',
        leadId: manager.id,
      },
    });

    // Create a temporary Lead user
    const tempLead = await prisma.user.create({
      data: {
        email: `templead-${Date.now()}@workdesk.internal`,
        fullName: 'Temporary Automation Lead',
        role: { connect: { code: RoleCode.ROLE_LEAD } },
        approvalStatus: 'APPROVED',
      },
    });

    await prisma.projectMember.create({
      data: {
        projectId: projectPermLoss.id,
        userId: tempLead.id,
        roleInProject: 'LEAD',
      },
    });

    const ruleByTempLead = await automationService.createRule(
      {
        projectId: projectPermLoss.id,
        name: 'Rule To Be Deactivated On Permission Loss',
        eventType: 'TASK_STATUS_CHANGED',
        conditions: {},
        actions: { actionType: 'SET_PRIORITY', priority: TaskPriority.LOW },
      },
      { id: tempLead.id, roleCode: RoleCode.ROLE_LEAD },
    );

    // Deactivate / demote tempLead to Employee
    const empRole = await prisma.role.findUnique({ where: { code: RoleCode.ROLE_EMPLOYEE } });
    await prisma.user.update({
      where: { id: tempLead.id },
      data: { roleId: empRole!.id },
    });

    // Execute event -> should detect permission loss, abort execution, and disable rule
    const permLossRes = await automationService.triggerEvent(
      'TASK_STATUS_CHANGED',
      projectPermLoss.id,
      targetTask.id,
      {},
    );

    const reloadedRule = await prisma.automationRule.findUnique({
      where: { id: ruleByTempLead.id },
    });
    assert(
      reloadedRule?.isEnabled === false,
      'Rule automatically disabled when creator loses required permissions (AUTOMATION_DISABLED_PERMISSION_LOST)',
    );

    // -------------------------------------------------------------
    // TEST GROUP 2: SMART NOTIFICATION DIGESTS
    // -------------------------------------------------------------
    console.log('\n--- 2. Smart Notification Digests ---');

    // Create an overdue task assigned to employee
    const pastDate = new Date(Date.now() - 48 * 3600 * 1000); // 2 days ago
    const overdueTask = await tasksService.createTask(
      {
        projectId: project.id,
        type: WorkItemType.TASK,
        title: 'Overdue Project Task for Digest',
        deadline: pastDate.toISOString(),
      },
      leadCtx,
    );
    await prisma.task.update({
      where: { id: overdueTask.id },
      data: { assigneeId: employee.id },
    });

    // Generate digest for employee
    const digest = await notificationsService.generateDigest(employee.id);

    assert(
      digest.recipientId === employee.id && digest.recipientEmail === employee.email,
      'Notification digest correctly targeted to recipient',
    );
    assert(
      digest.overdueTasks.some((t: any) => t.ticketId === overdueTask.ticketId),
      'Digest correctly includes actionable overdue task assigned to user',
    );
    assert(
      typeof digest.totalActionableItems === 'number',
      'Digest compiles total actionable items summary',
    );

    // -------------------------------------------------------------
    // TEST GROUP 3: ASK WORKDESK (READ-ONLY GROUNDED AI)
    // -------------------------------------------------------------
    console.log('\n--- 3. Ask WorkDesk (Read-Only Grounded AI) ---');

    // 3.1 Reject Mutation Attempt
    const mutationQueryRes = await askWorkdeskService.ask(
      { query: 'Please create task to refactor authentication' },
      employeeCtx,
    );
    assert(
      mutationQueryRes.answer.includes('strictly read-only') &&
        mutationQueryRes.citations.length === 0,
      'Ask WorkDesk explicitly rejects task creation/mutation attempts with zero citations',
    );

    // 3.2 Grounded Ticket Query with Citation
    const ticketQueryRes = await askWorkdeskService.ask(
      { query: `What is the status of ${targetTask.ticketId}?` },
      leadCtx,
    );
    assert(
      ticketQueryRes.citations.length > 0 &&
        ticketQueryRes.citations[0].ticketId === targetTask.ticketId &&
        ticketQueryRes.answer.includes(`[${targetTask.ticketId}]`),
      'Ask WorkDesk cites verified WorkDesk record with grounded factual answer',
    );

    // 3.3 Scope Isolation: Employee queries secret task outside authorized scope
    const secretTask = await tasksService.createTask(
      {
        projectId: secretProject.id,
        type: WorkItemType.TASK,
        title: 'Secret Manager Task',
      },
      managerCtx,
    );

    const secretQueryRes = await askWorkdeskService.ask(
      { query: `What is the status of ${secretTask.ticketId}?` },
      employeeCtx, // Employee is not in secret project
    );
    assert(
      secretQueryRes.answer.includes('Insufficient authorized data') &&
        secretQueryRes.citations.length === 0,
      'Ask WorkDesk prevents data leaks for unauthorized tickets (Returns "Insufficient authorized data.")',
    );

    // 3.4 Manager can query secret task
    const managerQueryRes = await askWorkdeskService.ask(
      { query: `What is the status of ${secretTask.ticketId}?` },
      managerCtx,
    );
    assert(
      managerQueryRes.citations.some((c) => c.ticketId === secretTask.ticketId),
      'Manager successfully queries authorized global records in Ask WorkDesk',
    );

    // 3.5 Deterministic Fallback Verification
    assert(
      ticketQueryRes.isDeterministicFallback === true &&
        mutationQueryRes.isDeterministicFallback === true,
      'Ask WorkDesk provides deterministic grounded fallback when LLM is offline',
    );

    console.log('\n================================================================');
    if (allPassed) {
      console.log('PHASE 4D AUTOMATION & INTELLIGENCE TEST SUITE: ALL PASSED');
    } else {
      console.error('PHASE 4D AUTOMATION & INTELLIGENCE TEST SUITE: FAILURES DETECTED');
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

runPhase4DAutomationIntelligenceSuite();
