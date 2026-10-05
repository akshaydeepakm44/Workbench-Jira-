-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "teamId" TEXT,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "completedAt" DATETIME,
    "capacityPoints" INTEGER,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Sprint_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sprint_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SprintCommitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sprintId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "wasPlanned" BOOLEAN NOT NULL DEFAULT true,
    "storyPoints" INTEGER,
    "statusAtStart" TEXT,
    "statusAtEnd" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" DATETIME,
    "completedAt" DATETIME,
    "carriedOverToSprintId" TEXT,
    CONSTRAINT "SprintCommitment_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SprintCommitment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'KANBAN',
    "filterQuery" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Board_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Board_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BoardColumn" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "wipLimit" INTEGER NOT NULL DEFAULT 0,
    "wipLimitType" TEXT NOT NULL DEFAULT 'WARNING',
    "mappedStatuses" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoardColumn_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "urgency" TEXT NOT NULL DEFAULT 'Green',
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "creatorId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "teamId" TEXT,
    "projectId" TEXT,
    "parentTaskId" TEXT,
    "reviewPending" BOOLEAN NOT NULL DEFAULT false,
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "blockerReason" TEXT,
    "startDate" DATETIME,
    "deadline" DATETIME,
    "completedAt" DATETIME,
    "estimatedHours" INTEGER,
    "actualHours" INTEGER,
    "sprintId" TEXT,
    "rank" TEXT NOT NULL DEFAULT '0|hzzzzz:',
    "storyPoints" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("actualHours", "assigneeId", "blockerReason", "completedAt", "createdAt", "creatorId", "deadline", "description", "estimatedHours", "id", "parentTaskId", "priority", "progressPercent", "projectId", "requiresReview", "reviewPending", "startDate", "status", "teamId", "ticketId", "title", "type", "updatedAt", "urgency") SELECT "actualHours", "assigneeId", "blockerReason", "completedAt", "createdAt", "creatorId", "deadline", "description", "estimatedHours", "id", "parentTaskId", "priority", "progressPercent", "projectId", "requiresReview", "reviewPending", "startDate", "status", "teamId", "ticketId", "title", "type", "updatedAt", "urgency" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_ticketId_key" ON "Task"("ticketId");
CREATE INDEX "Task_projectId_rank_idx" ON "Task"("projectId", "rank");
CREATE INDEX "Task_sprintId_rank_idx" ON "Task"("sprintId", "rank");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Sprint_projectId_status_idx" ON "Sprint"("projectId", "status");

-- CreateIndex
CREATE INDEX "Sprint_teamId_status_idx" ON "Sprint"("teamId", "status");

-- CreateIndex
CREATE INDEX "SprintCommitment_sprintId_idx" ON "SprintCommitment"("sprintId");

-- CreateIndex
CREATE INDEX "SprintCommitment_taskId_idx" ON "SprintCommitment"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "SprintCommitment_sprintId_taskId_key" ON "SprintCommitment"("sprintId", "taskId");

-- CreateIndex
CREATE INDEX "Board_projectId_idx" ON "Board"("projectId");

-- CreateIndex
CREATE INDEX "BoardColumn_boardId_orderIndex_idx" ON "BoardColumn"("boardId", "orderIndex");
