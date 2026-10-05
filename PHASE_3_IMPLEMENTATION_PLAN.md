# WORKDESK 2.0 — PHASE 3 IMPLEMENTATION PLAN
## Backlog Management, Sprint Planning, Agile Kanban & Governed Drag-and-Drop

---

## 1. EXECUTIVE SUMMARY

WorkDesk 2.0 has successfully closed Phase 1 (Core Identity, RBAC, Foundation) and Phase 2 (Canonical Work Item Engine, Hierarchy, Dependencies, Authoritative Done Gate, Unified Cockpit). All foundational invariants are locked and verified: a single canonical `Task` table, strict 3-role security model (`ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`), zero `ROLE_SUPER_ADMIN` runtime footprint, graph dependencies with cycle detection, and strict 404 resource hiding.

**Phase 3 establishes the Agile Delivery & Execution Layer**:
1. **Backlog Management Engine**: A structured, hierarchy-aware product/team backlog operating directly on canonical `Task` items, powered by concurrency-safe LexoRank string ordering, sprint readiness gates, and cursor-paginated queries.
2. **Authoritative Sprint Engine**: A state-machine-governed sprint lifecycle (`PLANNED` $\rightarrow$ `ACTIVE` $\rightarrow$ `COMPLETED` / `CANCELLED`), enforcing single-active-sprint-per-scope invariants, capacity validation, commitment baselining, and auditable carry-over mechanics.
3. **Agile Kanban & Workflow Mapping**: Configurable board columns mapped directly to Phase 2 canonical `WorkItemStatus` states, supporting column WIP limits (warning vs hard cap), multi-dimensional swimlanes, and rich card telemetry.
4. **Governed Drag-and-Drop Operations**: Treating every UI card drag, backlog reorder, and sprint allocation as a server-authoritative mutation validated against capability permissions, resource scopes, WIP boundaries, and the Phase 2 Done Gate, backed by instant client-side reconciliation on rejection.

Implementation remains strictly halted. This document provides the complete, authoritative, and frozen architecture plan for Phase 3.

---

## 2. CURRENT ARCHITECTURE ASSESSMENT

The existing repository architecture consists of:
- **Monorepo**: Turborepo containing `apps/api` (NestJS 10, Prisma, SQLite `dev.db`), `apps/web` (Vite, React 18, Tailwind CSS, Lucide icons), and `packages/shared` (TypeScript domain types, enums, DTOs).
- **Domain Persistence**: `apps/api/prisma/schema.prisma` anchors all work items in the `Task` model, supported by `AcceptanceCriterion`, `TaskPoint`, `TaskEvidence`, `TaskDependency`, `TaskComment`, `TaskActivity`, `TaskWatcher`, `Project`, `ProjectSequence`, `LegacyTicketAlias`, `Team`, `User`, `Role`, `AuditLog`, `Notification`.
- **Active Task Types**: 10 concrete types (`INITIATIVE`, `EPIC`, `STORY`, `TASK`, `BUG`, `REQUEST`, `IMPROVEMENT`, `ACTION_ITEM`, `SUBTASK`, `MILESTONE`) structured across 4 hierarchy levels (`INITIATIVE` $\rightarrow$ `EPIC` $\rightarrow$ Level-3 $\rightarrow$ `SUBTASK`).
- **State Machine**: 10 canonical statuses (`DRAFT`, `TODO`, `IN_PROGRESS`, `BLOCKED`, `IN_REVIEW`, `CHANGES_REQUESTED`, `APPROVED`, `DONE`, `CANCELLED`, `REOPENED`).
- **Authorization**: Session-cookie JWT authentication, `PermissionsGuard`, `@RequirePermissions(...)`, and query-level tenant/team resource-scoping returning strict HTTP 404s for unauthorized resource queries.
- **Runtime Topology**: NestJS API (port 3000), Vite dev server (port 5174), Nginx reverse proxy (port 80), and Cloudflare Tunnel (`trycloudflare.com`).

---

## 3. PHASE 2 BASELINE & NON-NEGOTIABLE INVARIANTS

Phase 3 is constrained by the following locked invariants from Phases 1 & 2:
1. **Single Canonical Task Table**: No secondary `WorkItem`, `Ticket`, `Issue`, `SprintTask`, `BacklogItem`, or `KanbanCard` table. All backlog, sprint, and board representations reference `Task`.
2. **Canonical Three-Role Model**: Only `ROLE_EMPLOYEE`, `ROLE_LEAD`, and `ROLE_MANAGER`. No administrative or project manager role additions.
3. **Zero Runtime Super Admin**: No `ROLE_SUPER_ADMIN` branches or database records.
4. **Single Authorization Authority**: Reuses `SessionGuard`, `PolicyGuard`, `PermissionsGuard`, and resource-scoping.
5. **Phase 2 State Machine & Done Gate**: All status changes from board card movements must pass through the authoritative Phase 2 state machine, mandatory Acceptance Criteria validation, Guidance verification, and review approval constraints.
6. **Strict 404 Resource Hiding**: Out-of-scope tasks, sprints, or boards return HTTP 404 rather than 403 to prevent existence enumeration.
7. **Cursor Pagination**: All list and backlog endpoints must utilize cursor pagination (`{ items, nextCursor, totalReturned }`).
8. **Process Write Mutex**: SQLite write serialization via process-level lock (`executeWithWriteLock`) is maintained to prevent database locking errors.
9. **Project-Centric Ticket IDs**: Sequential atomic ticket keys (e.g. `DESK-1001`) via `ProjectSequence` remain preserved.
10. **Legacy Ticket Aliases**: `LegacyTicketAlias` resolution remains 100% functional.
11. **Graph Dependencies**: Directional `BLOCKS`, `DUPLICATES`, and symmetric `RELATES_TO` with cycle prevention remain authoritative.

---

## 4. PHASE 3 SCOPE

Phase 3 implements the following core systems:
- **Data Model Additions**: Additive `Sprint`, `SprintCommitment`, `Board`, `BoardColumn` models, and additive `sprintId`, `rank`, `storyPoints` attributes on `Task`.
- **Backlog Management**: Product and sprint backlogs, LexoRank reordering, hierarchy folding, sprint assignment, unplanned work tagging, and estimation.
- **Sprint Management Engine**: Sprint creation, planning, starting, completing, cancelling, capacity calculation, scope-change auditing, and incomplete task carry-over.
- **Kanban Board Engine**: Board configuration, column-to-status mapping, WIP limit evaluation (hard vs warning), swimlanes (by assignee, priority, parent epic), and quick filters.
- **Governed Drag-and-Drop**: Mutex-locked, validated drag actions for reordering, sprint re-allocation, and status transitions with server-side rollback support.
- **Telemetry & Notifications**: Audit logging for all agile operations and targeted notifications on sprint milestones and WIP violations.

---

## 5. OUT-OF-SCOPE ITEMS (DEFERRED TO FUTURE PHASES)

The following capabilities are explicitly deferred to maintain tight architectural focus:
- **Advanced Portfolio Roadmapping**: Gantt-chart style timeline scheduling across multiple initiatives (Phase 4).
- **Automated Resource Leveling**: Algorithmic resource balancing and team member vacation scheduling.
- **AI-Powered Sprint Estimation & Planning**: Automated story point suggestions or backlog grooming bots.
- **Cross-Organization Multi-Tenant Boards**: WorkDesk remains scoped to project and team boundaries.
- **Custom Workflow Designer**: Visual node-based workflow creator (workflows remain defined by canonical `WorkItemStatus` transitions).

---

## 6. DOMAIN MODEL

### Entity Relationship Architecture

```
+-----------------------------------------------------------+
|                          Project                          |
+-----------------------------------------------------------+
       | 1                                1 |
       | *                                  | *
+---------------+                   +---------------+
|    Sprint     |                   |     Board     |
+---------------+                   +---------------+
       | 1                                  | 1
       | *                                  | *
+--------------------+              +---------------+
|  SprintCommitment  |              |  BoardColumn  |
+--------------------+              +---------------+
       | *                                  | (maps to)
       | 1                                  v
+-----------------------------------------------------------+
|                           Task                            |
|-----------------------------------------------------------|
| - id: UUID                        - status: WorkItemStatus|
| - ticketId: String (unique)       - type: WorkItemType    |
| - sprintId: UUID? (FK -> Sprint)  - rank: String (Lexo)   |
| - storyPoints: Int?               - estimatedHours: Int?  |
+-----------------------------------------------------------+
```

### Invariant Rules
1. **Single Current Sprint**: A `Task` belongs to at most one current `Sprint` (`Task.sprintId`). If `sprintId` is `null`, the task resides in the Project Backlog.
2. **Historical Commitment Tracking**: When a sprint starts, all member tasks are snapshotted in `SprintCommitment` (`wasPlanned = true`). Any task added after start is recorded with `wasPlanned = false`. When a sprint completes, incomplete tasks have their `sprintId` cleared or moved to the next sprint, but `SprintCommitment` preserves their historical presence in the completed sprint.
3. **Zero WorkItem Duplication**: The board card, the backlog row, the sprint item, and the ticket cockpit view all load the exact same `Task` database record.

---

## 7. BACKLOG ARCHITECTURE

### Backlog Tiers & Filtering
The Backlog is organized into two primary tiers:
1. **Product Backlog**: Tasks where `sprintId IS NULL` and `status NOT IN ('DONE', 'CANCELLED')`, scoped by `projectId` or `teamId`.
2. **Sprint Backlog**: Tasks assigned to a specific `Sprint` (`sprintId = :sprintId`).

### Hierarchy Visualization
- Backlog displays Level-1 (`INITIATIVE`), Level-2 (`EPIC`), and Level-3 operational items (`STORY`, `TASK`, `BUG`, `REQUEST`, `IMPROVEMENT`, `ACTION_ITEM`).
- Level-4 `SUBTASK` items are folded underneath their parent Level-3 item and do not compete for independent backlog rank unless explicitly toggled in subtask view mode.
- Visual hierarchy chips display the parent Epic / Initiative badge alongside progress metrics (e.g. `3/5 subtasks completed`).

### Sprint Readiness Gate
A backlog item displays a "Sprint Ready" badge if:
- Story points or estimated hours are populated (`storyPoints > 0 || estimatedHours > 0`).
- Priority is assigned (`priority != null`).
- Has at least one Acceptance Criterion (`acceptanceCriteria.length > 0`).
- No unresolved blocking dependencies (`dependencies.filter(d => d.type === 'BLOCKS' && d.targetTask.status !== 'DONE').length === 0`).

---

## 8. SPRINT ARCHITECTURE & SCOPE INVARIANTS

### Sprint Entity Definition
```prisma
model Sprint {
  id              String             @id @default(uuid())
  projectId       String
  project         Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  teamId          String?
  team            Team?              @relation(fields: [teamId], references: [id], onDelete: SetNull)
  name            String
  goal            String?
  status          String             @default("PLANNED") // PLANNED | ACTIVE | COMPLETED | CANCELLED
  startDate       DateTime?
  endDate         DateTime?
  completedAt     DateTime?
  capacityPoints  Int?
  createdById     String
  createdBy       User               @relation("SprintCreator", fields: [createdById], references: [id])
  tasks           Task[]
  commitments     SprintCommitment[]
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt

  @@index([projectId, status])
  @@index([teamId, status])
}
```

### Exact Scope Definition & Active Sprint Invariant
In WorkDesk 2.0, **Sprint Scope** is defined by the explicit ownership boundary:
- **Team-Specific Scope**: `(projectId, teamId)` where `teamId IS NOT NULL`.
- **Project-Wide Scope**: `(projectId, teamId = NULL)` for projects operating as single cross-functional units without subdivided teams.

#### Invariants Enforced:
1. **Maximum Active Sprint Count**: For any distinct scope `(projectId, teamId)`, there can be at most **ONE** sprint in `status = 'ACTIVE'` at any time.
2. **Project-Wide vs Team-Specific Exclusivity**: If a project has an active project-wide sprint (`teamId = NULL`), team-specific sprints within that project cannot be started if they share member tasks.
3. **Database & Transaction Level Enforcement**:
   - Sprint start operations are executed inside the process write mutex (`executeWithWriteLock`) and a Prisma `$transaction`.
   - The engine explicitly queries:
     ```typescript
     const existingActive = await tx.sprint.findFirst({
       where: {
         projectId,
         teamId: teamId ?? null,
         status: 'ACTIVE',
       },
     });
     if (existingActive) {
       throw new ConflictException(
         `Scope already has an active sprint: "${existingActive.name}" (${existingActive.id}). Complete or cancel it before starting a new sprint.`
       );
     }
     ```
   - In addition, an SQLite/PostgreSQL unique partial index condition ensures physical database-level consistency:
     `CREATE UNIQUE INDEX unique_active_sprint_scope ON "Sprint" ("projectId", coalesce("teamId", '00000000-0000-0000-0000-000000000000')) WHERE "status" = 'ACTIVE';`
4. **Concurrent Start Race Protection**:
   - If two leads trigger concurrent `startSprint` requests for different sprints in the same scope, the process write lock serializes execution. The first transaction commits `status = 'ACTIVE'`; the second transaction immediately detects `existingActive !== null` and aborts with HTTP 409 Conflict.
   - Tested explicitly via automated concurrency suite.

---

## 9. SPRINT LIFECYCLE & COMMITMENT MODEL

```
          +-------------+
          |   PLANNED   |
          +-------------+
                 |
        startSprint() [Lead / Manager]
                 v
          +-------------+
          |   ACTIVE    | <----+ (Scope changes auditable in SprintCommitment)
          +-------------+      |
           /           \       |
completeSprint()     cancelSprint()
         v               v
  +-----------+    +-----------+
  | COMPLETED |    | CANCELLED |
  +-----------+    +-----------+
```

### Current Membership (`Task.sprintId`) vs Historical Commitment (`SprintCommitment`)
A fundamental architectural flaw in basic issue trackers is calculating historical sprint velocity from the current `Task.sprintId`. WorkDesk 2.0 explicitly decouples these two concepts:

1. **`Task.sprintId` (Mutable Current Pointer)**:
   - Identifies which sprint the task *currently* belongs to for board filtering, active backlog display, and card grouping.
   - Set to `null` when a task is in the Product Backlog.
2. **`SprintCommitment` (Immutable Historical Ledger)**:
   - An append-only audit ledger recording exact task commitment, status at start/end, scope changes, completion timestamps, and carry-over destinations.
   - Once a sprint transitions to `COMPLETED` or `CANCELLED`, its `SprintCommitment` records become permanently read-only.
   - **Historical sprint metrics and velocity calculations NEVER query mutable `Task.sprintId`; they query `SprintCommitment` exclusively.**

### `SprintCommitment` Model
```prisma
model SprintCommitment {
  id                    String    @id @default(uuid())
  sprintId              String
  sprint                Sprint    @relation(fields: [sprintId], references: [id], onDelete: Cascade)
  taskId                String
  task                  Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)
  wasPlanned            Boolean   @default(true) // true if committed at sprint start; false if added mid-sprint
  storyPoints           Int?      // Points snapshotted at time of commitment
  statusAtStart         String?   // Task status when sprint started (e.g. "TODO")
  statusAtEnd           String?   // Task status when sprint completed (e.g. "DONE" or "IN_PROGRESS")
  addedAt               DateTime  @default(now())
  removedAt             DateTime? // Populated if task removed mid-sprint (never physically deleted)
  completedAt           DateTime? // Populated when task reached DONE within sprint
  carriedOverToSprintId String?   // Nullable pointer to destination sprint if carried over

  @@unique([sprintId, taskId])
  @@index([sprintId])
  @@index([taskId])
}
```

### Sprint Lifecycle Mechanics
1. **Starting a Sprint (`PLANNED` $\rightarrow$ `ACTIVE`)**:
   - Atomic transaction verifies no active sprint exists in scope.
   - Sets sprint `status = 'ACTIVE'`, `startDate = now()`, `endDate = userEndDate`.
   - Iterates all tasks where `Task.sprintId = sprint.id` and creates a `SprintCommitment` row:
     `{ wasPlanned: true, storyPoints: task.storyPoints, statusAtStart: task.status, addedAt: now() }`.
   - Emits `SPRINT_STARTED` audit log.
2. **Mid-Sprint Additions (Unplanned Scope Addition)**:
   - When a task is added to an `ACTIVE` sprint:
     - `Task.sprintId` updated to `sprint.id`.
     - `SprintCommitment` row inserted with `wasPlanned = false, storyPoints: task.storyPoints, statusAtStart: task.status`.
     - Emits `SPRINT_SCOPE_CHANGED` audit log with `{ action: 'TASK_ADDED_UNPLANNED', ticketId: task.ticketId }`.
3. **Mid-Sprint Removals (Scope Reduction)**:
   - When a task is removed from an `ACTIVE` sprint:
     - `Task.sprintId` set to `null` (returned to Product Backlog).
     - Existing `SprintCommitment` row is NOT deleted; instead, `removedAt = now()`.
     - Emits `SPRINT_SCOPE_CHANGED` audit log with `{ action: 'TASK_REMOVED', ticketId: task.ticketId }`.
4. **Completing a Sprint (`ACTIVE` $\rightarrow$ `COMPLETED`)**:
   - For all tasks with `Task.status = 'DONE'`:
     - `SprintCommitment.completedAt = now()`, `statusAtEnd = 'DONE'`.
   - For incomplete tasks (`Task.status != 'DONE'`):
     - `SprintCommitment.completedAt = null`, `statusAtEnd = task.status`.
     - If carry-over requested to target sprint: `Task.sprintId = targetSprintId`, `SprintCommitment.carriedOverToSprintId = targetSprintId`.
     - If returned to backlog: `Task.sprintId = null`.
   - Sets sprint `status = 'COMPLETED'`, `completedAt = now()`.
   - Emits `SPRINT_COMPLETED` audit log.
5. **Cancelling a Sprint (`ACTIVE` / `PLANNED` $\rightarrow$ `CANCELLED`)**:
   - All tasks have `Task.sprintId` set to `null`.
   - Sets sprint `status = 'CANCELLED'`.
   - Emits `SPRINT_CANCELLED` audit log with cancellation reason.

---

## 10. ESTIMATION MODEL

WorkDesk 2.0 maintains a dual, non-overlapping estimation approach:
1. **Story Points (`Task.storyPoints`)**:
   - Represents abstract effort/complexity for Agile velocity and sprint capacity planning.
   - Constrained to standard Fibonacci numbers: `1, 2, 3, 5, 8, 13, 21` (or custom integer up to 100).
   - Story points belong to standard operational work items (`STORY`, `TASK`, `BUG`, `IMPROVEMENT`).
   - Epic story points are dynamically derived from the sum of children.
2. **Hour Tracking (`Task.estimatedHours` & `Task.actualHours`)**:
   - Preserved from Phase 2 for time-tracking, operational deadlines, and SLA compliance.
   - Story points and hours remain cleanly separated; no lossy or arbitrary point-to-hour conversion formula is forced on teams.

---

## 11. KANBAN ARCHITECTURE & STATUS MAPPING

### Board Entities
```prisma
model Board {
  id          String        @id @default(uuid())
  projectId   String
  project     Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  type        String        @default("KANBAN") // KANBAN | SCRUM
  filterQuery String?       // Optional JSON filter criteria
  columns     BoardColumn[]
  createdById String
  createdBy   User          @relation("BoardCreator", fields: [createdById], references: [id])
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([projectId])
}

model BoardColumn {
  id             String   @id @default(uuid())
  boardId        String
  board          Board    @relation(fields: [boardId], references: [id], onDelete: Cascade)
  name           String
  orderIndex     Int      @default(0)
  wipLimit       Int      @default(0) // 0 = no limit
  wipLimitType   String   @default("WARNING") // WARNING | HARD_LIMIT
  mappedStatuses String   // JSON array of WorkItemStatus strings: e.g. ["IN_PROGRESS", "BLOCKED"]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([boardId, orderIndex])
}
```

### Precise Column $\rightarrow$ WorkItemStatus Mapping
Every board column maps to one or more canonical `WorkItemStatus` values. The board **never** invents new statuses.

#### Standard Board Mapping Definition:
| Column Name | Mapped Statuses (`mappedStatuses`) | Default Target Status | Review Required Redirect |
| :--- | :--- | :--- | :--- |
| **To Do** | `['TODO', 'REOPENED', 'DRAFT']` | `TODO` | N/A |
| **In Progress** | `['IN_PROGRESS']` | `IN_PROGRESS` | N/A |
| **Blocked** | `['BLOCKED']` | `BLOCKED` (requires `blockerReason`) | N/A |
| **In Review** | `['IN_REVIEW', 'CHANGES_REQUESTED']` | `IN_REVIEW` | N/A |
| **Done** | `['APPROVED', 'DONE']` | `DONE` | `IN_REVIEW` (if `requiresReview = true` & unapproved) |

### Drag-and-Drop Semantics for Multi-Status Columns
When a card is dragged into a column representing multiple statuses:
1. **Intra-Column Reordering**: If the task's *current status* is already one of the column's mapped statuses, the status is **NOT changed**. Only its LexoRank rank is updated.
2. **Inter-Column Transition**:
   - If the payload specifies an explicit `targetStatus`, that status is validated.
   - If no `targetStatus` is provided, the column's **Default Target Status** is selected.
   - **Review Gate Interception**: If the target column is "Done" but `task.requiresReview = true` and `task.status !== 'APPROVED'`, the system automatically routes the transition to `IN_REVIEW` (or rejects if direct DONE is attempted without review).

### Authoritative Governed Transition Flow
**A Kanban operation NEVER mutates `Task.status` directly.**
The exact required execution pipeline is:

```
[Card Drag Event on Kanban Canvas]
                |
                v
1. AUTHENTICATION & CAPABILITY GUARD
   - Validate active session via SessionGuard
   - Require Permission.TRANSITION_TASK via PermissionsGuard
                |
                v
2. RESOURCE-SCOPE ENFORCEMENT
   - Fetch task via TasksService.getTaskById()
   - Return strict HTTP 404 if outside tenant/team scope
                |
                v
3. BOARD & COLUMN CAPACITY CHECK
   - Verify column belongs to board
   - Evaluate column WIP Limits (HARD_LIMIT vs WARNING)
                |
                v
4. PHASE 2 TRANSITION ENGINE
   - Invoke TasksService.transitionTask()
   - Check valid state machine transitions (Phase 2 matrix)
   - Check blocker reason requirements (if moving to/from BLOCKED)
   - Check review approval constraints
   - Execute Authoritative Server-Side Done Gate:
     * All mandatory AcceptanceCriteria isCompleted === true
     * All required GuidancePoints isCompleted === true
     * At least 1 WorkEvidence verified
     * Zero unresolved BLOCKS dependencies
                |
                v
5. LEXORANK POSITIONING
   - Calculate new rank within target column
                |
                v
6. TRANSACTION COMMIT
   - Update Task(status, rank, blockerReason, completedAt)
   - Update SprintCommitment(completedAt) if in active sprint
   - Write AuditLog(BOARD_CARD_MOVED, STATUS_CHANGED)
                |
                v
7. POST-COMMIT ACTIONS
   - Asynchronously dispatch notifications
   - Return authoritative TaskDto
                |
                v
8. CLIENT RECONCILIATION
   - On 200 OK: confirm position and visual state
   - On Rejection: instantly rollback card to previous column and rank + show toast error
```

---

## 12. WIP LIMITS & ENFORCEMENT SEMANTICS

Column WIP limits enforce flow and prevent multitasking bottlenecks.
- **`WARNING` Semantics**:
  - The card transition is permitted.
  - The UI highlights the column header in amber/red (`5 / 4 WIP`).
  - Emits audit log `WIP_LIMIT_EXCEEDED` with actor ID and count.
- **`HARD_LIMIT` Semantics**:
  - Server calculates active task count in column: `currentCount = count(tasks in column)`.
  - If `currentCount >= column.wipLimit`, mutation is **strictly rejected** with HTTP 400 Bad Request:
    `"Column WIP limit exceeded: Column '${column.name}' is capped at ${column.wipLimit} tasks (currently ${currentCount})"`
- **Exemptions & Overrides**:
  - **DONE Transitions Exempt**: Moving a task into a completed/Done column is **ALWAYS EXEMPT** from WIP limits. Completion must never be blocked by WIP caps.
  - **BLOCKED Work NOT Exempt**: Blocked tasks count toward WIP to prevent hiding blocked work.
  - **Manager / Lead Override**:
    - Only `ROLE_MANAGER` and `ROLE_LEAD` can override a `HARD_LIMIT`.
    - Must provide: `{ overrideWipLimit: true, overrideReason: string }`.
    - If `overrideReason` is missing or under 10 characters, the request is rejected with HTTP 400.
    - Emits high-priority audit log `WIP_HARD_LIMIT_OVERRIDDEN` with actor and reason.
- **Concurrent WIP Enforcement**:
  - Protected by `executeWithWriteLock` + Prisma transaction. The count check and task update are serialized, preventing two users from racing past a limit of 1 slot.

---

## 13. LEXORANK CONCURRENCY & INTEGRITY STRATEGY

### Architectural Realism: Race Conditions & Mitigations
LexoRank eliminates the table-wide locking of integer indexing (`position = position + 1`), but **LexoRank alone does not prevent race conditions**. A multi-user agile platform must explicitly handle concurrent drops, same-task concurrent moves, and precision exhaustion.

### 1. Rank Representation & Uniqueness
- **Format**: `bucket|rankString:` (e.g. `"0|hzzzzz:"`).
- **Alphabet**: Base-36 characters `[0-9a-z]`.
- **Compound Database Ordering**:
  - To prevent sorting ambiguity if two items ever share an identical rank, database queries enforce a deterministic tie-breaker:
    `ORDER BY rank ASC, createdAt ASC, ticketId ASC`.

### 2. Transaction Boundary & Server Re-Read
- The client provides: `{ ticketId, targetRankAbove?, targetRankBelow? }`.
- **The server does NOT blindly trust client-provided rank strings.**
- Reorder operations run inside `executeWithWriteLock` and Prisma `$transaction`.
- The server re-reads the *actual current database ranks* of the preceding and succeeding tasks inside the locked transaction.

### 3. Concurrent Reorder Scenarios & Handling
1. **Two Users Inserting Between Same Items (A and B)**:
   - User 1 requests move between A and B. Write lock serializes: User 1 gets midpoint $M_1 = \text{midpoint}(A, B)$ and commits.
   - User 2's request is dequeued: Server re-reads the slot, sees $M_1$ now exists between A and B, and calculates $M_2 = \text{midpoint}(M_1, B)$.
   - **Result**: Both tasks succeed, receive unique ranks, and order deterministically without conflict or lost updates.
2. **Two Users Moving the Same Task Simultaneously**:
   - User 1 moves Task X to Top. User 2 moves Task X to Bottom.
   - User 1 acquires lock, updates Task X rank to Top, and commits.
   - User 2 acquires lock, updates Task X rank to Bottom, and commits.
   - **Result**: Serialized execution; the latest commit wins. Both clients receive authoritative rank responses. Client 1 reconciles when it receives websocket/polling update or subsequent query.
3. **Optimistic Versioning & Conflict Detection**:
   - Backlog reorder payload includes `taskVersion` (based on `updatedAt`).
   - If `taskVersion` is stale by more than 30 seconds or conflicting, the server rejects with HTTP 409 Conflict: `"Task order was modified by another user. Re-syncing."` and returns the latest backlog order.

### 4. Rank Exhaustion & Rebalancing Strategy
- Fractional string midpointing allows hundreds of consecutive insertions at the same boundary before string growth becomes noticeable.
- **Threshold**: If any task's `rank` string length exceeds **64 characters**, the system marks the backlog scope as needing rebalance.
- **Rebalance Procedure**:
  - Executed inside a write lock during off-peak or automatically triggered.
  - Queries all tasks in scope ordered by `rank ASC`.
  - Re-spaces all items evenly with default 6-character ranks: `"0|100000:"`, `"0|200000:"`, `"0|300000:"`, etc., in steps of `100000`.
  - Updates tasks in a single atomic transaction.

---

## 14. CAPACITY PLANNING & SWIMLANES

### Capacity Planning
- Embedded directly in Sprint Planning view.
- Calculated metrics:
  - $\text{Total Capacity} = \text{Sprint.capacityPoints}$ (configured by Lead/Manager).
  - $\text{Committed Points} = \sum \text{Task.storyPoints}$ for all tasks in sprint.
  - $\text{Capacity Gauge}$: Green ($\le 85\%$), Amber ($85\% - 100\%$), Red ($> 100\%$ Overcommitted warning).

### Kanban Swimlanes
Supported on `/boards/:boardId/tasks`:
1. **Assignee Swimlane**: Tasks grouped by team member with an "Unassigned" lane.
2. **Epic Swimlane**: Level-3 tasks grouped by their parent Level-2 Epic.
3. **Priority Swimlane**: Expedited row for `Critical`, followed by `High`, `Medium`, `Low`.

---

## 15. AUTHORIZATION MATRIX

All operations are capability-based and enforced via `@RequirePermissions(...)` + `TasksService` / `SprintsService` resource-scoping.

| Capability / Action | Permission Key | Employee | Lead | Manager | Resource Scope Enforcement |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **View Backlog** | `VIEW_OWN_TASKS` / `VIEW_TEAM_TASKS` | Scoped | Team/Project | Global | Employee sees assigned/team items; Lead sees project scope; Manager sees all. |
| **Reorder Backlog** | `MANAGE_BACKLOG` | Denied | Project | Global | Strict 404 if project outside Lead's assigned projects. |
| **Create Sprint** | `MANAGE_SPRINTS` | Denied | Project | Global | Lead can only create for their project/team. |
| **Start Sprint** | `MANAGE_SPRINTS` | Denied | Project | Global | Validates project ownership + active sprint uniqueness. |
| **Complete Sprint** | `MANAGE_SPRINTS` | Denied | Project | Global | Validates project ownership. |
| **Cancel Sprint** | `MANAGE_SPRINTS` | Denied | Project | Global | Lead/Manager only. |
| **Assign Task to Sprint** | `MANAGE_SPRINTS` | Denied | Project | Global | Validates both task and sprint belong to same project. |
| **Move Card on Board** | `TRANSITION_TASK` | Assigned | Team/Project | Global | Card move triggering status transition checks review gates & Done Gate. |
| **Configure Board / WIP**| `MANAGE_BOARDS` | Denied | Project | Global | Lead and Manager only. |

*Zero new roles. Zero references to `ROLE_SUPER_ADMIN`.*

---

## 16. API DESIGN

### 1. Backlog Endpoints
- `GET /api/v1/projects/:projectId/backlog`
  - Permissions: `VIEW_TEAM_TASKS`
  - Query: `cursor?: string, limit?: number, type?: string, priority?: string`
  - Returns: `{ items: TaskDto[], nextCursor?: string, totalReturned: number }`
- `PATCH /api/v1/projects/:projectId/backlog/reorder`
  - Permissions: `MANAGE_BACKLOG`
  - Body: `{ ticketId: string, targetRankAbove?: string, targetRankBelow?: string }`
  - Returns: `{ ticketId: string, rank: string }`

### 2. Sprint Lifecycle Endpoints
- `GET /api/v1/projects/:projectId/sprints`
  - Permissions: `VIEW_TEAM_TASKS`
  - Returns: `SprintDto[]`
- `POST /api/v1/projects/:projectId/sprints`
  - Permissions: `MANAGE_SPRINTS`
  - Body: `{ name: string, goal?: string, startDate?: string, endDate?: string, capacityPoints?: number, teamId?: string }`
  - Returns: `SprintDto`
- `GET /api/v1/sprints/:sprintId`
  - Permissions: `VIEW_TEAM_TASKS`
  - Returns: `SprintDetailDto` (includes commitment stats and member tasks)
- `POST /api/v1/sprints/:sprintId/start`
  - Permissions: `MANAGE_SPRINTS`
  - Body: `{ startDate: string, endDate: string }`
- `POST /api/v1/sprints/:sprintId/complete`
  - Permissions: `MANAGE_SPRINTS`
  - Body: `{ incompleteTaskAction: 'MOVE_TO_BACKLOG' | 'MOVE_TO_SPRINT', targetSprintId?: string }`
- `POST /api/v1/sprints/:sprintId/cancel`
  - Permissions: `MANAGE_SPRINTS`
  - Body: `{ reason?: string }`

### 3. Sprint Task Membership
- `POST /api/v1/sprints/:sprintId/tasks`
  - Permissions: `MANAGE_SPRINTS`
  - Body: `{ ticketIds: string[] }`
- `DELETE /api/v1/sprints/:sprintId/tasks/:ticketId`
  - Permissions: `MANAGE_SPRINTS`

### 4. Kanban Board Endpoints
- `GET /api/v1/projects/:projectId/boards`
  - Permissions: `VIEW_TEAM_TASKS`
  - Returns: `BoardDto[]`
- `POST /api/v1/projects/:projectId/boards`
  - Permissions: `MANAGE_BOARDS`
  - Body: `{ name: string, type: 'KANBAN' | 'SCRUM', columns: CreateBoardColumnDto[] }`
- `GET /api/v1/boards/:boardId`
  - Permissions: `VIEW_TEAM_TASKS`
  - Returns: `BoardDetailDto`
- `GET /api/v1/boards/:boardId/tasks`
  - Permissions: `VIEW_TEAM_TASKS`
  - Query: `TaskFilterDto`
  - Returns: `{ columns: { columnId: string, tasks: TaskDto[] }[] }`
- `POST /api/v1/boards/:boardId/tasks/:ticketId/move`
  - Permissions: `TRANSITION_TASK`
  - Body: `{ targetColumnId: string, targetStatus?: WorkItemStatus, targetRankAbove?: string, targetRankBelow?: string, overrideWipLimit?: boolean, overrideReason?: string }`
  - Returns: `TaskDto`

---

## 17. FRONTEND ROUTE & PAGE DESIGN

Integrated into existing Vite/React SPA under `apps/web/src/App.tsx`:
1. `/projects/:projectId/backlog` $\rightarrow$ `BacklogPage`
   - Split view: Active/Planned Sprints (collapsible header cards) + Product Backlog list.
   - Dragging between Sprints or into Backlog reallocates `sprintId`.
   - Dragging within list reorders LexoRank.
2. `/projects/:projectId/sprints/:sprintId/planning` $\rightarrow$ `SprintPlanningPage`
   - Left pane: Available Product Backlog items.
   - Right pane: Target Sprint commitment bucket with capacity progress bar.
3. `/projects/:projectId/boards/:boardId` $\rightarrow$ `KanbanBoardPage`
   - Full-width dual-axis Kanban canvas.
   - Column headers with WIP counters (e.g. `In Progress (4 / 5)`).
   - Swimlane toggles: Assignee, Epic, Priority.
   - Rich interactive cards: Type icon, ticket key, title, priority pill, story points badge, blocked alert icon, assignee avatar.

---

## 18. MIGRATION SAFETY & EXECUTION STRATEGY

### Current Repository State Analysis
- Active Database: SQLite `apps/api/prisma/dev.db` (495,616 bytes).
- Migration Tracking: No `prisma/migrations` folder exists historically; the repository was baselined with direct physical backups and inspected schema diffs.
- **Strict Rule**: `prisma db push` must NOT be used as an unreviewed substitute.

### Phase 3 Step-by-Step Migration Execution Plan
1. **Physical Binary Pre-Migration Snapshot**:
   - Create automated physical copy: `apps/api/prisma/dev.db.backup.phase3_pre_migration_<timestamp>.db`.
2. **Explicit SQL Migration Generation & Inspection**:
   - Generate exact SQL diff via:
     `npx prisma migrate diff --from-url "file:./dev.db" --to-schema-datamodel "./schema.prisma" --script > phase3_migration.sql`
   - Verify SQL contains:
     - Purely additive `CREATE TABLE "Sprint"`
     - Purely additive `CREATE TABLE "SprintCommitment"`
     - Purely additive `CREATE TABLE "Board"`
     - Purely additive `CREATE TABLE "BoardColumn"`
     - SQLite non-destructive table redefinition for `Task` copying all 24 existing columns verbatim and adding:
       - `"sprintId" TEXT`
       - `"rank" TEXT NOT NULL DEFAULT '0|hzzzzz:'`
       - `"storyPoints" INTEGER`
     - **0 DROP TABLE of existing tables.**
     - **0 DROP COLUMN.**
3. **Execution**:
   - Apply the reviewed SQL migration script non-destructively to `dev.db`.
4. **Data Backfill**:
   - Backfill existing 243 `Task` records with default sequential LexoRanks (`"0|h00000:"`, `"0|h00010:"`, etc.) ordered by `createdAt ASC`.
   - Seed default Scrum and Kanban boards for existing Project `DESK` with standard columns mapped to canonical statuses.
5. **Post-Migration Reconciliation Audit**:
   - Run automated reconciliation audit comparing pre-backup vs post-db:
     - Pre/post count for `User`, `Task`, `TaskPoint`, `AcceptanceCriterion`, `TaskEvidence`, `TaskDependency`, `Project`, `ProjectSequence`, `LegacyTicketAlias`.
     - 100% preservation of all 189 original tickets and parent-child links.
6. **Future PostgreSQL Compatibility**:
   - All proposed models and attributes use standard Prisma datatypes (`String`, `Int`, `Boolean`, `DateTime`, foreign keys with `@relation`) completely compatible with PostgreSQL `CREATE TABLE`, `ALTER TABLE ADD COLUMN`, and B-tree compound indexing.

---

## 19. REQUIRED REGRESSION INVARIANTS

Phase 3 guarantees 100% preservation of every Phase 1 and Phase 2 invariant without alteration:
1. **Exact 3 Roles**: `ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`. Zero new roles.
2. **No Runtime ROLE_SUPER_ADMIN**: Zero references in application code or database.
3. **Task is Single Canonical Authority**: No duplicate `WorkItem`, `Issue`, or `SprintTask` tables.
4. **WorkItemStatus is Single Status Authority**: Canonical 10-status enum. Zero competing board/sprint statuses.
5. **Phase 2 Done Gate is Non-Bypassable**: Mandatory Acceptance Criteria, Guidance Points, Work Evidence, and review gates cannot be bypassed via board drag or API.
6. **Graph Dependency Engine Intact**: Directional `BLOCKS`, `DUPLICATES`, symmetric `RELATES_TO`, and DFS cycle prevention remain authoritative.
7. **ProjectSequence Allocation Intact**: Ticket allocation (`DESK-XXXX`) remains atomic and sequential.
8. **LegacyTicketAlias Intact**: Backward-compatible ticket resolution remains functional.
9. **Strict 404 Resource Hiding**: Out-of-scope tasks, sprints, or boards return HTTP 404 to prevent resource existence enumeration.
10. **Cursor Pagination Preserved**: Preserved across all task, backlog, and board endpoints.
11. **Single Authorization Architecture**: Reuses `SessionGuard`, `PolicyGuard`, and `PermissionsGuard`.

---

## 20. CONCURRENCY & TEST MATRIX

### Concurrency Test Scenarios (Automated Suite: `test/phase3-concurrency-suite.spec.ts`)
1. **10 Concurrent Reorders into Same Adjacent Slot**:
   - 10 requests moving different tasks between Task A and Task B.
   - **Invariant**: All 10 succeed, receive unique non-colliding LexoRanks, and sort deterministically.
2. **Concurrent Sprint Starts**:
   - 10 simultaneous requests attempting to start different sprints in the exact same `(projectId, teamId)` scope.
   - **Invariant**: Exactly 1 succeeds (`status = 'ACTIVE'`); 9 are rejected with HTTP 409 Conflict.
3. **Concurrent Moves into HARD_LIMIT WIP Column**:
   - 10 simultaneous moves into a column with `wipLimit = 1` and 0 current tasks.
   - **Invariant**: Exactly 1 succeeds; 9 are rejected with HTTP 400 Bad Request.
4. **Concurrent Same-Task Moves**:
   - 2 simultaneous requests moving Task X to different columns.
   - **Invariant**: Serialized safely; final database state matches last committed transaction; zero corrupt rows.

### Authorization Tests (`test/phase3-resource-scope-auth.spec.ts`)
- Employee reading another team's backlog $\rightarrow$ HTTP 404.
- Employee attempting to reorder backlog $\rightarrow$ HTTP 403 Forbidden.
- Lead starting sprint for another project $\rightarrow$ HTTP 404.
- Lead moving card bypassing review gate $\rightarrow$ rejected by review workflow.
- Manager org-wide governance $\rightarrow$ HTTP 200 OK.

---

## 21. IMPLEMENTATION SEQUENCE

```
[3.0 Schema Foundation & Shared DTOs]
                 |
                 v
[3.1 LexoRank Engine & Backlog Service]
                 |
                 v
[3.2 Sprint Lifecycle & Commitment Engine]
                 |
                 v
[3.3 Kanban Board & Column Engine]
                 |
                 v
[3.4 Governed Drag-and-Drop Mutation APIs]
                 |
                 v
[3.5 Frontend Backlog Management UI]
                 |
                 v
[3.6 Frontend Sprint Planning Workspace]
                 |
                 v
[3.7 Frontend Interactive Kanban Canvas]
                 |
                 v
[3.8 Concurrency & Authorization Test Suite]
                 |
                 v
[3.9 Phase 1 & 2 Regression Verification]
```

---

## 22. FILE-BY-FILE CHANGE PLAN

### 1. Packages Shared (`packages/shared/src/index.ts`)
- **MODIFY**: Add `SprintDto`, `SprintStatus`, `BoardDto`, `BoardColumnDto`, `TaskFilterDto`, LexoRank helper types, and new permissions (`MANAGE_SPRINTS`, `MANAGE_BACKLOG`, `MANAGE_BOARDS`).

### 2. Prisma Schema (`apps/api/prisma/schema.prisma`)
- **MODIFY**: Add `Sprint`, `SprintCommitment`, `Board`, `BoardColumn` models; add `sprintId`, `rank`, `storyPoints` to `Task`.

### 3. API Services & Controllers (`apps/api/src/`)
- **CREATE**: `apps/api/src/sprints/sprints.module.ts`
- **CREATE**: `apps/api/src/sprints/sprints.service.ts`
- **CREATE**: `apps/api/src/sprints/sprints.controller.ts`
- **CREATE**: `apps/api/src/boards/boards.module.ts`
- **CREATE**: `apps/api/src/boards/boards.service.ts`
- **CREATE**: `apps/api/src/boards/boards.controller.ts`
- **CREATE**: `apps/api/src/common/lexorank.ts` (Midpoint calculation utility)
- **MODIFY**: `apps/api/src/tasks/tasks.service.ts` (Add backlog queries, rank updates, sprint filtering)
- **MODIFY**: `apps/api/src/tasks/tasks.controller.ts` (Add backlog endpoints)
- **MODIFY**: `apps/api/src/app.module.ts` (Register `SprintsModule`, `BoardsModule`)

### 4. Frontend Pages & Components (`apps/web/src/`)
- **CREATE**: `apps/web/src/pages/BacklogPage.tsx`
- **CREATE**: `apps/web/src/pages/SprintPlanningPage.tsx`
- **CREATE**: `apps/web/src/pages/KanbanBoardPage.tsx`
- **CREATE**: `apps/web/src/components/kanban/KanbanCard.tsx`
- **CREATE**: `apps/web/src/components/kanban/KanbanColumn.tsx`
- **CREATE**: `apps/web/src/components/backlog/BacklogRow.tsx`
- **CREATE**: `apps/web/src/components/sprints/SprintHeaderCard.tsx`
- **MODIFY**: `apps/web/src/App.tsx` (Register `/projects/:projectId/backlog`, `/sprints/:sprintId/planning`, `/boards/:boardId`)
- **MODIFY**: `apps/web/src/components/Layout.tsx` (Add navigation links for Backlog and Boards)

### 5. Automated Tests (`apps/api/test/`)
- **CREATE**: `apps/api/test/phase3-concurrency-suite.spec.ts`
- **CREATE**: `apps/api/test/phase3-resource-scope-auth.spec.ts`
- **CREATE**: `apps/api/test/phase3-sprint-lifecycle.spec.ts`

---

## 23. EXPLICIT PHASE 3 IMPLEMENTATION GATE

```text
PHASE 3 PLANNING COMPLETE.

NO PHASE 3 APPLICATION CODE HAS BEEN WRITTEN.
NO PHASE 3 DATABASE MIGRATION HAS BEEN CREATED OR EXECUTED.
NO PHASE 3 DATABASE SCHEMA CHANGE HAS BEEN APPLIED.
NO NEW INFRASTRUCTURE HAS BEEN INSTALLED.

AWAITING EXPLICIT USER APPROVAL TO BEGIN PHASE 3 IMPLEMENTATION.
```
