import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      employeeId: true,
      approvalStatus: true,
      role: { select: { code: true, name: true } },
      ledProjects: { select: { id: true, name: true, key: true } },
    },
  });
  console.log('Current Users in DB:');
  console.log(JSON.stringify(users, null, 2));

  const counts = {
    tasks: await prisma.task.count(),
    projects: await prisma.project.count(),
    sprints: await prisma.sprint.count(),
    boards: await prisma.board.count(),
    meetings: await prisma.meeting.count(),
    standups: await prisma.standup.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log('\nEntity counts:', JSON.stringify(counts, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
