import { PrismaClient } from '@prisma/client';
import { RoleCode, ROLE_PERMISSIONS } from '@workdesk/shared';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding canonical roles...');

  const roles = [
    {
      code: RoleCode.ROLE_MANAGER,
      name: 'Manager',
      description: 'Organization-wide governance, system administration, and executive reporting.',
      permissions: JSON.stringify(ROLE_PERMISSIONS[RoleCode.ROLE_MANAGER]),
    },
    {
      code: RoleCode.ROLE_LEAD,
      name: 'Team Lead',
      description: 'Supervisory role managing team tasks, stand-ups, review queues, and guidance points.',
      permissions: JSON.stringify(ROLE_PERMISSIONS[RoleCode.ROLE_LEAD]),
    },
    {
      code: RoleCode.ROLE_EMPLOYEE,
      name: 'Employee',
      description: 'Individual contributor focused on task execution and daily stand-ups.',
      permissions: JSON.stringify(ROLE_PERMISSIONS[RoleCode.ROLE_EMPLOYEE]),
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
      },
      create: role,
    });
  }

  // Legacy Migration: Convert any users with ROLE_SUPER_ADMIN to ROLE_MANAGER
  const managerRole = await prisma.role.findUnique({ where: { code: RoleCode.ROLE_MANAGER } });
  if (managerRole) {
    const legacyRole = await prisma.role.findUnique({ where: { code: 'ROLE_SUPER_ADMIN' } });
    if (legacyRole) {
      const legacyUsers = await prisma.user.findMany({ where: { roleId: legacyRole.id } });
      for (const u of legacyUsers) {
        await prisma.user.update({
          where: { id: u.id },
          data: {
            roleId: managerRole.id,
            isActive: true,
            approvalStatus: 'APPROVED',
          },
        });
        console.log(`Migrated legacy super admin user ${u.email} to ROLE_MANAGER`);
      }
      // Delete legacy role now that no users reference it
      await prisma.role.delete({ where: { id: legacyRole.id } });
      console.log('Cleaned up legacy ROLE_SUPER_ADMIN record.');
    }
  }

  // Ensure Default Workspace Project & Sequence exist
  const defaultProject = await prisma.project.upsert({
    where: { key: 'DESK' },
    update: { name: 'Default Workspace', status: 'Active' },
    create: {
      key: 'DESK',
      name: 'Default Workspace',
      status: 'Active',
    },
  });

  await prisma.projectSequence.upsert({
    where: { projectId: defaultProject.id },
    update: { projectKey: 'DESK' },
    create: {
      projectId: defaultProject.id,
      projectKey: 'DESK',
      currentSeq: 1000,
    },
  });

  console.log('Canonical roles, default project (DESK), and sequence seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
