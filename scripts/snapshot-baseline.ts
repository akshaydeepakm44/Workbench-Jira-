import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: { role: true }
  });
  const roles = await prisma.role.findMany();
  const tasks = await prisma.task.findMany({
    include: { points: true, comments: true, watchers: true }
  });
  const projects = await prisma.project.findMany();
  const teams = await prisma.team.findMany();

  const baseline = {
    timestamp: new Date().toISOString(),
    usersCount: users.length,
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      employeeId: u.employeeId,
      approvalStatus: u.approvalStatus,
      roleCode: u.role?.code,
      isActive: u.isActive
    })),
    rolesCount: roles.length,
    roles: roles.map(r => ({
      code: r.code,
      name: r.name,
      permissions: JSON.parse(r.permissions)
    })),
    tasksCount: tasks.length,
    tasks: tasks.map(t => ({
      id: t.id,
      ticketId: t.ticketId,
      title: t.title,
      status: t.status,
      priority: t.priority,
      urgency: t.urgency,
      pointsCount: t.points.length,
      commentsCount: t.comments.length
    })),
    projectsCount: projects.length,
    projects: projects.map(p => ({ id: p.id, key: p.key, name: p.name })),
    teamsCount: teams.length,
    teams: teams.map(t => ({ id: t.id, name: t.name }))
  };

  const outputPath = path.resolve(process.cwd(), 'migration_baseline.json');
  fs.writeFileSync(outputPath, JSON.stringify(baseline, null, 2), 'utf-8');
  console.log(`Baseline successfully written to ${outputPath}`);
  console.log(`Summary: Users=${users.length}, Roles=${roles.length}, Tasks=${tasks.length}, Projects=${projects.length}, Teams=${teams.length}`);
}

main()
  .catch((e) => {
    console.error('Snapshot failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
