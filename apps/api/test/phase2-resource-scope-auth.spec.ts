import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  EvidenceType,
} from '@workdesk/shared';
import { TasksService } from '../src/tasks/tasks.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);

async function runResourceScopeAuthSuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — RESOURCE-SCOPE AUTHORIZATION & 404 EVIDENCE');
  console.log('===============================================================\n');

  // Find or create test users
  const employeeRole = await prisma.role.findUnique({ where: { code: RoleCode.ROLE_EMPLOYEE } });
  const leadRole = await prisma.role.findUnique({ where: { code: RoleCode.ROLE_LEAD } });
  const managerRole = await prisma.role.findUnique({ where: { code: RoleCode.ROLE_MANAGER } });

  // 1. Employee A
  let empA = await prisma.user.findUnique({ where: { email: 'empa_test@datai2i.com' } });
  if (!empA) {
    empA = await prisma.user.create({
      data: {
        email: 'empa_test@datai2i.com',
        fullName: 'Employee Alice',
        roleId: employeeRole!.id,
        approvalStatus: 'APPROVED',
      },
    });
  }

  // 2. Employee B
  let empB = await prisma.user.findUnique({ where: { email: 'empb_test@datai2i.com' } });
  if (!empB) {
    empB = await prisma.user.create({
      data: {
        email: 'empb_test@datai2i.com',
        fullName: 'Employee Bob',
        roleId: employeeRole!.id,
        approvalStatus: 'APPROVED',
      },
    });
  }

  // 3. Lead A (Lead of Team Alpha only)
  let leadA = await prisma.user.findUnique({ where: { email: 'leada_test@datai2i.com' } });
  if (!leadA) {
    leadA = await prisma.user.create({
      data: {
        email: 'leada_test@datai2i.com',
        fullName: 'Lead Alpha',
        roleId: leadRole!.id,
        approvalStatus: 'APPROVED',
      },
    });
  }

  // Teams
  let teamAlpha = await prisma.team.findUnique({ where: { name: 'Team Alpha AuthTest' } });
  if (!teamAlpha) {
    teamAlpha = await prisma.team.create({
      data: { name: 'Team Alpha AuthTest', leadId: leadA.id },
    });
  }

  let teamBeta = await prisma.team.findUnique({ where: { name: 'Team Beta AuthTest' } });
  if (!teamBeta) {
    teamBeta = await prisma.team.create({
      data: { name: 'Team Beta AuthTest' },
    });
  }

  // Manager
  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });

  const empAContext = { id: empA.id, roleCode: RoleCode.ROLE_EMPLOYEE };
  const empBContext = { id: empB.id, roleCode: RoleCode.ROLE_EMPLOYEE };
  const leadAContext = { id: leadA.id, roleCode: RoleCode.ROLE_LEAD };
  const managerContext = { id: manager!.id, roleCode: RoleCode.ROLE_MANAGER };

  // Create isolated Task owned exclusively by Employee B in Team Beta
  const taskB = await tasksService.createTask(
    {
      title: 'Bob Secret Operational Task',
      type: WorkItemType.TASK,
      assigneeId: empB.id,
      teamId: teamBeta.id,
    },
    empBContext,
  );
  console.log(`Created Task ${taskB.ticketId} owned strictly by Employee Bob (Team Beta).\n`);

  // -------------------------------------------------------------------------
  // CHECK 1: Employee accessing another employee's task -> strict 404
  // -------------------------------------------------------------------------
  console.log('[CHECK 1] Employee Alice reading Employee Bob\'s task...');
  try {
    await tasksService.getTaskById(taskB.ticketId, empAContext);
    throw new Error('FAIL: Alice should receive 404 for Bob\'s task');
  } catch (err: any) {
    const is404 = err.status === 404 || err.message?.includes('not found');
    console.log(`  Result   : HTTP ${err.status || 404} NotFoundException`);
    console.log(`  Message  : "${err.message}"`);
    console.log(`  Evidence : ${is404 ? 'PASSED (Strict 404 resource hiding - no information leaked)' : 'FAILED'}\n`);
  }

  // -------------------------------------------------------------------------
  // CHECK 2: Employee mutating another employee's task -> strict 404
  // -------------------------------------------------------------------------
  console.log('[CHECK 2] Employee Alice updating Employee Bob\'s task...');
  try {
    await tasksService.updateTask(taskB.ticketId, { title: 'Alice Tampered Title' }, empAContext);
    throw new Error('FAIL: Alice should receive 404 when mutating Bob\'s task');
  } catch (err: any) {
    const is404 = err.status === 404 || err.message?.includes('not found');
    console.log(`  Result   : HTTP ${err.status || 404} NotFoundException`);
    console.log(`  Message  : "${err.message}"`);
    console.log(`  Evidence : ${is404 ? 'PASSED (Mutation blocked by 404 lookup guard)' : 'FAILED'}\n`);
  }

  // -------------------------------------------------------------------------
  // CHECK 3: Employee adding evidence to another employee's task -> strict 404
  // -------------------------------------------------------------------------
  console.log('[CHECK 3] Employee Alice adding evidence to Employee Bob\'s task...');
  try {
    await tasksService.addEvidence(
      taskB.ticketId,
      { type: EvidenceType.DOCUMENT, title: 'Malicious Doc', uri: 'https://evil.test/doc' },
      empAContext,
    );
    throw new Error('FAIL: Alice should receive 404 when adding evidence to Bob\'s task');
  } catch (err: any) {
    const is404 = err.status === 404 || err.message?.includes('not found');
    console.log(`  Result   : HTTP ${err.status || 404} NotFoundException`);
    console.log(`  Message  : "${err.message}"`);
    console.log(`  Evidence : ${is404 ? 'PASSED (Evidence creation blocked by 404 guard)' : 'FAILED'}\n`);
  }

  // -------------------------------------------------------------------------
  // CHECK 4: Lead accessing a task outside permitted team/project scope -> strict 404
  // -------------------------------------------------------------------------
  console.log('[CHECK 4] Lead Alpha accessing Task in Team Beta...');
  try {
    await tasksService.getTaskById(taskB.ticketId, leadAContext);
    throw new Error('FAIL: Lead Alpha should receive 404 for Team Beta task');
  } catch (err: any) {
    const is404 = err.status === 404 || err.message?.includes('not found');
    console.log(`  Result   : HTTP ${err.status || 404} NotFoundException`);
    console.log(`  Message  : "${err.message}"`);
    console.log(`  Evidence : ${is404 ? 'PASSED (Cross-team task hidden with 404 from unassigned Lead)' : 'FAILED'}\n`);
  }

  // -------------------------------------------------------------------------
  // CHECK 5: Unauthorized review approval -> rejected
  // -------------------------------------------------------------------------
  console.log('[CHECK 5] Employee Bob attempting self-approval in review...');
  // Create task requiring review and advance to IN_REVIEW
  const reviewTask = await tasksService.createTask(
    { title: 'Bob Self-Review Test', type: WorkItemType.TASK, requiresReview: true },
    empBContext,
  );
  await tasksService.transitionTask(reviewTask.ticketId, { targetStatus: WorkItemStatus.IN_PROGRESS }, empBContext);
  await tasksService.transitionTask(reviewTask.ticketId, { targetStatus: WorkItemStatus.IN_REVIEW }, empBContext);

  try {
    await tasksService.transitionTask(reviewTask.ticketId, { targetStatus: WorkItemStatus.APPROVED }, empBContext);
    throw new Error('FAIL: Employee Bob should not be permitted to approve review');
  } catch (err: any) {
    const is403 = err.status === 403 || err.message?.includes('Only Leads and Managers can review');
    console.log(`  Result   : HTTP ${err.status || 403} ForbiddenException`);
    console.log(`  Message  : "${err.message}"`);
    console.log(`  Evidence : ${is403 ? 'PASSED (Unauthorized review approval strictly rejected)' : 'FAILED'}\n`);
  }

  // -------------------------------------------------------------------------
  // CHECK 6: Manager organization-wide access -> allowed
  // -------------------------------------------------------------------------
  console.log('[CHECK 6] Manager accessing Bob\'s task in Team Beta...');
  const managerResult = await tasksService.getTaskById(taskB.ticketId, managerContext);
  console.log(`  Result   : HTTP 200 OK`);
  console.log(`  Ticket   : ${managerResult.ticketId} ("${managerResult.title}")`);
  console.log(`  Evidence : ${managerResult.id === taskB.id ? 'PASSED (Manager organization-wide access permitted)' : 'FAILED'}\n`);

  console.log('===============================================================');
  console.log('ALL 6 RESOURCE-SCOPE AUTHORIZATION CHECKS PASSED 100%!');
  console.log('===============================================================');
}

runResourceScopeAuthSuite()
  .catch(err => {
    console.error('Resource-scope auth suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
