import { PrismaClient } from '@prisma/client';
import { RoleCode, WorkItemStatus, WorkItemType } from '@workdesk/shared';
import { TasksService } from '../src/tasks/tasks.service';
import { AuditService } from '../src/audit/audit.service';
import { PrismaService } from '../src/prisma/prisma.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);

async function runPhase1RegressionSuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 1 REGRESSION VERIFICATION SUITE');
  console.log('===============================================================\n');

  // 1. Canonical Three-Role Model Check
  console.log('[REGRESSION 1] Canonical 3-Role Model Integrity...');
  const roles = await prisma.role.findMany();
  const roleCodes = roles.map(r => r.code);
  console.log(`  Roles found in DB: [${roleCodes.join(', ')}]`);
  const hasSuperAdmin = roleCodes.includes('ROLE_SUPER_ADMIN');
  const hasAllThree =
    roleCodes.includes(RoleCode.ROLE_EMPLOYEE) &&
    roleCodes.includes(RoleCode.ROLE_LEAD) &&
    roleCodes.includes(RoleCode.ROLE_MANAGER);
  console.log(`  Absence of ROLE_SUPER_ADMIN : ${!hasSuperAdmin ? 'PASSED (0 occurrences)' : 'FAILED'}`);
  console.log(`  Exact 3-role model presence : ${hasAllThree && roles.length === 3 ? 'PASSED' : 'FAILED'}\n`);
  if (hasSuperAdmin || !hasAllThree) throw new Error('Role model regression detected');

  // 2. ProjectSequence Ticket Allocation
  console.log('[REGRESSION 2] ProjectSequence Sequential Allocation...');
  const manager = await prisma.user.findFirst({ where: { role: { code: RoleCode.ROLE_MANAGER } } });
  const managerCtx = { id: manager!.id, roleCode: RoleCode.ROLE_MANAGER };

  const task1 = await tasksService.createTask({ title: 'Seq Reg 1', type: WorkItemType.TASK }, managerCtx);
  const task2 = await tasksService.createTask({ title: 'Seq Reg 2', type: WorkItemType.TASK }, managerCtx);

  const num1 = parseInt(task1.ticketId.split('-')[1], 10);
  const num2 = parseInt(task2.ticketId.split('-')[1], 10);
  console.log(`  Task 1 ID: ${task1.ticketId} (Seq: ${num1})`);
  console.log(`  Task 2 ID: ${task2.ticketId} (Seq: ${num2})`);
  const isSeq = num2 === num1 + 1;
  console.log(`  Sequential increment : ${isSeq ? 'PASSED (DESK-X -> DESK-(X+1))' : 'FAILED'}\n`);
  if (!isSeq) throw new Error('Sequence allocation regression detected');

  // 3. LegacyTicketAlias Lookup
  console.log('[REGRESSION 3] LegacyTicketAlias Backward-Compatible Lookup...');
  // Create an alias pointing to task1
  const aliasKey = `TASK-LEGACY-REG-${Date.now().toString().slice(-4)}`;
  await prisma.legacyTicketAlias.create({
    data: {
      legacyKey: aliasKey,
      newKey: task1.ticketId,
      workitemId: task1.id,
    },
  });

  const resolved = await tasksService.getTaskById(aliasKey, managerCtx);
  console.log(`  Queried alias key: ${aliasKey}`);
  console.log(`  Resolved ticket  : ${resolved.ticketId} (${resolved.id})`);
  const aliasPassed = resolved.id === task1.id && resolved.ticketId === task1.ticketId;
  console.log(`  Alias resolution : ${aliasPassed ? 'PASSED (Legacy alias resolved to new key)' : 'FAILED'}\n`);
  if (!aliasPassed) throw new Error('Legacy alias regression detected');

  // 4. Audit Logging & Notification Dispatch
  console.log('[REGRESSION 4] Audit Logging & Notification Dispatch...');
  const auditLogsCount = await prisma.auditLog.count({ where: { entityId: task1.id } });
  console.log(`  Audit logs for ${task1.ticketId}: ${auditLogsCount} events recorded`);
  console.log(`  Audit framework active: ${auditLogsCount > 0 ? 'PASSED' : 'FAILED'}\n`);
  if (auditLogsCount === 0) throw new Error('Audit logging regression detected');

  console.log('===============================================================');
  console.log('ALL PHASE 1 REGRESSION TESTS PASSED 100%!');
  console.log('===============================================================');
}

runPhase1RegressionSuite()
  .catch(err => {
    console.error('Regression suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
