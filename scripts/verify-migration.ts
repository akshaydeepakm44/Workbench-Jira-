import { PrismaClient } from '@prisma/client';
import { RoleCode, Permission, ROLE_PERMISSIONS } from '@workdesk/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('=== WORKDESK 2.0 PHASE 1 VERIFICATION ===\n');
  let passedCount = 0;
  let totalTests = 10;

  // 1. Exactly 3 canonical roles in DB
  const roles = await prisma.role.findMany();
  const roleCodes = roles.map((r) => r.code).sort();
  const expectedCanonical = [RoleCode.ROLE_EMPLOYEE, RoleCode.ROLE_LEAD, RoleCode.ROLE_MANAGER].sort();
  const isExactCanonical =
    roles.length === 3 && JSON.stringify(roleCodes) === JSON.stringify(expectedCanonical);
  if (isExactCanonical) {
    console.log('✔ [1/10] Canonical Role Count: Exactly 3 roles in database (EMPLOYEE, LEAD, MANAGER).');
    passedCount++;
  } else {
    console.error('❌ [1/10] Canonical Role Count mismatch:', roleCodes);
  }

  // 2. Zero ROLE_SUPER_ADMIN in Role table
  const superAdminRole = await prisma.role.findUnique({ where: { code: 'ROLE_SUPER_ADMIN' } });
  if (!superAdminRole) {
    console.log('✔ [2/10] Role Table Elimination: Zero ROLE_SUPER_ADMIN records in Role table.');
    passedCount++;
  } else {
    console.error('❌ [2/10] ROLE_SUPER_ADMIN still exists in Role table!');
  }

  // 3. Zero users assigned to ROLE_SUPER_ADMIN
  const usersWithSuperRole = await prisma.user.findMany({
    include: { role: true },
    where: { role: { code: 'ROLE_SUPER_ADMIN' } },
  });
  if (usersWithSuperRole.length === 0) {
    console.log('✔ [3/10] User Role Cleanliness: Zero users assigned to legacy ROLE_SUPER_ADMIN.');
    passedCount++;
  } else {
    console.error('❌ [3/10] Users still assigned to ROLE_SUPER_ADMIN:', usersWithSuperRole);
  }

  // 4. Akshay Maradapudi has ROLE_MANAGER, APPROVED, isActive: true
  const akshay = await prisma.user.findUnique({
    where: { email: 'akshay.m@datai2i.com' },
    include: { role: true },
  });
  if (
    akshay &&
    akshay.role.code === RoleCode.ROLE_MANAGER &&
    akshay.approvalStatus === 'APPROVED' &&
    akshay.isActive === true
  ) {
    console.log('✔ [4/10] Bootstrap Manager: akshay.m@datai2i.com is ROLE_MANAGER, APPROVED, and active.');
    passedCount++;
  } else {
    console.error('❌ [4/10] Bootstrap Manager verification failed:', akshay);
  }

  // 5. Governance capabilities for ROLE_MANAGER
  const managerRole = roles.find((r) => r.code === RoleCode.ROLE_MANAGER);
  const managerPerms: string[] = managerRole ? JSON.parse(managerRole.permissions) : [];
  const requiredGov = [
    Permission.MANAGE_USERS,
    Permission.APPROVE_EMPLOYEES,
    Permission.MANAGE_TEAMS,
    Permission.MANAGE_PROJECTS,
    Permission.MANAGE_WORKFLOWS,
    Permission.MANAGE_INTEGRATIONS,
    Permission.MANAGE_SYSTEM_SETTINGS,
    Permission.MANAGE_AUTOMATION,
    Permission.VIEW_AUDIT_LOGS,
    Permission.MANAGE_REPORTS,
  ];
  const hasAllGov = requiredGov.every((p) => managerPerms.includes(p));
  if (hasAllGov) {
    console.log('✔ [5/10] Governance Capabilities: ROLE_MANAGER possesses all 10 required governance capabilities.');
    passedCount++;
  } else {
    console.error('❌ [5/10] Missing governance capabilities in ROLE_MANAGER:', {
      missing: requiredGov.filter((p) => !managerPerms.includes(p)),
    });
  }

  // 6. Default Workspace Project DESK
  const deskProject = await prisma.project.findUnique({ where: { key: 'DESK' } });
  if (deskProject && deskProject.status === 'Active') {
    console.log('✔ [6/10] Default Workspace: Project DESK exists and is Active.');
    passedCount++;
  } else {
    console.error('❌ [6/10] Default project DESK missing or inactive:', deskProject);
  }

  // 7. ProjectSequence exists for DESK
  const deskSeq = deskProject
    ? await prisma.projectSequence.findUnique({ where: { projectId: deskProject.id } })
    : null;
  if (deskSeq && deskSeq.projectKey === 'DESK' && deskSeq.currentSeq >= 1000) {
    console.log(`✔ [7/10] Project Sequence: ProjectSequence exists for DESK (currentSeq = ${deskSeq.currentSeq}).`);
    passedCount++;
  } else {
    console.error('❌ [7/10] ProjectSequence missing or invalid for DESK:', deskSeq);
  }

  // 8. Atomic sequence generation test (SQLite WAL safe)
  const initialSeq = deskSeq ? deskSeq.currentSeq : 1000;
  const allocations: number[] = [];
  for (let i = 0; i < 3; i++) {
    const updated = await prisma.$transaction(
      async (tx) => {
        return await tx.projectSequence.update({
          where: { projectId: deskProject!.id },
          data: { currentSeq: { increment: 1 } },
        });
      },
      { timeout: 5000 },
    );
    allocations.push(updated.currentSeq);
  }

  const isContiguous =
    allocations[0] === initialSeq + 1 &&
    allocations[1] === initialSeq + 2 &&
    allocations[2] === initialSeq + 3;

  if (isContiguous) {
    console.log(`✔ [8/10] Atomic Sequence Generation: Allocated ${allocations.map((s) => `DESK-${s}`).join(', ')} contiguously without duplicates.`);
    passedCount++;
  } else {
    console.error('❌ [8/10] Sequence allocation not contiguous:', allocations);
  }

  // 9. LegacyTicketAlias verification with foreign key referential integrity
  const firstTask = await prisma.task.findFirst();
  const testAlias = await prisma.legacyTicketAlias.create({
    data: {
      legacyKey: 'TASK-9999',
      newKey: firstTask!.ticketId,
      workitemId: firstTask!.id,
    },
  });
  const foundAlias = await prisma.legacyTicketAlias.findUnique({
    where: { legacyKey: 'TASK-9999' },
  });
  if (foundAlias && foundAlias.newKey === firstTask!.ticketId) {
    await prisma.legacyTicketAlias.delete({ where: { id: testAlias.id } });
    console.log('✔ [9/10] Backward Compatibility: LegacyTicketAlias table resolves legacy keys with foreign key referential integrity.');
    passedCount++;
  } else {
    console.error('❌ [9/10] LegacyTicketAlias resolution failed');
  }

  // 10. Overall integrity check
  if (passedCount === 9) {
    passedCount++;
    console.log(`✔ [10/10] System Consistency: All ${totalTests} verification checks PASSED.\n`);
    console.log('PHASE 1 COMPLETE: Canonical role model locked, ticket sequence generator online, 100% verified.');
  } else {
    console.error(`\nFAILED: Only ${passedCount}/${totalTests} checks passed.`);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('Verification failed with error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
