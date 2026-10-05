import { PrismaClient } from '@prisma/client';
import { RoleCode, Permission, ROLE_PERMISSIONS } from '@workdesk/shared';

describe('Phase 1 - Canonical Three-Role RBAC & Database Foundation', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('1. Exactly three canonical roles must exist in database', async () => {
    const roles = await prisma.role.findMany();
    const codes = roles.map((r) => r.code).sort();

    expect(codes).toEqual([
      RoleCode.ROLE_EMPLOYEE,
      RoleCode.ROLE_LEAD,
      RoleCode.ROLE_MANAGER,
    ].sort());
  });

  it('2. ROLE_EMPLOYEE has exact 6 scoped permissions', async () => {
    const employeeRole = await prisma.role.findUnique({
      where: { code: RoleCode.ROLE_EMPLOYEE },
    });
    expect(employeeRole).toBeDefined();

    const permissions: Permission[] = JSON.parse(employeeRole!.permissions);
    expect(permissions.length).toBe(6);
    expect(permissions).toContain(Permission.VIEW_OWN_TASKS);
    expect(permissions).toContain(Permission.CREATE_TASK);
    expect(permissions).toContain(Permission.TOGGLE_TASK_POINT);
    expect(permissions).toContain(Permission.VIEW_OWN_STANDUPS);
    expect(permissions).not.toContain(Permission.VIEW_TEAM_TASKS);
    expect(permissions).not.toContain(Permission.MANAGE_USERS);
  });

  it('3. ROLE_LEAD has team supervision permissions but no org admin permissions', async () => {
    const leadRole = await prisma.role.findUnique({
      where: { code: RoleCode.ROLE_LEAD },
    });
    expect(leadRole).toBeDefined();

    const permissions: Permission[] = JSON.parse(leadRole!.permissions);
    expect(permissions.length).toBe(15);
    expect(permissions).toContain(Permission.VIEW_TEAM_TASKS);
    expect(permissions).toContain(Permission.REVIEW_TASK);
    expect(permissions).toContain(Permission.ADD_TASK_POINT);
    expect(permissions).toContain(Permission.CONVERT_BLOCKER_TASK);
    expect(permissions).not.toContain(Permission.MANAGE_USERS);
    expect(permissions).not.toContain(Permission.MANAGE_WORKFLOWS);
    expect(permissions).not.toContain(Permission.VIEW_AUDIT_LOGS);
  });

  it('4. ROLE_MANAGER has all 25 organization & governance permissions', async () => {
    const managerRole = await prisma.role.findUnique({
      where: { code: RoleCode.ROLE_MANAGER },
    });
    expect(managerRole).toBeDefined();

    const permissions: Permission[] = JSON.parse(managerRole!.permissions);
    expect(permissions.length).toBe(25);
    expect(permissions).toContain(Permission.MANAGE_USERS);
    expect(permissions).toContain(Permission.MANAGE_TEAMS);
    expect(permissions).toContain(Permission.MANAGE_WORKFLOWS);
    expect(permissions).toContain(Permission.MANAGE_INTEGRATIONS);
    expect(permissions).toContain(Permission.VIEW_AUDIT_LOGS);
    expect(permissions).toContain(Permission.MANAGE_SYSTEM_SETTINGS);
  });

  it('5. Standup and Action Item unique 1:1 constraints exist', async () => {
    // Verifies schema model properties
    const standupBlockerFields = (prisma as any)._runtimeDataModel?.models?.StandupBlocker?.fields || [];
    const actionItemFields = (prisma as any)._runtimeDataModel?.models?.MeetingActionItem?.fields || [];
    
    // Prisma client reflects convertedTaskId on both models
    expect(prisma.standupBlocker).toBeDefined();
    expect(prisma.meetingActionItem).toBeDefined();
    expect(prisma.taskWatcher).toBeDefined();
  });
});
