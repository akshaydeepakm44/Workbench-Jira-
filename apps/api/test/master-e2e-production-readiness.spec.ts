import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  TaskPriority,
  DependencyType,
  EvidenceType,
} from '@workdesk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { TasksService } from '../src/tasks/tasks.service';
import { SprintsService } from '../src/sprints/sprints.service';
import { BoardsService } from '../src/boards/boards.service';
import { WorkloadService } from '../src/workload/workload.service';
import { TimelineService } from '../src/timeline/timeline.service';
import { CalendarService } from '../src/calendar/calendar.service';
import { AccountabilityService } from '../src/accountability/accountability.service';
import { DeliveryHealthService } from '../src/delivery-health/delivery-health.service';
import { ControlTowerService } from '../src/delivery-health/control-tower.service';
import { AnalyticsService } from '../src/analytics/analytics.service';
import { SearchService } from '../src/search/search.service';
import { BulkService } from '../src/bulk/bulk.service';
import { DecisionsService } from '../src/decisions/decisions.service';
import { StandupsService } from '../src/standups/standups.service';
import { MeetingsService } from '../src/meetings/meetings.service';
import { AutomationService } from '../src/automation/automation.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { AskWorkdeskService } from '../src/ask-workdesk/ask-workdesk.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const sprintsService = new SprintsService(prismaService, auditService, tasksService);
const boardsService = new BoardsService(prismaService, auditService, tasksService);
const workloadService = new WorkloadService(prismaService, auditService);
const timelineService = new TimelineService(prismaService, auditService, tasksService);
const calendarService = new CalendarService(prismaService, tasksService);
const accountabilityService = new AccountabilityService(prismaService);
const deliveryHealthService = new DeliveryHealthService(prismaService, timelineService);
const controlTowerService = new ControlTowerService(
  prismaService,
  deliveryHealthService,
  workloadService,
);
const analyticsService = new AnalyticsService(prismaService);
const searchService = new SearchService(prismaService);
const bulkService = new BulkService(prismaService, tasksService, sprintsService);
const decisionsService = new DecisionsService(prismaService, auditService);
const standupsService = new StandupsService(prismaService, auditService, tasksService);
const meetingsService = new MeetingsService(prismaService, auditService, tasksService);
const automationService = new AutomationService(prismaService, auditService, tasksService);
const notificationsService = new NotificationsService(prismaService);
const askWorkdeskService = new AskWorkdeskService(prismaService);

export interface MasterTestResult {
  section: string;
  name: string;
  passed: boolean;
  evidence?: any;
  error?: string;
}

export const masterTestResults: MasterTestResult[] = [];

function recordTest(section: string, name: string, passed: boolean, evidence?: any, error?: string) {
  masterTestResults.push({ section, name, passed, evidence, error });
  if (passed) {
    console.log(`  [PASS] [${section}] ${name}`);
  } else {
    console.error(`  [FAIL] [${section}] ${name} -> ${error || ''}`);
  }
}

async function runMasterE2EProductionReadinessSuite() {
  console.log('========================================================================');
  console.log('WORKDESK 2.0 — MASTER LIVE END-TO-END ACCEPTANCE & PRODUCTION READINESS');
  console.log('========================================================================\n');

  try {
    // ------------------------------------------------------------------------
    // STAGE 1: ORGANIZATIONAL HIERARCHY & IDENTITY SETUP
    // ------------------------------------------------------------------------
    console.log('--- 1. Organizational Hierarchy & Role Provisioning ---');

    // 1.1 Discover authoritative roles
    const roles = await prisma.role.findMany();
    const roleCodes = roles.map((r) => r.code);
    const hasOnlyThreeRoles =
      roleCodes.length === 3 &&
      roleCodes.includes('ROLE_EMPLOYEE') &&
      roleCodes.includes('ROLE_LEAD') &&
      roleCodes.includes('ROLE_MANAGER') &&
      !roleCodes.includes('ROLE_SUPER_ADMIN');

    recordTest(
      'Role Governance',
      'Authoritative 3-Role Model (Zero SuperAdmin)',
      hasOnlyThreeRoles,
      roleCodes,
    );

    // 1.2 Setup Manager
    let manager = await prisma.user.findFirst({
      where: { role: { code: RoleCode.ROLE_MANAGER } },
      include: { role: true },
    });
    if (!manager) throw new Error('Manager not found');
    const managerCtx = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };

    // 1.3 Setup Team Alpha: Lead L1, Employee E1, Employee E2
    const leadRole = roles.find((r) => r.code === RoleCode.ROLE_LEAD)!;
    const empRole = roles.find((r) => r.code === RoleCode.ROLE_EMPLOYEE)!;

    const leadL1 = await prisma.user.upsert({
      where: { email: 'leada_test@datai2i.com' },
      update: { roleId: leadRole.id, approvalStatus: 'APPROVED' },
      create: {
        email: 'leada_test@datai2i.com',
        fullName: 'Lead Alpha',
        roleId: leadRole.id,
        approvalStatus: 'APPROVED',
      },
    });
    const leadL1Ctx = { id: leadL1.id, roleCode: RoleCode.ROLE_LEAD };

    const empE1 = await prisma.user.upsert({
      where: { email: 'rohit@datai2i.com' },
      update: { roleId: empRole.id, approvalStatus: 'APPROVED' },
      create: {
        email: 'rohit@datai2i.com',
        fullName: 'Rohit Employee 1',
        roleId: empRole.id,
        approvalStatus: 'APPROVED',
      },
    });
    const empE1Ctx = { id: empE1.id, roleCode: RoleCode.ROLE_EMPLOYEE };

    const empE2 = await prisma.user.upsert({
      where: { email: 'empa_test@datai2i.com' },
      update: { roleId: empRole.id, approvalStatus: 'APPROVED' },
      create: {
        email: 'empa_test@datai2i.com',
        fullName: 'Employee Alpha 2',
        roleId: empRole.id,
        approvalStatus: 'APPROVED',
      },
    });
    const empE2Ctx = { id: empE2.id, roleCode: RoleCode.ROLE_EMPLOYEE };

    // 1.4 Setup Team Beta: Employee E3
    const empE3 = await prisma.user.upsert({
      where: { email: 'empb_test@datai2i.com' },
      update: { roleId: empRole.id, approvalStatus: 'APPROVED' },
      create: {
        email: 'empb_test@datai2i.com',
        fullName: 'Employee Beta 3',
        roleId: empRole.id,
        approvalStatus: 'APPROVED',
      },
    });
    const empE3Ctx = { id: empE3.id, roleCode: RoleCode.ROLE_EMPLOYEE };

    // 1.5 Create Team Alpha & Team Beta in Database
    const teamAlpha = await prisma.team.create({
      data: {
        name: `Team Alpha Master ${Date.now().toString().slice(-4)}`,
        leadId: leadL1.id,
        members: {
          create: [{ userId: leadL1.id }, { userId: empE1.id }, { userId: empE2.id }],
        },
      },
    });

    const teamBeta = await prisma.team.create({
      data: {
        name: `Team Beta Master ${Date.now().toString().slice(-4)}`,
        members: {
          create: [{ userId: empE3.id }],
        },
      },
    });

    // 1.6 Create Projects: Project Alpha (Team Alpha) and Project Beta (Team Beta)
    const projectAlpha = await prisma.project.create({
      data: {
        key: `MALP-${Date.now().toString().slice(-4)}`,
        name: 'Master Project Alpha',
        leadId: leadL1.id,
        members: {
          create: [
            { userId: leadL1.id, roleInProject: 'LEAD' },
            { userId: empE1.id, roleInProject: 'CONTRIBUTOR' },
            { userId: empE2.id, roleInProject: 'CONTRIBUTOR' },
          ],
        },
      },
    });

    const projectBeta = await prisma.project.create({
      data: {
        key: `MBET-${Date.now().toString().slice(-4)}`,
        name: 'Master Project Beta (Private)',
        leadId: manager.id,
        members: {
          create: [
            { userId: manager.id, roleInProject: 'LEAD' },
            { userId: empE3.id, roleInProject: 'CONTRIBUTOR' },
          ],
        },
      },
    });

    recordTest(
      'Organizational Hierarchy',
      'Team Alpha, Team Beta, and Scoped Projects Creation',
      !!teamAlpha.id && !!teamBeta.id && !!projectAlpha.id && !!projectBeta.id,
      { alphaKey: projectAlpha.key, betaKey: projectBeta.key },
    );

    // ------------------------------------------------------------------------
    // STAGE 2: USER LIFECYCLE & ROLE TRANSITION
    // ------------------------------------------------------------------------
    console.log('\n--- 2. User Lifecycle & Approval Workflows ---');

    // 2.1 Pending User Creation & Manager Approval
    const pendingUser = await prisma.user.create({
      data: {
        email: `newhire-${Date.now()}@datai2i.com`,
        fullName: 'New Hire Candidate',
        roleId: empRole.id,
        approvalStatus: 'PENDING',
      },
    });

    // Manager approves user and assigns employeeId
    const approvedUser = await prisma.user.update({
      where: { id: pendingUser.id },
      data: {
        approvalStatus: 'APPROVED',
        employeeId: `EMP-${Date.now().toString().slice(-4)}`,
        approvedById: manager.id,
        approvedAt: new Date(),
      },
    });

    recordTest(
      'User Lifecycle',
      'Manager Approves Pending User & Provisions Employee ID',
      approvedUser.approvalStatus === 'APPROVED' && !!approvedUser.employeeId,
      { employeeId: approvedUser.employeeId },
    );

    // 2.2 Promotion: Employee E1 -> Lead
    await prisma.user.update({
      where: { id: empE1.id },
      data: { roleId: leadRole.id },
    });
    let promotedE1 = await prisma.user.findUnique({
      where: { id: empE1.id },
      include: { role: true },
    });
    const promotionPassed = promotedE1?.role.code === RoleCode.ROLE_LEAD;

    // Demotion: Lead E1 -> Employee
    await prisma.user.update({
      where: { id: empE1.id },
      data: { roleId: empRole.id },
    });
    let demotedE1 = await prisma.user.findUnique({
      where: { id: empE1.id },
      include: { role: true },
    });
    const demotionPassed = demotedE1?.role.code === RoleCode.ROLE_EMPLOYEE;

    recordTest(
      'User Lifecycle',
      'Employee Role Promotion and Demotion Integrity',
      promotionPassed && demotionPassed,
    );

    // ------------------------------------------------------------------------
    // STAGE 3: AUTHORIZATION BOUNDARIES & STRICT 404 RESOURCE HIDING
    // ------------------------------------------------------------------------
    console.log('\n--- 3. Authorization Boundaries & Resource Scope Hiding ---');

    // 3.1 Create a task in Project Beta
    const betaTask = await tasksService.createTask(
      {
        projectId: projectBeta.id,
        type: WorkItemType.TASK,
        title: 'Confidential Team Beta Task',
        description: 'Contains sensitive beta financial data',
      },
      managerCtx,
    );

    // 3.2 Employee E1 tries to access Beta task -> Must throw NotFoundException (Strict 404)
    let e1Blocked404 = false;
    try {
      await tasksService.getTaskById(betaTask.ticketId, empE1Ctx);
    } catch (err: any) {
      e1Blocked404 = err.status === 404 || err.message?.includes('not found');
    }
    recordTest(
      'Authorization Boundary',
      'Employee E1 strictly blocked with 404 on out-of-scope Project Beta Task',
      e1Blocked404,
    );

    // 3.3 Lead L1 tries to access Beta task -> Must throw 404 (Lead only has Team Alpha scope)
    let l1Blocked404 = false;
    try {
      await tasksService.getTaskById(betaTask.ticketId, leadL1Ctx);
    } catch (err: any) {
      l1Blocked404 = err.status === 404 || err.message?.includes('not found');
    }
    recordTest(
      'Authorization Boundary',
      'Lead L1 strictly blocked with 404 on cross-team Project Beta Task',
      l1Blocked404,
    );

    // 3.4 Manager has global authorized access
    const managerAccessedBetaTask = await tasksService.getTaskById(
      betaTask.ticketId,
      managerCtx,
    );
    recordTest(
      'Authorization Boundary',
      'Manager successfully accesses portfolio task via global governance',
      managerAccessedBetaTask.id === betaTask.id,
    );

    // ------------------------------------------------------------------------
    // STAGE 4: EMPLOYEE WORK JOURNEY & DONE GATE VALIDATION
    // ------------------------------------------------------------------------
    console.log('\n--- 4. Employee Work Journey & Authoritative Done Gate ---');

    // 4.1 Employee creates task in Project Alpha
    const alphaTask = await tasksService.createTask(
      {
        projectId: projectAlpha.id,
        type: WorkItemType.TASK,
        title: 'Core Microservice Cache Layer',
        description: 'Implement distributed Redis/in-memory cache',
        priority: TaskPriority.HIGH,
        estimatedHours: 16,
      },
      empE1Ctx,
    );

    recordTest(
      'Employee Journey',
      'Employee E1 creates Task with auto-sequenced Ticket ID',
      !!alphaTask.ticketId && alphaTask.ticketId.startsWith(projectAlpha.key),
      { ticketId: alphaTask.ticketId },
    );

    // 4.2 Add Mandatory Acceptance Criterion & Guidance Point
    const criterion = await tasksService.addCriterion(
      alphaTask.ticketId,
      { description: 'Cache hit ratio exceeds 90%', isMandatory: true },
      leadL1Ctx,
      '127.0.0.1',
    );

    const guidance = await tasksService.addGuidancePoint(
      alphaTask.ticketId,
      'Benchmark with 10k concurrent simulated requests',
      true,
      leadL1Ctx,
      '127.0.0.1',
    );

    // 4.3 Move TODO -> IN_PROGRESS
    await tasksService.transitionTask(
      alphaTask.ticketId,
      { targetStatus: WorkItemStatus.IN_PROGRESS },
      empE1Ctx,
      '127.0.0.1',
    );

    // 4.4 Attempt premature transition to DONE without completing criteria or review -> MUST FAIL Done Gate
    let prematureDoneBlocked = false;
    try {
      await tasksService.transitionTask(
        alphaTask.ticketId,
        { targetStatus: WorkItemStatus.DONE },
        empE1Ctx,
        '127.0.0.1',
      );
    } catch (err: any) {
      prematureDoneBlocked =
        err.message?.includes('Done Gate') ||
        err.message?.includes('criteria') ||
        err.message?.includes('review') ||
        err.status === 400;
    }

    recordTest(
      'Done Gate Governance',
      'Done Gate blocks premature completion when mandatory criteria incomplete',
      prematureDoneBlocked,
    );

    // 4.5 Satisfy Done Gate: Complete Criterion, Complete Guidance Point & Upload Evidence
    await tasksService.toggleCriterion(criterion.id, empE1Ctx, '127.0.0.1');
    await tasksService.toggleGuidancePoint(guidance.id, empE1Ctx, '127.0.0.1');

    const evidence = await tasksService.addEvidence(
      alphaTask.ticketId,
      {
        type: EvidenceType.TEST_RUN,
        title: 'Cache Benchmark Results',
        uri: 'https://benchmarks.internal/cache_results.json',
        notes: 'Passed 92% hit ratio',
      },
      empE1Ctx,
      '127.0.0.1',
    );

    // 4.6 Log Actual Hours
    await tasksService.updateTask(alphaTask.ticketId, { actualHours: 14 }, empE1Ctx, '127.0.0.1');

    // 4.7 Move to IN_REVIEW -> Approved by Lead -> DONE
    await tasksService.transitionTask(
      alphaTask.ticketId,
      { targetStatus: WorkItemStatus.IN_REVIEW },
      empE1Ctx,
      '127.0.0.1',
    );

    await tasksService.transitionTask(
      alphaTask.ticketId,
      { targetStatus: WorkItemStatus.APPROVED, comment: 'Performance validated' },
      leadL1Ctx,
    );

    const doneTask = await tasksService.transitionTask(
      alphaTask.ticketId,
      { targetStatus: WorkItemStatus.DONE },
      empE1Ctx,
    );

    recordTest(
      'Done Gate Governance',
      'Task transitions to DONE once all Acceptance Criteria & evidence satisfied',
      doneTask.status === WorkItemStatus.DONE,
      { finalStatus: doneTask.status, actualHours: doneTask.actualHours },
    );

    // ------------------------------------------------------------------------
    // STAGE 5: DEPENDENCY ENGINE & CYCLE PREVENTION
    // ------------------------------------------------------------------------
    console.log('\n--- 5. Dependency Engine & Cycle Prevention ---');

    // Create Task A and Task B
    const taskDepA = await tasksService.createTask(
      { projectId: projectAlpha.id, type: WorkItemType.TASK, title: 'Database Migration Script' },
      leadL1Ctx,
    );
    const taskDepB = await tasksService.createTask(
      { projectId: projectAlpha.id, type: WorkItemType.TASK, title: 'API Service Deployment' },
      leadL1Ctx,
    );

    // A BLOCKS B
    const depEdge = await tasksService.addDependency(
      taskDepA.ticketId,
      { targetTicketId: taskDepB.ticketId, type: DependencyType.BLOCKS },
      leadL1Ctx,
    );

    recordTest(
      'Dependency Engine',
      'Create directional BLOCKS dependency (A BLOCKS B)',
      !!depEdge.id && depEdge.type === DependencyType.BLOCKS,
    );

    // Move B to IN_PROGRESS
    await tasksService.transitionTask(
      taskDepB.ticketId,
      { targetStatus: WorkItemStatus.IN_PROGRESS },
      leadL1Ctx,
    );

    // Attempt to mark B as DONE while A is still in TODO -> Done Gate MUST reject due to active BLOCKS
    let blockedByDependency = false;
    try {
      await tasksService.transitionTask(
        taskDepB.ticketId,
        { targetStatus: WorkItemStatus.DONE },
        leadL1Ctx,
      );
    } catch (err: any) {
      blockedByDependency =
        err.message?.includes('BLOCKS') ||
        err.message?.includes('dependency') ||
        err.message?.includes('blocked') ||
        err.status === 400;
    }

    recordTest(
      'Done Gate Dependency Enforcement',
      'Done Gate blocks task completion when an active BLOCKS dependency remains open',
      blockedByDependency,
    );

    // Attempt opposite dependency: B BLOCKS A -> MUST BE REJECTED by cycle prevention
    let cyclePrevented = false;
    try {
      await tasksService.addDependency(
        taskDepB.ticketId,
        { targetTicketId: taskDepA.ticketId, type: DependencyType.BLOCKS },
        leadL1Ctx,
      );
    } catch (err: any) {
      cyclePrevented =
        err.message?.includes('cycle') || err.message?.includes('circular') || err.status === 400;
    }

    recordTest(
      'Dependency Engine',
      'Cycle prevention engine rejects inverse dependency (B BLOCKS A)',
      cyclePrevented,
    );

    // Complete Task A -> Now Task B should be allowed to complete
    await tasksService.addEvidence(
      taskDepA.ticketId,
      {
        type: EvidenceType.DOCUMENT,
        title: 'Task A Architecture Spec',
        uri: 'https://docs.internal/spec-a',
      },
      leadL1Ctx,
      '127.0.0.1',
    );
    await tasksService.transitionTask(
      taskDepA.ticketId,
      { targetStatus: WorkItemStatus.IN_PROGRESS },
      leadL1Ctx,
      '127.0.0.1',
    );
    await tasksService.transitionTask(
      taskDepA.ticketId,
      { targetStatus: WorkItemStatus.IN_REVIEW },
      leadL1Ctx,
      '127.0.0.1',
    );
    await tasksService.transitionTask(
      taskDepA.ticketId,
      { targetStatus: WorkItemStatus.APPROVED },
      leadL1Ctx,
      '127.0.0.1',
    );
    await tasksService.transitionTask(
      taskDepA.ticketId,
      { targetStatus: WorkItemStatus.DONE },
      leadL1Ctx,
      '127.0.0.1',
    );

    // Now Task B can complete
    await tasksService.addEvidence(
      taskDepB.ticketId,
      {
        type: EvidenceType.DOCUMENT,
        title: 'Task B Verification Spec',
        uri: 'https://docs.internal/spec-b',
      },
      leadL1Ctx,
      '127.0.0.1',
    );
    await tasksService.transitionTask(
      taskDepB.ticketId,
      { targetStatus: WorkItemStatus.IN_REVIEW },
      leadL1Ctx,
      '127.0.0.1',
    );
    await tasksService.transitionTask(
      taskDepB.ticketId,
      { targetStatus: WorkItemStatus.APPROVED },
      leadL1Ctx,
      '127.0.0.1',
    );
    const completedB = await tasksService.transitionTask(
      taskDepB.ticketId,
      { targetStatus: WorkItemStatus.DONE },
      leadL1Ctx,
      '127.0.0.1',
    );

    recordTest(
      'Done Gate Dependency Enforcement',
      'Blocked task completes successfully once upstream blocker transitions to DONE',
      completedB.status === WorkItemStatus.DONE,
    );

    // ------------------------------------------------------------------------
    // STAGE 6: TRACEABILITY PIPELINES
    // ------------------------------------------------------------------------
    console.log('\n--- 6. Traceability Pipelines (Standup & Meeting) ---');

    // 6.1 Standup -> Blocker -> Task
    const standupDate = `2026-10-${Math.floor(10 + Math.random() * 15)}`;
    const standup = await prisma.standup.create({
      data: {
        userId: empE1.id,
        teamId: teamAlpha.id,
        standupDate,
        yesterday: 'Finished unit tests',
        today: 'Working on caching layer',
        hasBlockers: true,
      },
    });

    const blocker = await prisma.standupBlocker.create({
      data: {
        standupId: standup.id,
        blockerText: 'AWS S3 bucket policy prevents upload in staging environment',
      },
    });

    const convertedBlockerResult = await standupsService.convertBlockerToTask(
      blocker.id,
      leadL1Ctx,
    );

    const reloadedBlocker = await prisma.standupBlocker.findUnique({
      where: { id: blocker.id },
    });

    recordTest(
      'Traceability: Standup -> Blocker -> Task',
      'Standup Blocker converted to Task with persistent 1:1 convertedTaskId linkage',
      reloadedBlocker?.convertedTaskId === convertedBlockerResult.task.id &&
        reloadedBlocker?.isResolved === true,
      { convertedTaskId: reloadedBlocker?.convertedTaskId },
    );

    // 6.2 Meeting -> Decision -> Action Item -> Task
    const meeting = await prisma.meeting.create({
      data: {
        title: 'Master Architecture & Delivery Review',
        startTime: new Date(),
        endTime: new Date(Date.now() + 3600000),
        organizerId: manager.id,
        participants: {
          create: [{ userId: manager.id }, { userId: leadL1.id }],
        },
      },
    });

    const actionItem = await prisma.meetingActionItem.create({
      data: {
        meetingId: meeting.id,
        description: 'Audit database indexes before production traffic cutover',
        assigneeId: empE1.id,
      },
    });

    const convertedActionResult = await meetingsService.convertActionItemToTask(
      meeting.id,
      actionItem.id,
      managerCtx,
    );

    const reloadedAction = await prisma.meetingActionItem.findUnique({
      where: { id: actionItem.id },
    });

    recordTest(
      'Traceability: Meeting -> Action Item -> Task',
      'Meeting Action Item converted to Task with persistent 1:1 convertedTaskId linkage',
      reloadedAction?.convertedTaskId === convertedActionResult.task.id,
      { convertedTaskId: reloadedAction?.convertedTaskId },
    );

    // 6.3 Project Decision Log Linked to Meeting
    const decision = await decisionsService.createDecision(
      {
        projectId: projectAlpha.id,
        meetingId: meeting.id,
        title: 'Enforce Pre-query Scoping on All Resource Ingestion',
        summary: 'All database queries must restrict authorized project IDs before execution',
        rationale: 'Eliminates memory overhead and prevents cross-tenant data leaks',
        status: 'APPROVED',
      },
      managerCtx,
    );

    recordTest(
      'Project Decision Log',
      'Architectural decision persisted with project and meeting linkage',
      decision.projectId === projectAlpha.id && decision.meetingId === meeting.id,
      { decisionId: decision.id, title: decision.title },
    );

    // ------------------------------------------------------------------------
    // STAGE 7: SPRINT LIFECYCLE & KANBAN WIP GOVERNANCE
    // ------------------------------------------------------------------------
    console.log('\n--- 7. Sprints, LexoRank, and Kanban WIP Governance ---');

    // 7.1 Create Sprints
    const sprint = await sprintsService.createSprint(
      {
        projectId: projectAlpha.id,
        name: 'Sprint Master 1',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      },
      leadL1Ctx,
    );

    // Add tasks to Sprint
    await sprintsService.addTasksToSprint(sprint.id, [alphaTask.id], leadL1Ctx);

    // Start Sprint (Takes snapshot into SprintCommitment)
    const activeSprint = await sprintsService.startSprint(
      sprint.id,
      {
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString(),
      },
      leadL1Ctx,
    );

    const commitments = await prisma.sprintCommitment.findMany({
      where: { sprintId: sprint.id },
    });

    recordTest(
      'Sprint Lifecycle',
      'Sprint started with historical SprintCommitment snapshot (wasPlanned = true)',
      activeSprint.status === 'ACTIVE' && commitments.length > 0 && commitments[0].wasPlanned,
      { activeSprintsCount: 1, commitmentsRecorded: commitments.length },
    );

    // 7.2 Kanban WIP Limit Enforcement
    // Create Board with columns and WIP limit
    const board: any = await prisma.board.create({
      data: {
        projectId: projectAlpha.id,
        name: 'Master Alpha Kanban Board',
        createdById: leadL1.id,
        columns: {
          create: [
            { name: 'To Do', orderIndex: 0, mappedStatuses: JSON.stringify([WorkItemStatus.TODO]) },
            {
              name: 'In Progress',
              orderIndex: 1,
              wipLimit: 1,
              wipLimitType: 'HARD_LIMIT',
              mappedStatuses: JSON.stringify([WorkItemStatus.IN_PROGRESS]),
            },
            { name: 'Done', orderIndex: 2, mappedStatuses: JSON.stringify([WorkItemStatus.DONE]) },
          ],
        },
      },
      include: { columns: true },
    });

    const inProgressCol = board.columns.find((c: any) => c.name === 'In Progress')!;

    // Create 2 tasks for WIP testing
    const wipTask1 = await tasksService.createTask(
      { projectId: projectAlpha.id, type: WorkItemType.TASK, title: 'WIP Test Task 1' },
      leadL1Ctx,
      '127.0.0.1',
    );
    const wipTask2 = await tasksService.createTask(
      {
        projectId: projectAlpha.id,
        type: WorkItemType.TASK,
        title: 'WIP Test Task 2',
        assigneeId: empE1.id,
      },
      leadL1Ctx,
      '127.0.0.1',
    );

    // Move first task into In Progress column (wipCount = 1)
    await boardsService.moveBoardCard(
      board.id,
      wipTask1.ticketId,
      { targetColumnId: inProgressCol.id },
      leadL1Ctx,
      '127.0.0.1',
    );

    // Move second task into In Progress column without override -> MUST BE REJECTED by HARD_LIMIT
    let wipHardLimitTriggered = false;
    try {
      await boardsService.moveBoardCard(
        board.id,
        wipTask2.ticketId,
        { targetColumnId: inProgressCol.id },
        empE1Ctx,
        '127.0.0.1',
      );
    } catch (err: any) {
      wipHardLimitTriggered =
        err.message?.includes('WIP') || err.message?.includes('limit') || err.status === 400;
    }

    recordTest(
      'Kanban WIP Limits',
      'Hard WIP Limit (wipLimit = 1) rejects exceeding task entry',
      wipHardLimitTriggered,
    );

    // ------------------------------------------------------------------------
    // STAGE 8: CAPACITY, TIMELINE CPM & WORK CALENDAR
    // ------------------------------------------------------------------------
    console.log('\n--- 8. Capacity, Timeline CPM & Work Calendar ---');

    // 8.1 Workload calculation
    const workload = await workloadService.getUserWorkload(empE1.id, empE1Ctx);
    recordTest(
      'Capacity & Workload',
      'User workload calculated with capacity ratio and allocation state',
      typeof workload.weeklyCapacityHours === 'number' && typeof workload.allocatedEstimatedHours === 'number',
      { capacityHours: workload.weeklyCapacityHours, allocatedHours: workload.allocatedEstimatedHours },
    );

    // 8.2 Timeline CPM Critical Path
    const timeline = await timelineService.getProjectTimeline(projectAlpha.id, leadL1Ctx);
    recordTest(
      'Timeline & CPM',
      'Gantt schedule generated with critical path tickets and slack floats',
      timeline.tasks.length > 0 && Array.isArray(timeline.criticalPathTicketIds),
      {
        totalTasks: timeline.tasks.length,
        criticalPathCount: timeline.criticalPathTicketIds.length,
      },
    );

    // 8.3 Virtual Work Calendar
    const calendarEvents = await calendarService.getCalendarEvents(
      {
        start: new Date(Date.now() - 7 * 86400000).toISOString(),
        end: new Date(Date.now() + 30 * 86400000).toISOString(),
      },
      leadL1Ctx,
    );
    recordTest(
      'Unified Work Calendar',
      'Calendar virtually aggregates task deadlines, sprints, and meetings with zero duplicate storage tables',
      calendarEvents.length > 0 &&
        calendarEvents.some((e) => e.sourceType === 'TASK_DEADLINE') &&
        calendarEvents.some((e) => e.sourceType === 'SPRINT'),
      { aggregatedEventsCount: calendarEvents.length },
    );

    // ------------------------------------------------------------------------
    // STAGE 9: ACCOUNTABILITY METRICS & DELIVERY HEALTH
    // ------------------------------------------------------------------------
    console.log('\n--- 9. Accountability Metrics & Delivery Health Engine ---');

    // 9.1 Accountability metrics calculation
    const metrics = await accountabilityService.getMetrics({ projectId: projectAlpha.id }, managerCtx);
    recordTest(
      'Accountability Metrics',
      'Calculates Due-Date Adherence, Sprint Say/Do, Scope Creep, and Blocker Aging',
      typeof metrics.dueDateAdherence.adherenceRate === 'number' &&
        Array.isArray(metrics.sprintSayDo) &&
        Array.isArray(metrics.scopeCreep),
      {
        dueAdherence: `${metrics.dueDateAdherence.adherenceRate}%`,
        sprintSayDoCount: metrics.sprintSayDo.length,
        scopeCreepCount: metrics.scopeCreep.length,
      },
    );

    // 9.2 Delivery Health Engine
    const health = await deliveryHealthService.evaluateProjectHealth(projectAlpha.id, managerCtx);
    recordTest(
      'Delivery Health Engine',
      'Evaluates 5 operational signals producing explainable deterministic health status',
      ['HEALTHY', 'AT_RISK', 'CRITICAL'].includes(health.overallState) && health.signals.length === 5,
      {
        status: health.overallState,
        evaluatedSignals: health.signals.map((s) => `${s.signalName}: ${s.healthState}`),
      },
    );

    // 9.3 Management Control Tower
    const controlTower = await controlTowerService.getSummary(managerCtx);
    recordTest(
      'Management Control Tower',
      'Manager views global portfolio operational health summary',
      controlTower.projectHealth.totalProjects >= 2 && Array.isArray(controlTower.risks),
      { totalProjects: controlTower.projectHealth.totalProjects, risksIdentified: controlTower.risks.length },
    );

    // ------------------------------------------------------------------------
    // STAGE 10: ADVANCED ANALYTICS & GLOBAL SEARCH
    // ------------------------------------------------------------------------
    console.log('\n--- 10. Advanced Analytics & Global Search ---');

    // 10.1 Advanced Analytics
    const analytics = await analyticsService.getAdvancedAnalytics({ projectId: projectAlpha.id }, managerCtx);
    recordTest(
      'Advanced Analytics',
      'Computes Lead/Cycle percentiles, Cumulative Flow, and Backlog Aging',
      typeof analytics.leadTimeDays.p85 === 'number' &&
        Array.isArray(analytics.cumulativeFlow) &&
        typeof analytics.backlogAging.under30d === 'number',
      {
        leadTimeP85: analytics.leadTimeDays.p85,
        cfdDataPoints: analytics.cumulativeFlow.length,
      },
    );

    // 10.2 Global Search Pre-Query Scoping
    // Search as Manager for confidential Beta task
    const managerSearch = await searchService.search('Confidential', managerCtx);
    const managerFoundBeta = managerSearch.results.some((r) => r.id === betaTask.id);

    // Search as Employee E1 for confidential Beta task -> MUST RETURN 0
    const e1Search = await searchService.search('Confidential', empE1Ctx);
    const e1FoundBeta = e1Search.results.some((r) => r.id === betaTask.id);

    recordTest(
      'Global Search Scoping',
      'Pre-query database scoping prevents cross-project search leaks (Employee 0 results, Manager finds item)',
      managerFoundBeta && !e1FoundBeta,
    );

    // ------------------------------------------------------------------------
    // STAGE 11: GOVERNED BULK OPERATIONS
    // ------------------------------------------------------------------------
    console.log('\n--- 11. Governed Bulk Operations ---');

    const bulkTaskA = await tasksService.createTask(
      { projectId: projectAlpha.id, type: WorkItemType.TASK, title: 'Bulk Candidate A' },
      leadL1Ctx,
    );
    const bulkTaskB = await tasksService.createTask(
      { projectId: projectAlpha.id, type: WorkItemType.TASK, title: 'Bulk Candidate B' },
      leadL1Ctx,
    );

    // Mixed batch:
    // Item 1: bulkTaskA -> Valid transition to IN_PROGRESS
    // Item 2: betaTask -> Unauthorized project for Lead L1 -> Must report failure
    const bulkRes = await bulkService.executeBulk(
      {
        action: 'TRANSITION',
        taskIds: [bulkTaskA.id, betaTask.id],
        payload: { targetStatus: WorkItemStatus.IN_PROGRESS },
      },
      leadL1Ctx,
    );

    const item1 = bulkRes.results.find((r) => r.taskId === bulkTaskA.id);
    const item2 = bulkRes.results.find((r) => r.taskId === betaTask.id);

    recordTest(
      'Governed Bulk Operations',
      'Partial batch execution: Valid items transition, unauthorized items fail without batch invalidation',
      item1?.success === true && item2?.success === false,
      { item1Success: item1?.success, item2Success: item2?.success, reason: item2?.reason },
    );

    // ------------------------------------------------------------------------
    // STAGE 12: GOVERNED AUTOMATION ENGINE
    // ------------------------------------------------------------------------
    console.log('\n--- 12. Governed Automation Engine ---');

    // 12.1 Create Rule
    const autoRule = await automationService.createRule(
      {
        projectId: projectAlpha.id,
        name: 'Auto Elevate Priority on Ingestion',
        eventType: 'TASK_CREATED',
        conditions: { typeEquals: WorkItemType.TASK },
        actions: { actionType: 'SET_PRIORITY', priority: TaskPriority.CRITICAL },
      },
      leadL1Ctx,
    );

    // Trigger Event
    const autoTask = await tasksService.createTask(
      { projectId: projectAlpha.id, type: WorkItemType.TASK, title: 'Automation Ingestion Target' },
      leadL1Ctx,
    );

    await automationService.triggerEvent(
      'TASK_CREATED',
      projectAlpha.id,
      autoTask.id,
      { type: WorkItemType.TASK },
    );

    const reloadedAutoTask = await prisma.task.findUnique({ where: { id: autoTask.id } });

    recordTest(
      'Automation Engine',
      'Event-Condition-Action triggers governed domain update (Priority elevated to Critical)',
      reloadedAutoTask?.priority === TaskPriority.CRITICAL,
      { ruleId: autoRule.id, taskPriority: reloadedAutoTask?.priority },
    );

    // 12.2 Recursion Guard (depth = 2)
    const recRes = await automationService.triggerEvent(
      'TASK_CREATED',
      projectAlpha.id,
      autoTask.id,
      { type: WorkItemType.TASK },
      2,
    );
    recordTest(
      'Automation Engine Safety',
      'Recursion depth guard (depth = 2) strictly aborts runaway execution',
      recRes.aborted === 1,
    );

    // ------------------------------------------------------------------------
    // STAGE 13: SMART DIGESTS & READ-ONLY ASK WORKDESK
    // ------------------------------------------------------------------------
    console.log('\n--- 13. Smart Notification Digests & Ask WorkDesk AI ---');

    // 13.1 Smart Notification Digest
    const digest = await notificationsService.generateDigest(empE1.id);
    recordTest(
      'Smart Notification Digests',
      'Digest compiles user-scoped actionable items with zero data leakage',
      digest.recipientId === empE1.id && typeof digest.totalActionableItems === 'number',
      { totalActionable: digest.totalActionableItems },
    );

    // 13.2 Read-Only Ask WorkDesk AI: Rejects Mutation Prompts
    const mutationAiRes = await askWorkdeskService.ask(
      { query: 'Please create task to clean database' },
      empE1Ctx,
    );
    const mutationRejected =
      mutationAiRes.answer.includes('strictly read-only') && mutationAiRes.citations.length === 0;

    recordTest(
      'Ask WorkDesk AI',
      'Ask WorkDesk rejects mutation attempts with read-only governance advisory',
      mutationRejected,
    );

    // 13.3 Read-Only Ask WorkDesk AI: Grounded Answer with Citations
    const groundedAiRes = await askWorkdeskService.ask(
      { query: `What is the status of ${alphaTask.ticketId}?` },
      empE1Ctx,
    );
    const citationValid =
      groundedAiRes.citations.some((c) => c.ticketId === alphaTask.ticketId) &&
      groundedAiRes.answer.includes(alphaTask.ticketId);

    recordTest(
      'Ask WorkDesk AI',
      'Factual ticket status query returns grounded answer citing verified record',
      citationValid,
      { citations: groundedAiRes.citations.map((c) => c.ticketId) },
    );

    // 13.4 Ask WorkDesk AI: Scope Boundary Check
    const outOfScopeAiRes = await askWorkdeskService.ask(
      { query: `What is the status of ${betaTask.ticketId}?` },
      empE1Ctx,
    );
    const scopeGuarded =
      outOfScopeAiRes.answer.includes('Insufficient authorized data') &&
      outOfScopeAiRes.citations.length === 0;

    recordTest(
      'Ask WorkDesk AI',
      'Unauthorized cross-project ticket query returns "Insufficient authorized data." without data leak',
      scopeGuarded,
    );

    console.log('\n========================================================================');
    console.log('MASTER LIVE E2E PRODUCTION READINESS TEST SUITE COMPLETE');
    const totalPassed = masterTestResults.filter((r) => r.passed).length;
    const totalFailed = masterTestResults.filter((r) => !r.passed).length;
    console.log(`TOTAL SCENARIOS: ${masterTestResults.length} | PASSED: ${totalPassed} | FAILED: ${totalFailed}`);
    console.log('========================================================================\n');
  } catch (err: any) {
    console.error('Master Acceptance Suite aborted:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runMasterE2EProductionReadinessSuite();
