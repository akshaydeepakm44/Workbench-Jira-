/**
 * sync-role-permissions.js
 * Syncs ROLE_PERMISSIONS from the shared package into the database Role table.
 * Run with: node scripts/sync-role-permissions.js
 */
const { PrismaClient } = require('@prisma/client');

const p = new PrismaClient();

// Authoritative permissions — mirrors packages/shared/src/index.ts ROLE_PERMISSIONS
const ROLE_PERMISSIONS = {
  ROLE_MANAGER: [
    'view_own_tasks', 'view_team_tasks', 'view_org_tasks',
    'create_task', 'update_task', 'transition_task',
    'manage_acceptance_criteria', 'add_work_evidence', 'manage_dependencies',
    'reparent_task', 'assign_task', 'review_task',
    'add_task_point', 'toggle_task_point',
    'view_own_standups', 'view_team_standups', 'view_org_standups',
    'convert_blocker_task', 'create_meeting', 'convert_action_task',
    'view_own_kpis', 'view_team_kpis', 'view_org_kpis',
    'export_team_reports', 'export_org_reports',
    'manage_users', 'manage_teams', 'manage_projects',
    'manage_workflows', 'manage_integrations', 'manage_automation',
    'view_audit_logs', 'manage_system_settings', 'manage_reports',
    'approve_employees', 'promote_leads',
    'manage_sprints', 'manage_backlog', 'manage_boards', 'manage_capacity',
    'manage_all',
  ],
  ROLE_LEAD: [
    'view_own_tasks', 'view_team_tasks',
    'create_task', 'update_task', 'transition_task',
    'manage_acceptance_criteria', 'add_work_evidence', 'manage_dependencies',
    'reparent_task', 'assign_task', 'review_task',
    'add_task_point', 'toggle_task_point',
    'view_own_standups', 'view_team_standups',
    'convert_blocker_task', 'create_meeting', 'convert_action_task',
    'view_own_kpis', 'view_team_kpis',
    'export_team_reports',
    'manage_sprints', 'manage_backlog', 'manage_boards', 'manage_capacity',
  ],
  ROLE_EMPLOYEE: [
    'view_own_tasks',
    'create_task', 'update_task', 'transition_task',
    'manage_acceptance_criteria', 'add_work_evidence', 'manage_dependencies',
    'assign_task', 'toggle_task_point',
    'view_own_standups', 'create_meeting',
    'view_own_kpis',
  ],
};

async function main() {
  console.log('Syncing role permissions to database...\n');

  for (const [roleCode, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await p.role.findFirst({ where: { code: roleCode } });
    if (!role) {
      console.log(`⚠️  Role not found in DB: ${roleCode} — skipping`);
      continue;
    }

    const existing = JSON.parse(role.permissions);
    const added = perms.filter((x) => !existing.includes(x));
    const removed = existing.filter((x) => !perms.includes(x));

    await p.role.update({
      where: { id: role.id },
      data: { permissions: JSON.stringify(perms) },
    });

    console.log(`✅ ${roleCode} (${perms.length} perms)`);
    if (added.length) console.log(`   + Added: ${added.join(', ')}`);
    if (removed.length) console.log(`   - Removed: ${removed.join(', ')}`);
    if (!added.length && !removed.length) console.log(`   (no changes)`);
  }

  console.log('\nDone. All roles are in sync.');
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
