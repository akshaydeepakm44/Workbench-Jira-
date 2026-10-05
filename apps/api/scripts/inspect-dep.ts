import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const deps = await p.taskDependency.findMany({
    where: {
      OR: [
        { taskId: '94df6037-81d8-4a54-87ab-39777b83796d' },
        { targetTaskId: '94df6037-81d8-4a54-87ab-39777b83796d' },
      ],
    },
  });
  console.log('Dependencies found:', JSON.stringify(deps, null, 2));
  await p.$disconnect();
}
main();
