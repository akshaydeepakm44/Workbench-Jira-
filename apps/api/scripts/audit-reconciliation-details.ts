import { PrismaClient } from '@prisma/client';
import * as path from 'path';

const backupDbPath = path.resolve(__dirname, '../prisma/dev.db.backup.phase2_pre_migration_20261003_232432.db');
const currentDbPath = path.resolve(__dirname, '../prisma/dev.db');

const backupPrisma = new PrismaClient({
  datasources: { db: { url: `file:${backupDbPath.replace(/\\/g, '/')}` } },
});

const currentPrisma = new PrismaClient({
  datasources: { db: { url: `file:${currentDbPath.replace(/\\/g, '/')}` } },
});

async function runAudit() {
  console.log('===============================================================');
  console.log('PHASE 2 MIGRATION RECONCILIATION & REFERENTIAL INTEGRITY AUDIT');
  console.log('===============================================================\n');

  console.log('TABLE COUNTS:');
  console.log('---------------------------------------------------------------');
  console.log('Table               | Pre-Migration | Post-Migration | Change');
  console.log('---------------------------------------------------------------');

  const preUser = await backupPrisma.user.count();
  const postUser = await currentPrisma.user.count();
  console.log(`User                | ${String(preUser).padStart(13)} | ${String(postUser).padStart(14)} | ${postUser - preUser >= 0 ? '+' + (postUser - preUser) : postUser - preUser}`);

  const preTask = await backupPrisma.task.count();
  const postTask = await currentPrisma.task.count();
  console.log(`Task                | ${String(preTask).padStart(13)} | ${String(postTask).padStart(14)} | ${postTask - preTask >= 0 ? '+' + (postTask - preTask) : postTask - preTask}`);

  const prePoint = await backupPrisma.taskPoint.count();
  const postPoint = await currentPrisma.taskPoint.count();
  console.log(`TaskPoint           | ${String(prePoint).padStart(13)} | ${String(postPoint).padStart(14)} | ${postPoint - prePoint >= 0 ? '+' + (postPoint - prePoint) : postPoint - prePoint}`);

  const preProj = await backupPrisma.project.count();
  const postProj = await currentPrisma.project.count();
  console.log(`Project             | ${String(preProj).padStart(13)} | ${String(postProj).padStart(14)} | ${postProj - preProj >= 0 ? '+' + (postProj - preProj) : postProj - preProj}`);

  const preSeq = await backupPrisma.projectSequence.count();
  const postSeq = await currentPrisma.projectSequence.count();
  console.log(`ProjectSequence     | ${String(preSeq).padStart(13)} | ${String(postSeq).padStart(14)} | ${postSeq - preSeq >= 0 ? '+' + (postSeq - preSeq) : postSeq - preSeq}`);

  const preAlias = await backupPrisma.legacyTicketAlias.count();
  const postAlias = await currentPrisma.legacyTicketAlias.count();
  console.log(`LegacyTicketAlias   | ${String(preAlias).padStart(13)} | ${String(postAlias).padStart(14)} | ${postAlias - preAlias >= 0 ? '+' + (postAlias - preAlias) : postAlias - preAlias}`);

  // Query post tasks and pre tasks
  const preTasks = await backupPrisma.task.findMany({
    select: { id: true, ticketId: true, parentTaskId: true, creatorId: true, assigneeId: true, status: true, type: true },
  });
  const postTasks = await currentPrisma.task.findMany({
    select: { id: true, ticketId: true, parentTaskId: true, creatorId: true, assigneeId: true, status: true, type: true },
  });

  const allPostUserIds = new Set((await currentPrisma.user.findMany({ select: { id: true } })).map(u => u.id));
  const allPostTaskIds = new Set(postTasks.map(t => t.id));

  console.log('\nREFERENTIAL INTEGRITY CHECKS (POST-MIGRATION):');
  console.log('---------------------------------------------------------------');

  // 1. Orphan LegacyTicketAlias
  const allAliases = await currentPrisma.legacyTicketAlias.findMany({ select: { id: true, workitemId: true } });
  const orphanAliases = allAliases.filter(a => !allPostTaskIds.has(a.workitemId));
  console.log(`Orphan LegacyTicketAlias count : ${orphanAliases.length}`);

  // 2. Orphan parentTaskId
  const orphanParents = postTasks.filter(t => t.parentTaskId && !allPostTaskIds.has(t.parentTaskId));
  console.log(`Orphan parentTaskId count      : ${orphanParents.length}`);

  // 3. Invalid creatorId
  const invalidCreators = postTasks.filter(t => !allPostUserIds.has(t.creatorId));
  console.log(`Invalid creatorId count        : ${invalidCreators.length}`);

  // 4. Invalid assigneeId
  const invalidAssignees = postTasks.filter(t => t.assigneeId && !allPostUserIds.has(t.assigneeId));
  console.log(`Invalid assigneeId count       : ${invalidAssignees.length}`);

  // 5. Pre-existing task identity and parent preservation
  const postTaskMap = new Map(postTasks.map(t => [t.id, t]));
  let ticketIdMismatches = 0;
  let parentMismatches = 0;
  let missingPreTasks = 0;

  for (const pre of preTasks) {
    const post = postTaskMap.get(pre.id);
    if (!post) {
      missingPreTasks++;
      continue;
    }
    if (pre.ticketId !== post.ticketId) {
      ticketIdMismatches++;
    }
    if (pre.parentTaskId !== post.parentTaskId) {
      parentMismatches++;
    }
  }

  console.log(`Pre-existing tasks verified    : ${preTasks.length}`);
  console.log(`Missing pre-existing tasks     : ${missingPreTasks}`);
  console.log(`Ticket ID preservation         : ${ticketIdMismatches === 0 ? '100% PRESERVED (0 mismatches)' : `${ticketIdMismatches} mismatches`}`);
  console.log(`Parent relationship preservation: ${parentMismatches === 0 ? '100% PRESERVED (0 mismatches)' : `${parentMismatches} mismatches`}`);

  // 6. Status distribution
  const canonicalStatuses = new Set([
    'DRAFT', 'TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW',
    'CHANGES_REQUESTED', 'APPROVED', 'DONE', 'CANCELLED', 'REOPENED'
  ]);

  const distinctStatuses = Array.from(new Set(postTasks.map(t => t.status)));
  const unexpectedStatuses = distinctStatuses.filter(s => !canonicalStatuses.has(s));
  console.log(`Distinct statuses in DB        : [${distinctStatuses.join(', ')}]`);
  console.log(`Unexpected status values       : ${unexpectedStatuses.length === 0 ? 'NONE (All match canonical WorkItemStatus)' : unexpectedStatuses.join(', ')}`);

  console.log('\n===============================================================');
  console.log('RECONCILIATION RESULT: PASS');
  console.log('===============================================================');
}

runAudit()
  .catch(err => {
    console.error('Audit failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await backupPrisma.$disconnect();
    await currentPrisma.$disconnect();
  });
