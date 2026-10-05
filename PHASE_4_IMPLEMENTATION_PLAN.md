# WORKDESK 2.0 — PHASE 4 IMPLEMENTATION PLAN (REVISED)
## Enterprise Work Management, Planning, Accountability, Visibility & Intelligence

**Document Version**: 2.0.0 (Comprehensive Planning Correction)  
**Status**: **PLANNING ONLY — ABSOLUTE IMPLEMENTATION HALT**  
**Frozen Baseline**: Phase 1 + Phase 2 + Phase 3 (Formally Closed & Verified)  
**Target Milestone**: Phase 4 — Enterprise Planning, Accountability, Health & Intelligence  

---

# 1. EXECUTIVE SUMMARY & REVISED ARCHITECTURAL POSTURE

WorkDesk 2.0 has built, verified, and frozen:
1. **Phase 1 Foundation**: Identity, 3-role governance (`ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`), team/project structures, sequential ticket numbering (`ProjectSequence`, `LegacyTicketAlias`), and resource-scope authorization.
2. **Phase 2 Work Item Cockpit**: Single canonical work-item model (`Task`), 4-tier hierarchy (`INITIATIVE` $\to$ `EPIC` $\to$ Level-3 $\to$ `SUBTASK`), 10-state state machine, authoritative server-side Done Gate, Acceptance Criteria, Guidance Points, Work Evidence, and cycle-free directional dependencies (`BLOCKS`, `RELATES_TO`, `DUPLICATES`).
3. **Phase 3 Agile Execution**: Product Backlog with LexoRank fractional indexing, Sprint lifecycle with immutable `SprintCommitment` historical ledger, single active sprint scope invariant `(projectId, teamId)`, Agile Kanban boards with column mapping, WIP limits (`WARNING` vs `HARD_LIMIT` with Lead/Manager override), and governed drag-and-drop card moves.

**Phase 4 Objective**: Evolve WorkDesk from execution and backlog management into an **enterprise work-management, accountability, delivery health, and operational visibility platform** without introducing parallel data silos or compromising the frozen three-role model.

### Key Architectural Resolutions in this Revision
1. **Capacity Management**: All arbitrary percentage thresholds are eliminated. Formal units, configurable parameters, working-hour budgets, and leave allowances are established using existing `Task` and `Sprint` fields.
2. **Accountability Metrics**: Every metric is mathematically and formally specified with exact formulas, inclusion/exclusion rules, edge-case behavior (cancelled tasks, missing deadlines, carry-over), source records, and scope boundaries.
3. **Delivery Health Engine**: Strictly operational, deterministic, and explainable (`Signal -> Evidence -> Rule -> Health State -> Recommendation`). Zero black-box employee scoring.
4. **Governed Bulk Operations**: Contradictions resolved. Formally defined as **transaction-safe per-item bulk execution with explicit success/failure reporting**, routing every status mutation through the Phase 2 state machine and Done Gate.
5. **Search Architecture**: Server-side, database-native (SQLite `LIKE`/FTS $\to$ PostgreSQL `tsvector`/`ILIKE`), with strict pre-query authorization scoping. Zero external search clusters.
6. **Automation Engine**: Rigorous Event-Condition-Action governance model with explicit execution identity, permission revalidation, recursion depth caps ($\le 2$), idempotency hashing, and rate limiting.
7. **Ask WorkDesk AI**: Strictly constrained to a **READ-ONLY** informational assistant grounded in pre-filtered authorized context with mandatory ticket citations. Zero direct mutation capability in Phase 4.
8. **Internal Gate Division**: Phase 4 is structured into four sequential, independently verifiable capability gates: **Phase 4A**, **Phase 4B**, **Phase 4C**, and **Phase 4D**.

---

# 2. CURRENT-SYSTEM AUDIT

An audit of the repository (`apps/api`, `apps/web`, `packages/shared`, `schema.prisma`, and SQLite database) confirms the following baseline:

| Subsystem | Existing Implementation Reality | Reusability in Phase 4 |
|---|---|---|
| **Work Item Model** | Single table `Task` in `schema.prisma` with 10 concrete types and 4 hierarchy tiers. | **100% Canonical**. No parallel tables permitted. |
| **Hours & Time** | `Task.estimatedHours: Int?` and `Task.actualHours: Int?` already exist. | **100% Reuse**. No separate timesheet table needed. |
| **Dates & Deadlines**| `Task.startDate: DateTime?` and `Task.deadline: DateTime?` already exist. | **100% Reuse** for Gantt, Timeline, Calendar, and Deadlines. |
| **Points & Sprints** | `Task.storyPoints: Int?` and `Sprint.capacityPoints: Int?` already exist. | **100% Reuse** for Sprint planning and capacity tracking. |
| **Historical Ledger**| `SprintCommitment` snapshots `wasPlanned`, `storyPoints`, `statusAtStart`, `statusAtEnd`, `removedAt`, `completedAt`, `carriedOverToSprintId`. | **100% Reuse** for Say/Do ratio, velocity, and scope-creep tracking. |
| **Dependencies** | `TaskDependency` with `BLOCKS`, `RELATES_TO`, `DUPLICATES` and DFS cycle detection. | **100% Reuse**. Only `BLOCKS` participates in critical-path scheduling. |
| **Done Gate** | `TasksService.evaluateDoneGate()` enforces criteria, guidance, reviews, dependencies, and evidence. | **100% Inviolable**. Cannot be bypassed by bulk, Gantt, or automation. |
| **Meetings & Actions**| `Meeting`, `MeetingDecision`, and `MeetingActionItem` with `convertedTaskId: String? @unique`. | **Extend**. Enforce `ACTION_ITEM` typing and decision linkages. |
| **Standup Blockers**| `Standup` and `StandupBlocker` with `convertedTaskId: String? @unique`. | **Extend**. Direct linking of standup blockers to blocked tasks. |
| **KPIs & Reports** | `KpisService` (completion, on-time, overdue rates) and `ReportsService` (CSV exports). | **Extend**. Build advanced analytics and Control Tower on top. |
| **Audit & Alerts** | `AuditLog`, `Notification`, and `NotificationPreference` models exist. | **100% Reuse**. All Phase 4 events route through existing audit/alert pipeline. |

---

# 3. EXISTING VS MISSING CAPABILITY MATRIX

| Capability | Already Exists | Partially Exists | Missing | Architectural Action |
|---|:---:|:---:|:---:|---|
| **Single Work Item (`Task`)** | ✅ | — | — | **REUSE EXISTING**. Single canonical authority. |
| **Role Model (3 Roles)** | ✅ | — | — | **REUSE EXISTING**. No runtime admin or executive roles. |
| **Done Gate & State Machine** | ✅ | — | — | **REUSE EXISTING**. Mandatory boundary for all mutations. |
| **Workload & Capacity Engine**| — | ✅ (Fields exist) | ✅ (Calculations) | **EXTEND EXISTING**. Aggregate hours/points per user & sprint. |
| **Timeline / Gantt Canvas** | — | ✅ (Dates exist) | ✅ (Gantt engine) | **EXTEND EXISTING**. Pure view/scheduling engine over `Task`. |
| **Unified Work Calendar** | — | ✅ (Entities have dates) | ✅ (Aggregator) | **EXTEND EXISTING**. Pure virtual query view; 0 storage. |
| **Accountability Metrics** | — | ✅ (Ledger exists) | ✅ (Formal engine)| **EXTEND EXISTING**. Formally defined deterministic metrics. |
| **Delivery Health Engine** | — | ✅ (Urgency exists) | ✅ (Project health)| **EXTEND EXISTING**. Explainable rule-based health grading. |
| **Management Control Tower** | — | ✅ (Basic KPIs exist) | ✅ (Console view) | **EXTEND EXISTING**. Executive cockpit for Manager & Lead. |
| **Advanced Analytics (CFD/Cycle)**| — | ✅ (Timestamps exist)| ✅ (Cycle/CFD) | **EXTEND EXISTING**. Server calculation over activity logs. |
| **Global Search** | — | ✅ (Page filters) | ✅ (Scoped search)| **EXTEND EXISTING**. Native SQL/Prisma search with pre-scoping. |
| **Governed Bulk Operations** | — | — | ✅ (Endpoint) | **NEW CAPABILITY**. Per-item transactional execution. |
| **Traceability Hardening** | — | ✅ (1:1 conversion)| ✅ (Type/blockers) | **EXTEND EXISTING**. Set `ACTION_ITEM` & `BLOCKS` relations. |
| **Project Decision Log** | — | ✅ (Meeting decision)| ✅ (Project entity)| **NEW ENTITY REQUIRED** (`ProjectDecision`, `TaskDecision`). |
| **Automation Engine** | — | — | ✅ (ECA engine) | **NEW ENTITY REQUIRED** (`AutomationRule`). |
| **Smart Notification Digests** | — | ✅ (Notifications) | ✅ (Digest jobs) | **EXTEND EXISTING**. Scheduled summary digests. |
| **Read-Only Ask WorkDesk AI** | — | — | ✅ (Scoped RAG) | **NEW CAPABILITY**. Scoped read-only context retrieval. |

---

# 4. INTERNAL PHASE 4 CAPABILITY GATES

To ensure verifiable, safe, and incremental execution, Phase 4 is divided into four distinct internal capability gates:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PHASE 4: MASTER ROADMAP                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
       ┌───────────────────────────────┴───────────────────────────────┐
       ▼                                                               ▼
┌──────────────────────────────┐                       ┌──────────────────────────────┐
│  GATE 4A: Planning &         │                       │  GATE 4B: Accountability &   │
│  Visibility                  │                       │  Management Control          │
├──────────────────────────────┤                       ├──────────────────────────────┤
│ 4A.1 Workload & Capacity     │                       │ 4B.1 Accountability Metrics  │
│ 4A.2 Timeline / Gantt Canvas │──────────────────────►│ 4B.2 Delivery Health Engine  │
│ 4A.3 Unified Work Calendar   │                       │ 4B.3 Management Control Tower│
│                              │                       │ 4B.4 Advanced Analytics (CFD)│
└──────────────────────────────┘                       └──────────────┬───────────────┘
                                                                      │
       ┌──────────────────────────────────────────────────────────────┘
       ▼                                                               
┌──────────────────────────────┐                       ┌──────────────────────────────┐
│  GATE 4C: Productivity &     │                       │  GATE 4D: Automation &       │
│  Traceability                │                       │  Intelligence                │
├──────────────────────────────┤                       ├──────────────────────────────┤
│ 4C.1 Global Search Engine    │                       │ 4D.1 Automation Engine       │
│ 4C.2 Governed Bulk Operations│──────────────────────►│ 4D.2 Smart Notification Digest│
│ 4C.3 Traceability Hardening  │                       │ 4D.3 Read-Only Ask WorkDesk  │
│ 4C.4 Project Decision Log    │                       │ 4D.4 Final Phase 4 Closure   │
└──────────────────────────────┘                       └──────────────────────────────┘
```

---

# 5. CAPACITY MANAGEMENT SPECIFICATION

### 5.1 Elimination of Hardcoded Arbitrary Assumptions
The arbitrary hardcoded thresholds ($\le 80\%$, $81-100\%$, $>100\%$) are removed from the business logic. Workload and capacity are evaluated using **explicit, mathematically defined, configurable capacity budgets**.

### 5.2 Capacity Units & Core Parameters
WorkDesk recognizes two distinct, non-conflated capacity units:
1. **Time-Based Capacity (Hours)**:
   * **Base Working Week**: Standard 40 hours per week (8 hours/day, Monday–Friday).
   * **Individual Working Capacity ($C_u$)**: Stored in `UserCapacity` (default 40 hrs/week). Configurable by Lead/Manager to reflect part-time roles (e.g., 20 hrs/week) or contracted allocation.
   * **Non-Working Days**: Standard calendar weekends (Saturday & Sunday). Holidays/Leaves can be recorded in `UserCapacity` effective date ranges.
2. **Velocity-Based Capacity (Story Points)**:
   * **Sprint Capacity ($C_s$)**: Defined on `Sprint.capacityPoints: Int?` representing the total story point budget committed for the sprint scope.

### 5.3 Workload Calculations
For any given evaluation time window $[W_{start}, W_{end}]$:
1. **Planned / Estimated Hours ($E_u$)**:
   $$E_u = \sum_{\substack{t \in \text{Open Tasks} \\ \text{assigneeId} = u \\ t.\text{status} \notin \{\text{DONE}, \text{CANCELLED}\}}} \text{Coalesce}(t.\text{estimatedHours}, 0)$$
2. **Actual Hours Expended ($A_u$)**:
   $$A_u = \sum_{\substack{t \in \text{Tasks} \\ \text{assigneeId} = u}} \text{Coalesce}(t.\text{actualHours}, 0)$$
3. **Available Capacity Budget ($B_u$)**:
   $$B_u = \text{UserCapacity.weeklyCapacity} \times \left( \frac{\text{Working Days in } [W_{start}, W_{end}]}{5} \right)$$
4. **Workload Utilization Ratio ($U_u$)**:
   $$U_u = \frac{E_u}{B_u}$$

### 5.4 Configurable Thresholds & Status Grading
Thresholds are configurable per project or globally by Managers, with defaults:
* **Under-Allocated**: $U_u < \theta_{low}$ (Default $\theta_{low} = 0.70$, or $< 70\%$)
* **Optimal Allocation**: $\theta_{low} \le U_u \le \theta_{high}$ (Default $\theta_{high} = 1.00$, or $70\% - 100\%$)
* **Over-Allocated**: $U_u > \theta_{high}$ (Default $> 100\%$)
* **Severe Over-Allocation**: $U_u > \theta_{crit}$ (Default $\theta_{crit} = 1.25$, or $> 125\%$)

Operational warnings are informative and advisory; they do not block task assignment, but highlight capacity risks in Sprint Planning and the Management Control Tower.

---

# 6. FORMAL ACCOUNTABILITY METRICS SPECIFICATION

Every metric is defined with mathematical rigor:

### 6.1 Due-Date Commitment Adherence Rate ($M_{DCA}$)
* **Purpose**: Measures reliability in meeting promised delivery deadlines.
* **Formula**:
  $$M_{DCA} = \frac{\sum_{t \in P_{eval}} \mathbb{I}(t.\text{completedAt} \le t.\text{deadline})}{|P_{eval}|} \times 100$$
* **Numerator**: Count of evaluated tasks completed on or before their deadline.
* **Denominator**: $|P_{eval}|$ (Total evaluated tasks).
* **Population ($P_{eval}$)**: Tasks belonging to scope (Project/Team) where `status == 'DONE'`, `completedAt` falls within the time window, and `deadline IS NOT NULL`.
* **Inclusion Rules**: Level-3 work items (`TASK`, `STORY`, `BUG`, `REQUEST`, `IMPROVEMENT`, `ACTION_ITEM`) and `SUBTASK`.
* **Exclusion Rules**: Tasks with `deadline == NULL`; tasks with `status == 'CANCELLED'`; `INITIATIVE` and `EPIC` containers.
* **Edge Cases**:
  * **Reopened Tasks**: If a task was reopened and completed again, `completedAt` is the *final* completion timestamp.
  * **No Deadlines**: Excluded from denominator to prevent skewing. If denominator is 0, metric returns `null` ("No deadline commitments").
* **Example**: 20 tasks completed in window; 16 had deadlines; 14 completed before deadline $\to M_{DCA} = (14 / 16) \times 100 = 87.5\%$.

---

### 6.2 Sprint Commitment Adherence / Say-Do Ratio ($M_{SDR}$)
* **Purpose**: Measures sprint delivery predictability by comparing work delivered against work committed at sprint start.
* **Formula**:
  $$M_{SDR} = \frac{\sum_{c \in C_{eval}} c.\text{storyPoints} \cdot \mathbb{I}(c.\text{wasPlanned} = \text{true} \land c.\text{completedAt} \le S.\text{completedAt})}{\sum_{c \in C_{eval}, c.\text{wasPlanned} = \text{true}} c.\text{storyPoints}} \times 100$$
* **Numerator**: Sum of story points snapshotted at sprint start (`wasPlanned = true`) that were completed within the sprint.
* **Denominator**: Total story points snapshotted in `SprintCommitment` at sprint start with `wasPlanned = true`.
* **Population**: Completed sprints ($S$) within scope and time window.
* **Inclusion Rules**: Commitments where `wasPlanned == true`.
* **Exclusion Rules**: Mid-sprint additions (`wasPlanned == false`); cancelled sprints.
* **Edge Cases**:
  * **Missing Estimates**: Tasks with `storyPoints == NULL` count as 0 points.
  * **Carry-Over Work**: Incomplete tasks carried over to next sprint are counted as missed in current sprint denominator, and re-evaluated in the next sprint's commitment snapshot.
* **Example**: Sprint started with 40 points committed. 32 points completed by sprint end $\to M_{SDR} = (32 / 40) \times 100 = 80.0\%$.

---

### 6.3 Sprint Scope Creep Rate ($M_{SCR}$)
* **Purpose**: Measures scope volatility introduced after sprint start.
* **Formula**:
  $$M_{SCR} = \frac{\sum_{c \in C_{eval}, c.\text{wasPlanned} = \text{false}} \text{Coalesce}(c.\text{storyPoints}, 0)}{\sum_{c \in C_{eval}, c.\text{wasPlanned} = \text{true}} \text{Coalesce}(c.\text{storyPoints}, 0)} \times 100$$
* **Numerator**: Sum of story points for tasks added mid-sprint (`wasPlanned = false`).
* **Denominator**: Initial committed story points (`wasPlanned = true`).
* **Inclusion Rules**: All tasks associated with the sprint after start.
* **Edge Cases**: If initial commitment was 0, return $100\%$ if additions occurred, else $0\%$.

---

### 6.4 Blocker Aging ($M_{BA}$)
* **Purpose**: Quantifies impediment resolution speed.
* **Formula**:
  * **Active Blocker Age**: For currently blocked tasks:
    $$\text{Age}_{active}(t) = \text{Now} - \text{Timestamp entered BLOCKED status}$$
  * **Average Blocker Resolution Time**:
    $$M_{ABR} = \frac{1}{|B_{resolved}|} \sum_{b \in B_{resolved}} (\text{UnblockedTimestamp}_b - \text{BlockedTimestamp}_b)$$
* **Source Records**: `TaskActivity` status transition logs and `StandupBlocker` creation/resolution records.
* **Exclusion Rules**: Non-blocked tasks.

---

### 6.5 Rework Rate ($M_{RR}$)
* **Purpose**: Measures quality and review rejection frequency.
* **Formula**:
  $$M_{RR} = \frac{\text{Count of transitions to CHANGES\_REQUESTED or REOPENED}}{\text{Total review cycles (transitions to IN\_REVIEW)}} \times 100$$
* **Population**: Tasks undergoing peer review within the time window.
* **Inclusion Rules**: Tasks with `requiresReview == true`.

---

# 7. DELIVERY HEALTH & RISK ENGINE

### 7.1 Measurable Scopes
The Health Engine evaluates:
1. **Project Health**
2. **Sprint Health**
3. **Team Health**
4. **Milestone Delivery Health**

*It does NOT evaluate individual employees.*

### 7.2 Deterministic Health State Machine
Health states are strictly computed:
* 🟢 **HEALTHY**: Overall health score $\ge 80/100$, zero critical blockers.
* 🟡 **AT_RISK**: Health score between $50/100$ and $79/100$, or $\ge 1$ warning rule triggered.
* 🔴 **CRITICAL**: Health score $< 50/100$, or $\ge 1$ critical invariant rule triggered.

### 7.3 Health Signal & Rule Specifications

```text
Signal ──► Observed Evidence ──► Rule Evaluation ──► Health State ──► Explanation ──► Operational Action
```

| Signal | Observed Evidence | Rule & Threshold | State | Explanation | Operational Action |
|---|---|---|:---:|---|---|
| **Overdue Load** | Ratio of overdue open tasks | $R_{od} = \frac{\text{Overdue Open}}{\text{Total Open}} > 0.25$ | 🔴 CRITICAL | Over $25\%$ of active project tasks are past their deadline. | Immediate delivery triage; renegotiate scope or adjust deadlines. |
| **Overdue Load** | Ratio of overdue open tasks | $0.10 \le R_{od} \le 0.25$ | 🟡 AT_RISK | $10\%–25\%$ of active project tasks are past their deadline. | Review blockers on overdue items; prioritize completion. |
| **Critical Blocker**| Active `BLOCKS` dependency | $\ge 1$ task on Critical Path blocked $> 48\text{ hrs}$ | 🔴 CRITICAL | Critical path task is stalled by an unresolved dependency. | Lead intervention required to swarm on the blocking ticket. |
| **Review Queue** | Review pending volume | $\frac{\text{In Review Tasks}}{\text{In Progress + In Review}} > 0.40$ | 🟡 AT_RISK | Review bottleneck: over $40\%$ of active work is waiting for review. | Reallocate reviewer bandwidth; prompt assigned Leads. |
| **Scope Creep** | Unplanned sprint points | Sprint Scope Creep Rate $> 30\%$ | 🟡 AT_RISK | Unplanned mid-sprint additions exceed $30\%$ of initial commitment. | Enforce mid-sprint change freeze; defer new work to next sprint. |
| **WIP Saturation** | Board column capacity | Board column at $100\%$ hard WIP limit | 🟡 AT_RISK | Workflow column reached capacity ceiling; throughput throttled. | Swarm on column items before pulling new work. |

### 7.4 Configuration & Auditability
* **Configuration Scope**: Configurable per project by `ROLE_LEAD` or globally by `ROLE_MANAGER`.
* **Defaults**: Hardcoded in service if unconfigured.
* **Audit**: Modifications log `HEALTH_THRESHOLDS_UPDATED` with previous and new thresholds in `AuditLog.metadata`.

---

# 8. TIMELINE / GANTT & CRITICAL PATH ARCHITECTURE

### 8.1 Dependency Semantics in Scheduling
* **ONLY `BLOCKS` dependencies participate in chronological scheduling constraints.**
* `RELATES_TO` and `DUPLICATES` are informational associations and **NEVER** constrain start dates or deadlines.

### 8.2 Task Duration & Boundary Resolution
1. **Explicit Dates**: If `startDate` and `deadline` are populated, $\text{Duration} = \text{deadline} - \text{startDate}$ in working days.
2. **Missing Dates Resolution**:
   * If `startDate` is null: Default to project start, sprint start, or creation date.
   * If `deadline` is null: Default to `startDate + Ceil(estimatedHours / 8)` days, or 1 working day if `estimatedHours` is null.
3. **Milestones**: Tasks with `type == 'MILESTONE'` have $\text{Duration} = 0$ days. They represent point-in-time synchronization gates.
4. **Subtasks**: Subtask schedules are bounded within parent task boundaries:
   $$\text{Parent.startDate} \le \text{Subtask.startDate} \le \text{Subtask.deadline} \le \text{Parent.deadline}$$

### 8.3 Critical Path Method (CPM) Algorithm
1. **Topological Sort**: Graph formed by `BLOCKS` dependencies (guaranteed DAG by Phase 2 DFS cycle prevention).
2. **Forward Pass (Earliest Start/Finish)**:
   * $ES(t) = \max_{p \in \text{Predecessors}(t)} EF(p)$
   * $EF(t) = ES(t) + \text{Duration}(t)$
3. **Backward Pass (Latest Start/Finish)**:
   * $LF(t) = \min_{s \in \text{Successors}(t)} LS(s)$
   * $LS(t) = LF(t) - \text{Duration}(t)$
4. **Float / Slack Determination**:
   $$\text{Total Slack}(t) = LS(t) - ES(t)$$
5. **Critical Path**: All tasks where $\text{Total Slack}(t) == 0$. Marked with `isCriticalPath = true` in response DTO.

---

# 9. UNIFIED WORK CALENDAR (PURE QUERY AGGREGATION)

### 9.1 Zero Redundant Persistence
**No new calendar table is created.** The Calendar Engine is a **pure virtual aggregation service**.

### 9.2 Unified Query Aggregator
Given time window $[T_{start}, T_{end}]$ and authorized scope:
```typescript
interface CalendarEventDto {
  id: string;
  sourceType: 'TASK_DEADLINE' | 'SPRINT' | 'MEETING' | 'STANDUP' | 'MILESTONE';
  title: string;
  startDate: string;
  endDate: string;
  status: string;
  urgency?: string;
  linkUrl: string;
  metadata: Record<string, any>;
}
```
The service executes parallel queries against:
1. `Task` where `deadline BETWEEN T_start AND T_end`.
2. `Sprint` where `startDate <= T_end AND endDate >= T_start`.
3. `Meeting` where `startTime <= T_end AND endTime >= T_start` and user is participant/organizer.
4. `Standup` where `standupDate BETWEEN T_start AND T_end` for user's team.

Results are merged, sorted chronologically, and delivered to the client.

---

# 10. MANAGEMENT CONTROL TOWER SPECIFICATION

### 10.1 Role Scope Boundaries
* **`ROLE_MANAGER`**: Full organization-wide portfolio visibility across all projects, teams, sprints, and blockers.
* **`ROLE_LEAD`**: Scoped visibility limited strictly to projects where the user is Lead/Member and teams led.
* **`ROLE_EMPLOYEE`**: Access denied (`HTTP 403 Forbidden`).

### 10.2 Widget Specifications

| Widget | Data Source | Calculation | Refresh / Cache | Authorization |
|---|---|---|:---:|---|
| **Portfolio Health Radar** | `Project`, `Task`, `Sprint` | Delivery health engine evaluation per project. | Request-time aggregation | Manager / Lead (scoped) |
| **Blocker Triage Queue** | `Task` (`status = 'BLOCKED'`), `StandupBlocker` | Tasks in blocked status sorted by age descending. | Request-time aggregation | Manager / Lead (scoped) |
| **Cross-Team Workload** | `Task`, `UserCapacity`, `Team` | Team utilization $U = \sum E_u / \sum B_u$. | Request-time aggregation | Manager / Lead (scoped) |
| **Governance Feed** | `AuditLog` | Audit records for `WIP_HARD_LIMIT_OVERRIDDEN`, `SPRINT_COMPLETED`, `BACKLOG_REORDERED`. | Cursor-paginated (take 20) | Manager / Lead (scoped) |
| **Sprint Predictability** | `SprintCommitment` | Say/Do ratio for last 5 completed sprints. | Request-time aggregation | Manager / Lead (scoped) |

---

# 11. GLOBAL SEARCH ARCHITECTURE

### 11.1 Native Database Strategy (Zero External Clusters)
* **Development (SQLite)**: Tokenized search using SQLite indexed queries and case-insensitive Prisma `contains` matching across indexed fields.
* **Production (PostgreSQL)**: Fully compatible with PostgreSQL `ILIKE` and text search (`to_tsvector`/GIN indexes) on `ticketId`, `title`, and `description`.
* **Zero Elasticsearch/Solr/Redis dependencies**.

### 11.2 Search Execution Pipeline
```text
Client Query ──► SessionGuard ──► Scope Filter Builder ──► Database Query ──► Cursor Paginator ──► Response
```

### 11.3 Mandatory Pre-Query Authorization Scoping
**Authorization is enforced directly in the database query `where` clause before records are fetched.**
* For `ROLE_EMPLOYEE`:
  * `Task`: `WHERE (projectId IN (userProjectIds) OR teamId IN (userTeamIds) OR assigneeId = user.id) AND (ticketId LIKE %q% OR title LIKE %q%)`
  * `Project`: `WHERE id IN (userProjectIds) AND (name LIKE %q% OR key LIKE %q%)`
  * `Meeting`: `WHERE (organizerId = user.id OR participants SOME user.id) AND title LIKE %q%`
* **Zero records from unassigned private projects are ever retrieved or exposed.**

---

# 12. GOVERNED BULK OPERATIONS (TRANSACTION-SAFE PER-ITEM MODEL)

### 12.1 Resolution of Ambiguity
The contradictory "atomic partial-success" concept is replaced with:
**Transaction-safe per-item bulk execution with explicit success/failure reporting.**

### 12.2 Execution Flow per Item
For each requested ticket ID in `ticketIds`:
```text
1. Authorize resource scope (404 if out of scope)
2. Verify lock / acquire write mutex
3. Execute domain operation:
   - For Status Transition: Route via TasksService.transitionTask() (validates Phase 2 state machine)
   - Evaluate Done Gate (Acceptance criteria, guidance points, evidence)
   - Validate Column WIP limits (if moving board column)
4. Record individual AuditLog entry
5. Dispatch Notification if assigned/completed
6. Append to response result array: { ticketId, success: true }
   OR on error: { ticketId, success: false, errorCode, errorMessage }
```

### 12.3 Edge Case Handling
* **WIP Violation**: If task 3 of 5 causes a board column to hit a `HARD_LIMIT`, task 3 fails with `WIP_LIMIT_EXCEEDED`, while tasks 1 and 2 succeed. Tasks 4 and 5 are evaluated in turn.
* **Done Gate Failure**: If task 2 lacks mandatory acceptance criteria, task 2 fails with `DONE_GATE_FAILED`, explaining missing criteria.
* **Concurrent Modification**: Re-entrant mutex serializes execution, preventing race conflicts.

---

# 13. TRACEABILITY & PROJECT DECISION LOG

### 13.1 Traceability Enhancements
1. **Meeting $\to$ Decision $\to$ Action Item $\to$ Task**:
   * `convertActionItemToTask` explicitly sets `Task.type = 'ACTION_ITEM'`.
   * If the meeting has linked decisions, automatically links the task via `TaskDecision`.
2. **Standup Blocker $\to$ Task**:
   * When converting a standup blocker, prompt for `blockedTicketId`.
   * Automatically creates a `BLOCKS` dependency: `CreatedBlockerTask BLOCKS BlockedTicketId`.

### 13.2 Project Decision Log (`ProjectDecision`)
* **Entity**: `ProjectDecision` linked to `Project`, `User` (decisionMaker), and `Meeting`.
* **Statuses**: `PROPOSED`, `APPROVED`, `SUPERSEDED`, `DEPRECATED`.
* **Immutability & Superseding**: Approved decisions cannot be silently rewritten. To change a decision, a new decision is created with `supersedesId` pointing to the previous one, updating the old status to `SUPERSEDED`.
* **Task Links**: `TaskDecision` table creates explicit auditability for which tickets were implemented as a result of an architectural decision.

---

# 14. AUTOMATION ENGINE GOVERNANCE MODEL

### 14.1 Architecture
An asynchronous Event-Condition-Action (ECA) engine.

### 14.2 Execution Identity & Permission Revalidation
* **Rule Creator vs Execution Identity**: Rules execute under the permissions of the rule creator (`createdById`).
* **Execution-Time Revalidation**:
  * Before executing actions, the engine re-reads the creator user record.
  * If the creator is deactivated (`isActive == false`) or demoted to a role lacking permission for the action, the rule execution aborts immediately, sets `rule.isEnabled = false`, and logs `AUTOMATION_DISABLED_PERMISSION_LOST`.
* **Zero Privilege Escalation**: An employee cannot execute Lead actions by having an automation rule trigger it.

### 14.3 Safety Limits
* **Maximum Recursion Depth**: Capped at **2**. If Action A triggers Event B which triggers Action C, Action C cannot trigger further automation rules. Tracked in async execution context.
* **Idempotency Hashing**: Execution hash computed as `SHA256(ruleId + entityId + eventTimestamp)`. Re-execution within 60 seconds is rejected.
* **Rate Limiting**: Max 50 automation executions per project per minute. Excess events are queued or logged as `AUTOMATION_RATE_LIMITED`.

---

# 15. READ-ONLY "ASK WORKDESK" AI ARCHITECTURE

### 15.1 Strict Read-Only Scope
In Phase 4, AI is **strictly read-only**.
* **PERMITTED**: Querying status, summarizing sprints, explaining blocker chains, searching documentation, comparing planned vs actual progress.
* **FORBIDDEN**: Any database write, status transition, task assignment, sprint edit, or rule creation.

### 15.2 Retrieval-Augmented Grounding (RAG)
```text
User Query ──► SessionGuard ──► Scope Filter ──► DB Context Retrieval ──► Grounded Prompt ──► LLM ──► Citation Check ──► Response
```
1. **Pre-Query Filtering**: All context data injected into the LLM prompt is retrieved using the user's authenticated scope queries.
2. **Mandatory Citations**: The prompt enforces that any factual claim must include ticket citations (e.g. `[DESK-1042]`). The response parser validates that cited tickets exist in the pre-filtered set.
3. **No Hallucination Elimination Claims**: LLMs are non-deterministic; WorkDesk mitigates hallucinations through strict bounding, explicit confidence disclaimers, and mandatory citations to primary records.
4. **Offline Mode**: If no LLM provider API key is configured, the endpoint returns structured deterministic template answers generated directly from database aggregations (e.g. "Project DESK has 3 overdue tasks: DESK-1001, DESK-1002, DESK-1005.").

---

# 16. COMPLETE AUTHORIZATION MATRIX (PHASE 4)

| Endpoint / Capability | Employee | Lead | Manager | Scope Boundary |
|---|:---:|:---:|:---:|---|
| `GET /api/v1/workload/user/:id` | Own Only | Team Members | All Users | Project / Team |
| `GET /api/v1/workload/team/:id` | Member Teams | Led Teams | All Teams | Team Scope |
| `GET /api/v1/timeline/project/:id`| Member Projects | Member/Led Projects | All Projects | Project Scope (404) |
| `PATCH /api/v1/timeline/tasks/:id`| Assigned Tasks | Member/Led Projects | All Projects | Project Scope |
| `GET /api/v1/calendar/events` | Scoped Events | Scoped Events | All Events | Pre-filtered |
| `GET /api/v1/accountability/*` | Member Projects | Member/Led Projects | All Projects | Project Scope (404) |
| `GET /api/v1/health-engine/*` | Member Projects | Member/Led Projects | All Projects | Project Scope (404) |
| `GET /api/v1/control-tower/*` | ❌ (403) | Scoped Led Projects | Full Access | Role PolicyGuard |
| `GET /api/v1/analytics/*` | Member Projects | Member/Led Projects | All Projects | Project Scope (404) |
| `GET /api/v1/search` | Scoped Results | Scoped Results | All Results | Pre-query Scoped |
| `POST /api/v1/tasks/bulk` | Assigned Tasks | Member/Led Projects | All Projects | Per-Item Authed |
| `POST /api/v1/projects/:id/decisions` | ❌ (403) | Member/Led Projects | All Projects | Lead/Manager |
| `POST /api/v1/automation/rules` | ❌ (403) | Member/Led Projects | All Projects | Lead/Manager |
| `POST /api/v1/ai/query` (Read-only) | Scoped Context | Scoped Context | All Context | Pre-query Scoped |

---

# 17. COMPLETE DATA MODEL DESIGN

```prisma
// ===========================================================================
// PHASE 4 DATA MODEL ADDITIONS (PURELY ADDITIVE)
// ===========================================================================

model ProjectDecision {
  id              String            @id @default(uuid())
  projectId       String
  project         Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  title           String
  context         String
  decision        String
  status          String            @default("PROPOSED") // PROPOSED | APPROVED | SUPERSEDED | DEPRECATED
  decisionMakerId String
  decisionMaker   User              @relation("DecisionMaker", fields: [decisionMakerId], references: [id])
  meetingId       String?
  meeting         Meeting?          @relation(fields: [meetingId], references: [id], onDelete: SetNull)
  supersededById  String?
  supersededBy    ProjectDecision?  @relation("SupersededDecisions", fields: [supersededById], references: [id])
  supersedes      ProjectDecision[] @relation("SupersededDecisions")
  tasks           TaskDecision[]
  decidedAt       DateTime          @default(now())
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([projectId, status])
}

model TaskDecision {
  id          String          @id @default(uuid())
  taskId      String
  task        Task            @relation(fields: [taskId], references: [id], onDelete: Cascade)
  decisionId  String
  decision    ProjectDecision @relation(fields: [decisionId], references: [id], onDelete: Cascade)
  createdAt   DateTime        @default(now())

  @@unique([taskId, decisionId])
  @@index([taskId])
  @@index([decisionId])
}

model AutomationRule {
  id          String    @id @default(uuid())
  projectId   String?   // Null for global rules (Manager only)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  name        String
  description String?
  triggerType String    // TASK_OVERDUE | TASK_BLOCKED | STATUS_ENTERED | SPRINT_STARTED | CRITERIA_COMPLETED
  conditions  String    // JSON encoded condition tree
  actions     String    // JSON encoded action array
  isEnabled   Boolean   @default(true)
  createdById String
  createdBy   User      @relation("RuleCreator", fields: [createdById], references: [id])
  lastRunAt   DateTime?
  runCount    Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([projectId, triggerType])
  @@index([isEnabled])
}

model UserCapacity {
  id             String    @id @default(uuid())
  userId         String
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  weeklyCapacity Int       @default(40)
  effectiveFrom  DateTime  @default(now())
  effectiveTo    DateTime?
  notes          String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@index([userId, effectiveFrom])
}
```

---

# 18. DATA FRESHNESS & CACHING STRATEGY

| Reporting / Analytics Metric | Freshness Strategy | Invalidation Trigger |
|---|---|---|
| **Workload & Capacity** | Request-Time Aggregation | Calculated on request using indexed count/sum queries. |
| **Delivery Health Index** | Request-Time Aggregation | Re-evaluated on load; cached in memory for 60s per project. |
| **Control Tower Overview** | Near Real-Time (60s Cache) | In-memory cache invalidated on task transition or sprint start. |
| **Cycle & Lead Time** | Request-Time Aggregation | Scoped to requested time window with DB aggregations. |
| **Cumulative Flow (CFD)** | Daily Snapshot or Dynamic Time Series | Computed dynamically over `TaskActivity` transition timestamps. |
| **Global Search** | Real-Time | Direct query on indexed DB fields. |

---

# 19. MIGRATION & SAFETY PROTOCOL

### Non-Standard SQLite/Prisma Protocol
1. **Physical SQLite Backup**:
   `apps/api/prisma/dev.db.backup.phase4_pre_migration_TIMESTAMP.db`
2. **Pre-Migration Baseline Snapshot**:
   Execute `scripts/record-phase4-baseline.ts` recording baseline counts for all existing tables.
3. **Migration SQL Generation & Manual Review**:
   Generate purely additive SQL (`phase4_migration.sql`) and manually verify:
   * **0 `DROP TABLE`**
   * **0 `DROP COLUMN`**
   * **0 destructive type conversions**
4. **Execution via Verified Migration Runner**:
   Execute migration transactionally.
5. **Data Reconciliation**:
   Run `scripts/verify-phase4-reconciliation.ts` proving 100% of pre-existing records remain intact.

---

# 20. PHASE 4 RISK REGISTER

| Risk ID | Description | Impact | Prob | Mitigation Strategy | Verification Test |
|---|---|:---:|:---:|---|---|
| **R-01** | Bulk transition bypasses Done Gate | HIGH | LOW | Every item in bulk operation calls full Phase 2 `transitionTask()`. | `test/phase4-bulk.spec.ts` |
| **R-02** | Search leaks unauthorized project tasks | HIGH | LOW | Pre-query scoping: user's project/team IDs baked into `WHERE` clause. | `test/phase4-search.spec.ts` |
| **R-03** | Automation infinite recursion loop | HIGH | MED | Hard execution depth limit ($\le 2$) tracked in AsyncLocalStorage. | `test/phase4-automation.spec.ts` |
| **R-04** | Automation privilege escalation | HIGH | LOW | Re-verify creator's role and permissions at execution time. | `test/phase4-automation.spec.ts` |
| **R-05** | Timeline dates violate cycle invariants | MED | LOW | Critical path and rescheduling bounded by Phase 2 DFS cycle checker. | `test/phase4-timeline.spec.ts` |
| **R-06** | AI hallucinates unassigned project data | HIGH | LOW | Pre-filtered context injection: LLM only receives authorized records. | `test/phase4-ai.spec.ts` |
| **R-07** | Heavy CFD query degrades SQLite latency | MED | MED | Indexed queries on `TaskActivity([taskId, createdAt])`; cursor pagination. | `test/phase4-analytics.spec.ts` |

---

# 21. CAPABILITY ACCEPTANCE CRITERIA

Phase 4 will be declared complete only when:
1. `Task` remains the single canonical work-item model (0 parallel issue/ticket tables).
2. Exactly three operational roles exist (`ROLE_EMPLOYEE`, `ROLE_LEAD`, `ROLE_MANAGER`).
3. Done Gate and Review Gates remain inviolable across bulk mutations, timelines, and automation.
4. All accountability and delivery health metrics are deterministic and explainable.
5. Global search strictly enforces resource-scope authorization with zero data leakage.
6. Automation engine enforces recursion depth limit $\le 2$ and audits every executed action.
7. Ask WorkDesk AI is strictly read-only and cites verified ticket IDs.
8. 100% pass across all Phase 1, Phase 2, Phase 3, and Phase 4 test suites.
9. Monorepo builds cleanly (`shared`, `api`, `web`).
10. Localhost, Nginx (Port 80), and Cloudflare Tunnel runtime checks return healthy.

---

# 22. REQUIRED FINAL STATE

```text
PHASE 4 PLANNING REVISION COMPLETE.

NO PHASE 4 APPLICATION CODE HAS BEEN WRITTEN.
NO PHASE 4 DATABASE MIGRATION HAS BEEN CREATED OR EXECUTED.
NO PHASE 4 DATABASE SCHEMA CHANGE HAS BEEN APPLIED.
NO NEW INFRASTRUCTURE HAS BEEN INSTALLED.
NO PHASE 5 WORK HAS STARTED.

PHASE 3 REMAINS CLOSED AND FROZEN.

PHASE 4 IMPLEMENTATION REMAINS HALTED
PENDING EXPLICIT USER APPROVAL.
```
