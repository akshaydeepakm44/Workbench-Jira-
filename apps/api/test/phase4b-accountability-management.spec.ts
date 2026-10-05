import { PrismaClient } from '@prisma/client';
import {
  RoleCode,
  WorkItemStatus,
  WorkItemType,
  DependencyType,
} from '@workdesk/shared';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuditService } from '../src/audit/audit.service';
import { TasksService } from '../src/tasks/tasks.service';
import { SprintsService } from '../src/sprints/sprints.service';
import { TimelineService } from '../src/timeline/timeline.service';
import { WorkloadService } from '../src/workload/workload.service';
import { AccountabilityService } from '../src/accountability/accountability.service';
import { DeliveryHealthService } from '../src/delivery-health/delivery-health.service';
import { ControlTowerService } from '../src/delivery-health/control-tower.service';
import { AnalyticsService } from '../src/analytics/analytics.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const sprintsService = new SprintsService(prismaService, auditService, tasksService);
const workloadService = new WorkloadService(prismaService, auditService);
const timelineService = new TimelineService(prismaService, auditService, tasksService);
const accountabilityService = new AccountabilityService(prismaService);
const deliveryHealthService = new DeliveryHealthService(prismaService, timelineService);
const controlTowerService = new ControlTowerService(prismaService, deliveryHealthService, workloadService);
const analyticsService = new AnalyticsService(prismaService);

async function runPhase4BAccountabilityManagementSuite() {
  console.log('================================================================');
  console.log('WORKDESK 2.0 — PHASE 4B ACCOUNTABILITY & MANAGEMENT TEST SUITE');
  console.log('================================================================\n');

  // Load test actors
  const manager = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_MANAGER } },
  });
  if (!manager) throw new Error('Manager not found');
  const managerCtx = { id: manager.id, roleCode: RoleCode.ROLE_MANAGER };

  const employee = await prisma.user.findFirst({
    where: { role: { code: RoleCode.ROLE_EMPLOYEE } },
  });
  if (!employee) throw new Error('Employee not found');
  const employeeCtx = { id: employee.id, roleCode: RoleCode.ROLE_EMPLOYEE };

  // Setup isolated test project
  const project = await prisma.project.create({
    data: {
      key: `P4B-${Date.now().toString().slice(-4)}`,
      name: 'Phase 4B Accountability Project',
      leadId: manager.id,
      members: {
        create: [
          { userId: manager.id, roleInProject: 'LEAD' },
          { userId: employee.id, roleInProject: 'CONTRIBUTOR' },
        ],
      },
    },
  });
  console.log(`[SETUP] Isolated Project Created: ${project.name} (${project.key})`);

  // =========================================================================
  // SUITE 1: ACCOUNTABILITY METRICS
  // =========================================================================
  console.log('\n[SUITE 1] Accountability Metrics Verification...');

  // 1.1 Due-Date Commitment Adherence
  console.log('  Testing Metric 1: Due-Date Commitment Adherence...');
  // Task 1: On-time (completed before deadline)
  const taskOnTime = await tasksService.createTask(
    {
      title: 'P4B On-Time Task',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: taskOnTime.id },
    data: {
      status: WorkItemStatus.DONE,
      completedAt: new Date(Date.now() - 1000), // completed before deadline
    },
  });

  // Task 2: Late (completed after deadline)
  const taskLate = await tasksService.createTask(
    {
      title: 'P4B Late Task',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      deadline: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: taskLate.id },
    data: {
      status: WorkItemStatus.DONE,
      completedAt: new Date(Date.now() - 1000), // completed after deadline
    },
  });

  // Task 3: No deadline (must be excluded from population)
  const taskNoDeadline = await tasksService.createTask(
    {
      title: 'P4B No Deadline Task',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: taskNoDeadline.id },
    data: {
      status: WorkItemStatus.DONE,
      completedAt: new Date(),
    },
  });

  // Task 4: Cancelled task (must be excluded)
  const taskCancelled = await tasksService.createTask(
    {
      title: 'P4B Cancelled Task',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      deadline: new Date(Date.now() - 10000).toISOString(),
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: taskCancelled.id },
    data: { status: WorkItemStatus.CANCELLED },
  });

  let metrics = await accountabilityService.getMetrics({ projectId: project.id }, managerCtx);
  console.log(
    `  Due-Date Adherence: ${metrics.dueDateAdherence.onTimeCount} on-time / ${metrics.dueDateAdherence.completedWithDeadline} total (${metrics.dueDateAdherence.adherenceRate * 100}%)`,
  );
  if (metrics.dueDateAdherence.completedWithDeadline !== 2 || metrics.dueDateAdherence.onTimeCount !== 1) {
    throw new Error(
      `Due-Date Adherence population error: expected 1 on-time of 2 completed with deadline, got ${metrics.dueDateAdherence.onTimeCount}/${metrics.dueDateAdherence.completedWithDeadline}`,
    );
  }
  if (metrics.dueDateAdherence.adherenceRate !== 0.5) {
    throw new Error(`Expected adherence rate 0.5, got ${metrics.dueDateAdherence.adherenceRate}`);
  }

  // 1.2 Sprint Say/Do Ratio & Scope Creep Rate
  console.log('  Testing Metric 2 & 3: Sprint Say/Do & Scope Creep...');
  const sprint = await sprintsService.createSprint(
    {
      projectId: project.id,
      name: 'P4B Sprint Say/Do',
    },
    managerCtx,
  );

  // Planned tasks in sprint: Task S1 (5 pts), Task S2 (8 pts) -> Total 13 planned points
  const taskS1 = await tasksService.createTask(
    {
      title: 'P4B Sprint Task 1',
      type: WorkItemType.STORY,
      projectId: project.id,
      sprintId: sprint.id,
      storyPoints: 5,
    },
    managerCtx,
  );

  const taskS2 = await tasksService.createTask(
    {
      title: 'P4B Sprint Task 2',
      type: WorkItemType.STORY,
      projectId: project.id,
      sprintId: sprint.id,
      storyPoints: 8,
    },
    managerCtx,
  );

  // Start sprint -> snapshot commitments with wasPlanned = true
  await sprintsService.startSprint(
    sprint.id,
    {
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    managerCtx,
    '127.0.0.1',
  );

  // Add mid-sprint scope creep: Task S3 (3 pts) -> wasPlanned = false
  const taskS3 = await tasksService.createTask(
    {
      title: 'P4B Unplanned Story',
      type: WorkItemType.STORY,
      projectId: project.id,
      storyPoints: 3,
    },
    managerCtx,
  );
  await sprintsService.addTasksToSprint(sprint.id, [taskS3.id], managerCtx);

  // Complete Task S1 (5 pts completed out of 13 planned)
  await prisma.task.update({
    where: { id: taskS1.id },
    data: { status: WorkItemStatus.DONE },
  });

  metrics = await accountabilityService.getMetrics({ projectId: project.id }, managerCtx);
  const sprintMetric = metrics.sprintSayDo.find((s) => s.sprintId === sprint.id);
  const creepMetric = metrics.scopeCreep.find((s) => s.sprintId === sprint.id);

  if (!sprintMetric || !creepMetric) throw new Error('Sprint metrics not found');

  console.log(
    `  Say/Do: Planned: ${sprintMetric.plannedPoints} pts, Completed: ${sprintMetric.completedPlannedPoints} pts, Ratio: ${sprintMetric.sayDoRatio * 100}%`,
  );
  console.log(
    `  Scope Creep: Initial: ${creepMetric.initialPlannedPoints} pts, Added: ${creepMetric.midSprintAddedPoints} pts, Rate: ${creepMetric.scopeCreepRate * 100}%`,
  );

  if (sprintMetric.plannedPoints !== 13 || sprintMetric.completedPlannedPoints !== 5) {
    throw new Error(`Say/Do calculation failed: expected 5/13, got ${sprintMetric.completedPlannedPoints}/${sprintMetric.plannedPoints}`);
  }
  if (creepMetric.midSprintAddedPoints !== 3 || creepMetric.scopeCreepRate !== 0.23) {
    throw new Error(`Scope creep calculation failed: expected 3/13 = 0.23, got ${creepMetric.midSprintAddedPoints}/${creepMetric.scopeCreepRate}`);
  }

  // 1.3 Blocker Aging & Rework Rate
  console.log('  Testing Metric 4 & 5: Blocker Aging & Review Rework...');
  // Create an active blocked task
  const blockedTask = await tasksService.createTask(
    {
      title: 'P4B Blocked Item',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: blockedTask.id },
    data: { status: WorkItemStatus.BLOCKED },
  });

  // Record audit log for rework on taskOnTime (transition to CHANGES_REQUESTED)
  await auditService.log({
    actorId: manager.id,
    action: 'TASK_STATUS_CHANGED',
    entityName: 'Task',
    entityId: taskOnTime.id,
    metadata: {
      from: WorkItemStatus.IN_REVIEW,
      to: WorkItemStatus.CHANGES_REQUESTED,
    },
  });

  metrics = await accountabilityService.getMetrics({ projectId: project.id }, managerCtx);
  console.log(`  Active Blockers: ${metrics.blockerAging.activeBlockersCount} item(s)`);
  console.log(`  Rework Rate: ${metrics.reworkRate.reworkRate * 100}% (${metrics.reworkRate.reworkedTasksCount} task(s))`);

  if (metrics.blockerAging.activeBlockersCount < 1) {
    throw new Error('Blocker aging failed to detect active blocked task');
  }
  if (metrics.reworkRate.reworkedTasksCount < 1) {
    throw new Error('Rework rate failed to detect CHANGES_REQUESTED audit log transition');
  }

  console.log('  Accountability Metrics: PASSED [100%]');

  // =========================================================================
  // SUITE 2: DELIVERY HEALTH ENGINE
  // =========================================================================
  console.log('\n[SUITE 2] Delivery Health Engine Verification...');

  const health = await deliveryHealthService.evaluateProjectHealth(project.id, managerCtx);
  console.log(`  Project Delivery Health: ${health.overallState}`);
  console.log(`  Summary: ${health.summary}`);
  console.log(`  Total Evaluated Signals: ${health.signals.length}`);

  for (const sig of health.signals) {
    console.log(`    • [${sig.healthState}] ${sig.signalName}: ${sig.observedEvidence}`);
  }

  if (!['HEALTHY', 'AT_RISK', 'CRITICAL'].includes(health.overallState)) {
    throw new Error(`Invalid health state: ${health.overallState}`);
  }

  if (health.signals.length < 5) {
    throw new Error(`Expected at least 5 evaluated signals, got ${health.signals.length}`);
  }

  // Verify structure of explainable evidence
  for (const s of health.signals) {
    if (!s.signalName || !s.observedEvidence || !s.rule || !s.threshold || !s.operationalAction) {
      throw new Error(`Explainable evidence incomplete on signal: ${s.signalName}`);
    }
  }

  console.log('  Delivery Health Engine: PASSED [100%]');

  // =========================================================================
  // SUITE 3: MANAGEMENT CONTROL TOWER
  // =========================================================================
  console.log('\n[SUITE 3] Management Control Tower Verification...');

  // Manager: Global portfolio view
  const managerSummary = await controlTowerService.getSummary(managerCtx);
  console.log(`  Manager Control Tower Projects: ${managerSummary.projectHealth.totalProjects}`);
  console.log(`  Active Blockers Across Portfolio: ${managerSummary.blockers.activeCount}`);
  console.log(`  Identified Top Risks: ${managerSummary.risks.length}`);

  if (managerSummary.projectHealth.totalProjects < 1) {
    throw new Error('Manager Control Tower failed to load portfolio');
  }

  // Employee: Scoped view (only member projects)
  const employeeSummary = await controlTowerService.getSummary(employeeCtx);
  console.log(`  Employee Control Tower Projects: ${employeeSummary.projectHealth.totalProjects}`);
  if (employeeSummary.projectHealth.totalProjects > managerSummary.projectHealth.totalProjects) {
    throw new Error('Employee should not see more projects than manager (authorization scope breached)');
  }

  console.log('  Management Control Tower: PASSED [100%]');

  // =========================================================================
  // SUITE 4: ADVANCED ANALYTICS
  // =========================================================================
  console.log('\n[SUITE 4] Advanced Analytics Engine Verification...');

  const analytics = await analyticsService.getAdvancedAnalytics({ projectId: project.id }, managerCtx);
  console.log(
    `  Lead Time (Days): Avg: ${analytics.leadTimeDays.avg}, Median: ${analytics.leadTimeDays.median}, P85: ${analytics.leadTimeDays.p85}`,
  );
  console.log(
    `  Cycle Time (Days): Avg: ${analytics.cycleTimeDays.avg}, Median: ${analytics.cycleTimeDays.median}, P85: ${analytics.cycleTimeDays.p85}`,
  );
  console.log(`  CFD Data Points: ${analytics.cumulativeFlow.length} samples`);
  console.log(`  Velocity History: ${analytics.velocityHistory.length} sprint(s)`);
  console.log(
    `  Backlog Aging Buckets: <30d: ${analytics.backlogAging.under30d}, 30-60d: ${analytics.backlogAging.d30to60}, 60-90d: ${analytics.backlogAging.d60to90}, >90d: ${analytics.backlogAging.over90d}`,
  );

  if (analytics.cumulativeFlow.length === 0) {
    throw new Error('CFD calculation returned 0 data points');
  }

  console.log('  Advanced Analytics Engine: PASSED [100%]');

  // Teardown isolated test data
  console.log('\n[TEARDOWN] Cleaning up isolated test entities...');
  await prisma.sprintCommitment.deleteMany({ where: { sprintId: sprint.id } });
  await prisma.taskActivity.deleteMany({ where: { task: { projectId: project.id } } });
  await prisma.auditLog.deleteMany({
    where: { entityId: { in: [taskOnTime.id, taskLate.id, taskNoDeadline.id, taskCancelled.id, taskS1.id, taskS2.id, taskS3.id, blockedTask.id] } },
  });
  await prisma.task.deleteMany({ where: { projectId: project.id } });
  await prisma.sprint.delete({ where: { id: sprint.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.projectSequence.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });

  console.log('================================================================');
  console.log('ALL PHASE 4B ACCOUNTABILITY & MANAGEMENT TESTS PASSED 100%!');
  console.log('================================================================\n');
}

runPhase4BAccountabilityManagementSuite()
  .catch((err) => {
    console.error('\n❌ PHASE 4B TEST FAILURE:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
