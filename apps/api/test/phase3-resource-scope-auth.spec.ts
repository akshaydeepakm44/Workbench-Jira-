import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  BoardType,
  WipLimitType,
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

async function runPhase3AuthSuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 3 RESOURCE-SCOPE & GOVERNANCE TEST SUITE');
  console.log('===============================================================\n');

  // Fetch users for each role
  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });
  const lead = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_LEAD } },
  });
  const employee = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_EMPLOYEE } },
  });

  if (!manager || !lead || !employee) {
    throw new Error('Required test users (Manager, Lead, Employee) not found in DB');
  }

  const managerCtx = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };
  const leadCtx = { id: lead.id, roleCode: RoleCode.ROLE_LEAD };
  const employeeCtx = { id: employee.id, roleCode: RoleCode.ROLE_EMPLOYEE };

  // 1. Create an isolated private project with NO members
  const privateProj = await prisma.project.create({
    data: {
      key: `PVT-${Date.now().toString().slice(-4)}`,
      name: 'Private Isolated Project',
    },
  });

  // Create a sprint and board in the private project
  const pvtSprint = await sprintsService.createSprint(
    { projectId: privateProj.id, name: 'Private Sprint' },
    managerCtx,
  );
  const pvtBoard = await boardsService.createBoard(
    { projectId: privateProj.id, name: 'Private Board' },
    managerCtx,
  );
  const pvtTask = await tasksService.createTask(
    {
      title: 'Private Confidential Task',
      type: WorkItemType.TASK,
      projectId: privateProj.id,
      requiresReview: true,
    },
    managerCtx,
  );

  console.log('[TEST 1] Strict 404 Resource Hiding for Out-of-Scope Employee & Lead...');
  let employeeBacklog404 = false;
  try {
    await tasksService.getProjectBacklog(privateProj.id, employeeCtx);
  } catch (err: any) {
    employeeBacklog404 = err.status === 404 || err.message?.includes('not found');
  }

  let employeeSprint404 = false;
  try {
    await sprintsService.getSprintById(pvtSprint.id, employeeCtx);
  } catch (err: any) {
    employeeSprint404 = err.status === 404 || err.message?.includes('not found');
  }

  let employeeBoard404 = false;
  try {
    await boardsService.getBoardTasks(pvtBoard.id, {}, employeeCtx);
  } catch (err: any) {
    employeeBoard404 = err.status === 404 || err.message?.includes('not found');
  }

  let leadBacklog404 = false;
  try {
    await tasksService.getProjectBacklog(privateProj.id, leadCtx);
  } catch (err: any) {
    leadBacklog404 = err.status === 404 || err.message?.includes('not found');
  }

  console.log(`  Employee Backlog Query : ${employeeBacklog404 ? '404 NOT FOUND (PASSED)' : 'LEAKED'}`);
  console.log(`  Employee Sprint Query  : ${employeeSprint404 ? '404 NOT FOUND (PASSED)' : 'LEAKED'}`);
  console.log(`  Employee Board Query   : ${employeeBoard404 ? '404 NOT FOUND (PASSED)' : 'LEAKED'}`);
  console.log(`  Lead Out-of-Scope Query: ${leadBacklog404 ? '404 NOT FOUND (PASSED)' : 'LEAKED'}`);

  const test1Passed = employeeBacklog404 && employeeSprint404 && employeeBoard404 && leadBacklog404;
  if (!test1Passed) throw new Error('Test 1 failed: Out-of-scope resources did not return 404');
  console.log('  Security Verification  : PASSED (Zero data leakage to unassigned users)\n');

  console.log('[TEST 2] Employee In-Scope Access vs Mutation Restrictions...');
  // Add Employee to private project
  await prisma.projectMember.create({
    data: {
      projectId: privateProj.id,
      userId: employee.id,
      roleInProject: 'CONTRIBUTOR',
    },
  });

  // Employee can now read backlog and board
  const empBacklog = await tasksService.getProjectBacklog(privateProj.id, employeeCtx);
  const empBoard = await boardsService.getBoardTasks(pvtBoard.id, {}, employeeCtx);

  console.log(`  In-scope Backlog Read : ${empBacklog.items.length >= 1 ? 'ALLOWED (PASSED)' : 'FAILED'}`);
  console.log(`  In-scope Board Read   : ${empBoard.columns.length > 0 ? 'ALLOWED (PASSED)' : 'FAILED'}`);

  // Employee is FORBIDDEN from reordering backlog or creating sprints
  let empReorderForbidden = false;
  try {
    await tasksService.reorderBacklog(privateProj.id, { ticketId: pvtTask.ticketId }, employeeCtx);
  } catch (err: any) {
    empReorderForbidden = err.status === 403 || err.message?.includes('Leads and Managers');
  }

  let empSprintCreateForbidden = false;
  try {
    await sprintsService.createSprint({ projectId: privateProj.id, name: 'Forbidden Sprint' }, employeeCtx);
  } catch (err: any) {
    empSprintCreateForbidden = err.status === 403 || err.message?.includes('Leads and Managers');
  }

  console.log(`  Employee Reorder Backlog: ${empReorderForbidden ? '403 FORBIDDEN (PASSED)' : 'ALLOWED (FAIL)'}`);
  console.log(`  Employee Create Sprint : ${empSprintCreateForbidden ? '403 FORBIDDEN (PASSED)' : 'ALLOWED (FAIL)'}`);

  const test2Passed = empBacklog.items.length >= 1 && empReorderForbidden && empSprintCreateForbidden;
  if (!test2Passed) throw new Error('Test 2 failed');
  console.log('  RBAC Verification      : PASSED (Fine-grained capability enforcement verified)\n');

  console.log('[TEST 3] Manager Global Scope Access...');
  const mgrBacklog = await tasksService.getProjectBacklog(privateProj.id, managerCtx);
  const mgrSprint = await sprintsService.getSprintById(pvtSprint.id, managerCtx);
  const mgrBoard = await boardsService.getBoardTasks(pvtBoard.id, {}, managerCtx);

  const test3Passed = mgrBacklog.items.length >= 1 && mgrSprint.id === pvtSprint.id && mgrBoard.columns.length > 0;
  console.log(`  Manager Backlog Read  : ${test3Passed ? 'ALLOWED (PASSED)' : 'FAILED'}`);
  console.log(`  Manager Sprint Read   : ${test3Passed ? 'ALLOWED (PASSED)' : 'FAILED'}`);
  console.log(`  Manager Board Read    : ${test3Passed ? 'ALLOWED (PASSED)' : 'FAILED'}`);
  if (!test3Passed) throw new Error('Test 3 failed: Manager was denied global access');
  console.log('  Manager Verification   : PASSED (Full administrative governance verified)\n');

  console.log('[TEST 4] Governed Drag-and-Drop Review Gate Redirect...');
  // Find Done Column on pvtBoard
  const doneCol = pvtBoard.columns.find((c: any) => {
    if (Array.isArray(c.mappedStatuses)) {
      return c.mappedStatuses.includes(WorkItemStatus.DONE);
    }
    return String(c.mappedStatuses).includes(WorkItemStatus.DONE);
  });
  // Transition task from TODO to IN_PROGRESS first (following Phase 2 state machine)
  await tasksService.transitionTask(
    pvtTask.ticketId,
    { targetStatus: WorkItemStatus.IN_PROGRESS },
    managerCtx,
  );

  // Move task (which is IN_PROGRESS, requiresReview=true, and NOT approved) directly to Done column
  const moveResult = await boardsService.moveBoardCard(
    pvtBoard.id,
    pvtTask.ticketId,
    { targetColumnId: doneCol.id, targetStatus: WorkItemStatus.DONE },
    managerCtx,
  );

  const reloadedTask = await prisma.task.findUnique({ where: { id: pvtTask.id } });
  console.log(`  Attempted target status: ${WorkItemStatus.DONE}`);
  console.log(`  Redirected status      : ${reloadedTask?.status}`);
  const test4Passed = reloadedTask?.status === WorkItemStatus.IN_REVIEW;
  console.log(`  Review Gate Check      : ${test4Passed ? 'PASSED (Redirected to IN_REVIEW)' : 'FAILED'}\n`);
  if (!test4Passed) throw new Error('Test 4 failed: Task bypassed review gate');

  console.log('===============================================================');
  console.log('ALL PHASE 3 RESOURCE-SCOPE & GOVERNANCE TESTS PASSED 100%!');
  console.log('===============================================================');
}

runPhase3AuthSuite()
  .catch((err) => {
    console.error('Auth suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
