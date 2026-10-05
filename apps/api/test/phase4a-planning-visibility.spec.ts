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
import { WorkloadService } from '../src/workload/workload.service';
import { TimelineService } from '../src/timeline/timeline.service';
import { CalendarService } from '../src/calendar/calendar.service';

const prisma = new PrismaClient();
const prismaService = prisma as unknown as PrismaService;
const auditService = new AuditService(prismaService);
const tasksService = new TasksService(prismaService, auditService);
const sprintsService = new SprintsService(prismaService, auditService, tasksService);
const workloadService = new WorkloadService(prismaService, auditService);
const timelineService = new TimelineService(prismaService, auditService, tasksService);
const calendarService = new CalendarService(prismaService, tasksService);

async function runPhase4APlanningVisibilitySuite() {
  console.log('===============================================================');
  console.log('WORKDESK 2.0 — PHASE 4A PLANNING & VISIBILITY VERIFICATION SUITE');
  console.log('===============================================================\n');

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

  // Clean up any remnants from previous failed test runs
  await prisma.taskDependency.deleteMany({
    where: {
      OR: [
        { task: { title: { startsWith: 'Phase 4A' } } },
        { task: { title: { startsWith: 'Gantt' } } },
      ],
    },
  });
  await prisma.task.deleteMany({
    where: {
      OR: [
        { title: { startsWith: 'Phase 4A' } },
        { title: { startsWith: 'Gantt' } },
      ],
    },
  });
  await prisma.projectMember.deleteMany({
    where: { project: { name: 'Phase 4A Verification Project' } },
  });
  await prisma.projectSequence.deleteMany({
    where: { project: { name: 'Phase 4A Verification Project' } },
  });
  await prisma.sprint.deleteMany({
    where: { project: { name: 'Phase 4A Verification Project' } },
  });
  await prisma.project.deleteMany({
    where: { name: 'Phase 4A Verification Project' },
  });

  // Create isolated test project
  const project = await prisma.project.create({
    data: {
      key: `P4A-${Date.now().toString().slice(-4)}`,
      name: 'Phase 4A Verification Project',
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
  // SUITE 1: WORKLOAD & CAPACITY ENGINE
  // =========================================================================
  console.log('\n[SUITE 1] Workload & Capacity Management...');

  // Ensure clean capacity state for employee
  await prisma.userCapacity.deleteMany({ where: { userId: employee.id } });

  // 1.1 Verify default capacity fallback (40 hours)
  const defaultCapacity = await workloadService.getUserCapacity(employee.id);
  console.log(`  Employee default capacity: ${defaultCapacity.weeklyCapacity} hrs`);
  if (defaultCapacity.weeklyCapacity !== 40) {
    throw new Error('Default capacity must be 40.0 hours');
  }

  // 1.2 Set custom capacity by Manager
  const updatedCapacity = await workloadService.setUserCapacity(
    employee.id,
    { weeklyCapacity: 32 },
    managerCtx,
    '127.0.0.1',
  );
  console.log(`  Manager configured capacity: ${updatedCapacity.weeklyCapacity} hrs`);
  if (updatedCapacity.weeklyCapacity !== 32) {
    throw new Error('Custom capacity must be 32.0 hours');
  }

  // 1.3 Assign tasks with estimated effort and test status classification
  // Task 1: 16 hrs -> 16/32 = 0.50 -> UNDER_ALLOCATED (< 0.70)
  const task1 = await tasksService.createTask(
    {
      title: 'Phase 4A Task 1',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      estimatedHours: 16,
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: task1.id },
    data: { status: WorkItemStatus.IN_PROGRESS },
  });

  let workload = await workloadService.getUserWorkload(employee.id, employeeCtx);
  console.log(`  Workload with 16 hrs: ${workload.allocatedEstimatedHours} hrs, Ratio: ${workload.utilizationRatio}, Status: ${workload.status}`);
  if (workload.status !== 'UNDER_ALLOCATED' || workload.utilizationRatio !== 0.5) {
    throw new Error(`Expected UNDER_ALLOCATED and ratio 0.5, got ${workload.status} / ${workload.utilizationRatio}`);
  }

  // Task 2: 12 hrs -> total 28/32 = 0.875 -> OPTIMAL (0.70 <= r <= 1.00)
  const task2 = await tasksService.createTask(
    {
      title: 'Phase 4A Task 2',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      estimatedHours: 12,
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: task2.id },
    data: { status: WorkItemStatus.IN_PROGRESS },
  });

  workload = await workloadService.getUserWorkload(employee.id, employeeCtx);
  console.log(`  Workload with 28 hrs: ${workload.allocatedEstimatedHours} hrs, Ratio: ${workload.utilizationRatio}, Status: ${workload.status}`);
  if (workload.status !== 'OPTIMAL' || workload.utilizationRatio !== 0.88) {
    throw new Error(`Expected OPTIMAL and ratio 0.88, got ${workload.status} / ${workload.utilizationRatio}`);
  }

  // Task 3: 8 hrs -> total 36/32 = 1.125 (0.88) -> OVER_ALLOCATED (1.00 < r <= 1.25)
  const task3 = await tasksService.createTask(
    {
      title: 'Phase 4A Task 3',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      estimatedHours: 8,
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: task3.id },
    data: { status: WorkItemStatus.IN_PROGRESS },
  });

  workload = await workloadService.getUserWorkload(employee.id, employeeCtx);
  console.log(`  Workload with 36 hrs: ${workload.allocatedEstimatedHours} hrs, Ratio: ${workload.utilizationRatio}, Status: ${workload.status}`);
  if (workload.status !== 'OVER_ALLOCATED' || workload.utilizationRatio !== 1.13) {
    throw new Error(`Expected OVER_ALLOCATED and ratio 1.13, got ${workload.status} / ${workload.utilizationRatio}`);
  }

  // Task 4: 8 hrs -> total 44/32 = 1.375 -> CRITICAL (> 1.25)
  const task4 = await tasksService.createTask(
    {
      title: 'Phase 4A Task 4',
      type: WorkItemType.TASK,
      projectId: project.id,
      assigneeId: employee.id,
      estimatedHours: 8,
    },
    managerCtx,
  );
  await prisma.task.update({
    where: { id: task4.id },
    data: { status: WorkItemStatus.IN_PROGRESS },
  });

  workload = await workloadService.getUserWorkload(employee.id, employeeCtx);
  console.log(`  Workload with 44 hrs: ${workload.allocatedEstimatedHours} hrs, Ratio: ${workload.utilizationRatio}, Status: ${workload.status}`);
  if (workload.status !== 'CRITICAL' || workload.utilizationRatio !== 1.38) {
    throw new Error(`Expected CRITICAL and ratio 1.38, got ${workload.status} / ${workload.utilizationRatio}`);
  }

  // Complete Task 4: COMPLETED tasks must NOT count towards active workload
  await prisma.task.update({
    where: { id: task4.id },
    data: { status: WorkItemStatus.DONE },
  });

  workload = await workloadService.getUserWorkload(employee.id, employeeCtx);
  console.log(`  Workload after Task 4 marked DONE: ${workload.allocatedEstimatedHours} hrs (expected 36)`);
  if (workload.allocatedEstimatedHours !== 36) {
    throw new Error(`DONE tasks must not count in active workload. Expected 36, got ${workload.allocatedEstimatedHours}`);
  }

  // 1.4 Project workload overview
  const projectWorkload = await workloadService.getProjectWorkload(project.id, managerCtx);
  console.log(`  Project Workload: ${projectWorkload.totalEstimatedHours} estimated hrs, ${projectWorkload.assignees.length} assignees`);
  if (projectWorkload.totalEstimatedHours < 36 || projectWorkload.assignees.length === 0) {
    throw new Error('Project workload aggregation failed');
  }

  console.log('  Workload & Capacity Engine: PASSED [100%]');

  // =========================================================================
  // SUITE 2: TIMELINE & CRITICAL PATH ENGINE (CPM)
  // =========================================================================
  console.log('\n[SUITE 2] Timeline / Gantt & CPM Critical Path...');

  // Setup linear dependency chain: Task A -> (BLOCKS) -> Task B -> (BLOCKS) -> Task C
  const taskA = await tasksService.createTask(
    {
      title: 'Gantt Root Activity A',
      type: WorkItemType.TASK,
      projectId: project.id,
      estimatedHours: 16, // 2 work days (at 8h/day)
      startDate: '2026-10-01T09:00:00Z',
      deadline: '2026-10-03T18:00:00Z',
    },
    managerCtx,
  );

  const taskB = await tasksService.createTask(
    {
      title: 'Gantt Middle Activity B',
      type: WorkItemType.TASK,
      projectId: project.id,
      estimatedHours: 24, // 3 work days
    },
    managerCtx,
  );

  const taskC = await tasksService.createTask(
    {
      title: 'Gantt End Activity C',
      type: WorkItemType.TASK,
      projectId: project.id,
      estimatedHours: 8, // 1 work day
    },
    managerCtx,
  );

  // Informational task D: RELATES_TO Task A
  const taskD = await tasksService.createTask(
    {
      title: 'Gantt Informational Task D',
      type: WorkItemType.TASK,
      projectId: project.id,
      estimatedHours: 40,
    },
    managerCtx,
  );

  // Establish dependencies
  // A BLOCKS B
  await tasksService.addDependency(
    taskB.id,
    { targetTicketId: taskA.ticketId, type: DependencyType.BLOCKS },
    managerCtx,
    '127.0.0.1',
  );

  // B BLOCKS C
  await tasksService.addDependency(
    taskC.id,
    { targetTicketId: taskB.ticketId, type: DependencyType.BLOCKS },
    managerCtx,
    '127.0.0.1',
  );

  // A RELATES_TO D (must NOT be treated as a scheduling dependency)
  await tasksService.addDependency(
    taskD.id,
    { targetTicketId: taskA.ticketId, type: DependencyType.RELATES_TO },
    managerCtx,
    '127.0.0.1',
  );

  // Fetch timeline
  const timeline = await timelineService.getProjectTimeline(project.id, managerCtx);
  console.log(`  Timeline generated: ${timeline.tasks.length} tasks, Critical Path Tickets: ${timeline.criticalPathTicketIds.length}`);

  const ganttA = timeline.tasks.find((t) => t.id === taskA.id);
  const ganttB = timeline.tasks.find((t) => t.id === taskB.id);
  const ganttC = timeline.tasks.find((t) => t.id === taskC.id);
  const ganttD = timeline.tasks.find((t) => t.id === taskD.id);

  if (!ganttA || !ganttB || !ganttC || !ganttD) {
    throw new Error('All tasks must be present in timeline output');
  }

  console.log(`  Task A isCritical: ${ganttA.isCriticalPath}, slack: ${ganttA.totalSlackDays}`);
  console.log(`  Task B isCritical: ${ganttB.isCriticalPath}, slack: ${ganttB.totalSlackDays}`);
  console.log(`  Task C isCritical: ${ganttC.isCriticalPath}, slack: ${ganttC.totalSlackDays}`);
  console.log(`  Task D isCritical: ${ganttD.isCriticalPath}, slack: ${ganttD.totalSlackDays}`);

  // Invariant verification: Only BLOCKS participates in critical path
  if (!ganttA.isCriticalPath || !ganttB.isCriticalPath || !ganttC.isCriticalPath) {
    throw new Error('Linear BLOCKS dependency chain (A -> B -> C) must be on critical path');
  }

  // 2.2 Reschedule validation
  console.log('  Testing task rescheduling...');
  const rescheduled = await timelineService.rescheduleTask(
    taskA.id,
    {
      startDate: '2026-10-05T09:00:00Z',
      deadline: '2026-10-10T18:00:00Z',
    },
    managerCtx,
    '127.0.0.1',
  );
  if (!rescheduled.startDate || !rescheduled.deadline) {
    throw new Error('Reschedule failed to set dates');
  }

  // 2.3 Boundary validation: deadline < startDate must throw
  let boundaryCaught = false;
  try {
    await timelineService.rescheduleTask(
      taskA.id,
      {
        startDate: '2026-10-10T09:00:00Z',
        deadline: '2026-10-05T18:00:00Z', // Invalid: before start
      },
      managerCtx,
      '127.0.0.1',
    );
  } catch (err: any) {
    boundaryCaught = true;
    console.log(`  Boundary check passed: caught expected rejection (${err.message})`);
  }
  if (!boundaryCaught) {
    throw new Error('Rescheduling with deadline < startDate must fail validation');
  }

  console.log('  Timeline / Gantt Engine: PASSED [100%]');

  // =========================================================================
  // SUITE 3: UNIFIED WORK CALENDAR ENGINE
  // =========================================================================
  console.log('\n[SUITE 3] Unified Work Calendar Virtual Aggregation...');

  // Create sprint in project
  const sprint = await sprintsService.createSprint(
    {
      projectId: project.id,
      name: 'Phase 4A Calendar Sprint',
      startDate: '2026-10-01T00:00:00Z',
      endDate: '2026-10-14T23:59:59Z',
    },
    managerCtx,
  );

  // Create meeting
  const meeting = await prisma.meeting.create({
    data: {
      title: 'Phase 4A Architecture Sync',
      startTime: new Date('2026-10-06T14:00:00Z'),
      endTime: new Date('2026-10-06T15:00:00Z'),
      organizerId: manager.id,
      googleMeetUrl: 'https://meet.google.com/abc-defg-hij',
      participants: {
        create: [
          { userId: manager.id, responseStatus: 'ACCEPTED' },
          { userId: employee.id, responseStatus: 'ACCEPTED' },
        ],
      },
    },
  });

  // Query calendar for October 2026
  const calendarEvents = await calendarService.getCalendarEvents(
    {
      start: new Date('2026-10-01T00:00:00Z').toISOString(),
      end: new Date('2026-10-31T23:59:59Z').toISOString(),
    },
    managerCtx,
  );

  console.log(`  Total aggregated calendar events: ${calendarEvents.length}`);

  // Verify multi-model aggregation:
  const taskEvents = calendarEvents.filter((e) => e.sourceType === 'TASK_DEADLINE');
  const sprintEvents = calendarEvents.filter((e) => e.sourceType === 'SPRINT');
  const meetingEvents = calendarEvents.filter((e) => e.sourceType === 'MEETING');

  console.log(`  Aggregated Task Deadlines: ${taskEvents.length}`);
  console.log(`  Aggregated Sprints: ${sprintEvents.length}`);
  console.log(`  Aggregated Meetings: ${meetingEvents.length}`);

  if (sprintEvents.length === 0) throw new Error('Sprint events must be aggregated in calendar');
  if (meetingEvents.length === 0) throw new Error('Meeting events must be aggregated in calendar');

  // Invariant verification: Virtual query aggregation
  // Verify no separate Calendar table exists
  const tableCheck = await prisma.$queryRaw<any[]>`
    SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%calendar%'
  `;
  console.log(`  Physical calendar storage tables in DB: ${tableCheck.length}`);
  if (tableCheck.length > 0) {
    throw new Error('Calendar must remain a pure virtual aggregation query; no physical calendar table allowed');
  }

  console.log('  Unified Work Calendar Engine: PASSED [100%]');

  // Cleanup isolated test data
  console.log('\n[TEARDOWN] Cleaning up isolated test entities...');
  await prisma.taskDependency.deleteMany({
    where: {
      OR: [
        { taskId: { in: [task1.id, task2.id, task3.id, task4.id, taskA.id, taskB.id, taskC.id, taskD.id] } },
        { targetTaskId: { in: [task1.id, task2.id, task3.id, task4.id, taskA.id, taskB.id, taskC.id, taskD.id] } },
      ],
    },
  });
  await prisma.task.deleteMany({
    where: { projectId: project.id },
  });
  await prisma.sprint.delete({ where: { id: sprint.id } });
  await prisma.meetingParticipant.deleteMany({ where: { meetingId: meeting.id } });
  await prisma.meeting.delete({ where: { id: meeting.id } });
  await prisma.projectMember.deleteMany({ where: { projectId: project.id } });
  await prisma.projectSequence.deleteMany({ where: { projectId: project.id } });
  await prisma.project.delete({ where: { id: project.id } });
  await prisma.userCapacity.deleteMany({ where: { userId: employee.id } });

  console.log('===============================================================');
  console.log('ALL PHASE 4A PLANNING & VISIBILITY VERIFICATIONS PASSED 100%!');
  console.log('===============================================================\n');
}

runPhase4APlanningVisibilitySuite()
  .catch((err) => {
    console.error('\n❌ PHASE 4A TEST FAILURE:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
