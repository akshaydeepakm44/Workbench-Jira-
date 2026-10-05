import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TimelineService } from '../timeline/timeline.service';
import {
  RoleCode,
  WorkItemStatus,
  DependencyType,
  DeliveryHealthDto,
  HealthSignalDto,
  HealthState,
} from '@workdesk/shared';

@Injectable()
export class DeliveryHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timelineService: TimelineService,
  ) {}

  async evaluateProjectHealth(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<DeliveryHealthDto> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true,
        tasks: {
          select: {
            id: true,
            ticketId: true,
            title: true,
            status: true,
            deadline: true,
            updatedAt: true,
            createdAt: true,
          },
        },
        boards: {
          include: {
            columns: true,
          },
        },
        sprints: {
          where: { status: 'ACTIVE' },
          include: {
            commitments: {
              include: {
                task: { select: { id: true, status: true, storyPoints: true } },
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    // Authorization check: Lead/Employee must be member or lead
    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      const isMember = project.members.some((m) => m.userId === user.id);
      if (!isMember) throw new NotFoundException(`Project ${projectId} not found`);
    } else if (user.roleCode === RoleCode.ROLE_LEAD) {
      const isLeadOrMember = project.leadId === user.id || project.members.some((m) => m.userId === user.id);
      if (!isLeadOrMember) throw new NotFoundException(`Project ${projectId} not found`);
    }

    const signals: HealthSignalDto[] = [];
    const openTasks = project.tasks.filter(
      (t) => t.status !== WorkItemStatus.DONE && t.status !== WorkItemStatus.CANCELLED,
    );
    const now = new Date();

    // Signal 1: Overdue Task Load
    const tasksWithDeadline = openTasks.filter((t) => t.deadline !== null);
    const overdueTasks = tasksWithDeadline.filter((t) => new Date(t.deadline!) < now);
    const overdueRatio = tasksWithDeadline.length > 0 ? overdueTasks.length / tasksWithDeadline.length : 0;

    let overdueState: HealthState = 'HEALTHY';
    if (overdueRatio > 0.3) overdueState = 'CRITICAL';
    else if (overdueRatio > 0.1) overdueState = 'AT_RISK';

    signals.push({
      signalName: 'Overdue Task Load',
      observedEvidence: `${overdueTasks.length} of ${tasksWithDeadline.length} open deadline tasks are past due (${Math.round(overdueRatio * 100)}%)`,
      rule: 'Percentage of open tasks with deadlines that have passed the current timestamp',
      threshold: 'Normal <= 10%, At Risk: 11-30%, Critical > 30%',
      healthState: overdueState,
      explanation:
        overdueState === 'HEALTHY'
          ? 'Overdue load is well within normal tolerance limits.'
          : `${overdueTasks.length} tasks have breached their target deadlines.`,
      operationalAction:
        overdueState === 'HEALTHY'
          ? 'Maintain standard execution cadence.'
          : 'Re-prioritize overdue items, adjust sprint scope, or reschedule realistic delivery dates.',
    });

    // Signal 2: Active Blocker Stagnation
    const blockedTasks = openTasks.filter((t) => t.status === WorkItemStatus.BLOCKED);
    let maxBlockerHours = 0;
    for (const b of blockedTasks) {
      const hrs = Math.max(0, (now.getTime() - new Date(b.updatedAt).getTime()) / (1000 * 60 * 60));
      if (hrs > maxBlockerHours) maxBlockerHours = hrs;
    }

    let blockerState: HealthState = 'HEALTHY';
    if (maxBlockerHours > 72) blockerState = 'CRITICAL';
    else if (maxBlockerHours > 24) blockerState = 'AT_RISK';

    signals.push({
      signalName: 'Blocker Stagnation',
      observedEvidence: `${blockedTasks.length} active blocked tasks. Maximum stagnation duration: ${Math.round(maxBlockerHours)} hours`,
      rule: 'Maximum elapsed duration of any task remaining in BLOCKED status',
      threshold: 'Healthy <= 24h, At Risk: 25-72h, Critical > 72h',
      healthState: blockerState,
      explanation:
        blockerState === 'HEALTHY'
          ? 'No long-standing impediments are arresting task progress.'
          : `Blockers have remained unresolved for ${Math.round(maxBlockerHours)} hours.`,
      operationalAction:
        blockerState === 'HEALTHY'
          ? 'No immediate intervention required.'
          : 'Convene blocker triage session with Leads to resolve upstream dependencies.',
    });

    // Signal 3: Critical Path Blockage (CPM)
    let criticalPathState: HealthState = 'HEALTHY';
    let criticalPathEvidence = 'No critical path blockers identified.';
    try {
      const timeline = await this.timelineService.getProjectTimeline(projectId, user);
      const criticalTicketIds = new Set(timeline.criticalPathTicketIds);
      const blockedOnCritical = openTasks.filter(
        (t) => criticalTicketIds.has(t.ticketId) && (t.status === WorkItemStatus.BLOCKED || (t.deadline && new Date(t.deadline) < now)),
      );

      if (blockedOnCritical.length > 0) {
        criticalPathState = 'CRITICAL';
        criticalPathEvidence = `${blockedOnCritical.length} critical path activities blocked or overdue: ${blockedOnCritical.map((t) => t.ticketId).join(', ')}`;
      } else {
        criticalPathEvidence = `All ${timeline.criticalPathTicketIds.length} critical path activities are on schedule.`;
      }
    } catch {
      criticalPathEvidence = 'Timeline CPM evaluation skipped or unconfigured.';
    }

    signals.push({
      signalName: 'Critical Path Integrity',
      observedEvidence: criticalPathEvidence,
      rule: 'Identifies BLOCKED or overdue tasks residing strictly on the CPM zero-float critical path',
      threshold: 'Healthy = 0 critical blockers, Critical >= 1 critical blocker',
      healthState: criticalPathState,
      explanation:
        criticalPathState === 'HEALTHY'
          ? 'The project delivery critical path is clear of obstructive bottlenecks.'
          : 'High-impact bottlenecks reside directly on the critical path, directly delaying final delivery.',
      operationalAction:
        criticalPathState === 'HEALTHY'
          ? 'Continue monitoring critical path slack.'
          : 'Immediate escalation: swarm resources to unblock critical path activities.',
    });

    // Signal 4: Review Bottleneck
    const reviewTasks = openTasks.filter((t) => t.status === WorkItemStatus.IN_REVIEW);
    let maxReviewHours = 0;
    for (const r of reviewTasks) {
      const hrs = Math.max(0, (now.getTime() - new Date(r.updatedAt).getTime()) / (1000 * 60 * 60));
      if (hrs > maxReviewHours) maxReviewHours = hrs;
    }

    let reviewState: HealthState = 'HEALTHY';
    if (reviewTasks.length > 5 || maxReviewHours > 72) reviewState = 'CRITICAL';
    else if (reviewTasks.length > 2 || maxReviewHours > 48) reviewState = 'AT_RISK';

    signals.push({
      signalName: 'Review Bottleneck',
      observedEvidence: `${reviewTasks.length} items awaiting review. Maximum review latency: ${Math.round(maxReviewHours)} hours`,
      rule: 'Number and duration of items stagnant in IN_REVIEW status',
      threshold: 'Healthy <= 48h, At Risk: 49-72h, Critical > 72h or > 5 items',
      healthState: reviewState,
      explanation:
        reviewState === 'HEALTHY'
          ? 'Review queue is flowing at normal velocity.'
          : `Review queue is stalling items for up to ${Math.round(maxReviewHours)} hours.`,
      operationalAction:
        reviewState === 'HEALTHY'
          ? 'Maintain review routine.'
          : 'Notify Leads and designated reviewers to prioritize pending approvals.',
    });

    // Signal 5: Kanban WIP Saturation
    let wipExceededCount = 0;
    for (const board of project.boards) {
      for (const col of board.columns) {
        if (col.wipLimit > 0) {
          const mappedStatuses: string[] = JSON.parse(col.mappedStatuses || '[]');
          const countInCol = openTasks.filter((t) => mappedStatuses.includes(t.status)).length;
          if (countInCol > col.wipLimit) {
            wipExceededCount++;
          }
        }
      }
    }

    let wipState: HealthState = 'HEALTHY';
    if (wipExceededCount > 0) wipState = 'AT_RISK';

    signals.push({
      signalName: 'WIP Saturation',
      observedEvidence: `${wipExceededCount} Kanban columns currently breaching configured WIP limits`,
      rule: 'Evaluates columns where active task count strictly exceeds configured column wipLimit',
      threshold: 'Healthy = 0 breached columns, At Risk >= 1 breached column',
      healthState: wipState,
      explanation:
        wipState === 'HEALTHY'
          ? 'Team is respecting configured work-in-progress concurrency limits.'
          : 'WIP limit breached: multitasking load is diluting focus and delivery speed.',
      operationalAction:
        wipState === 'HEALTHY'
          ? 'Maintain WIP governance.'
          : 'Halt new task intake until current work in congested columns is resolved.',
    });

    // Determine Overall Health State
    let overallState: HealthState = 'HEALTHY';
    if (signals.some((s) => s.healthState === 'CRITICAL')) {
      overallState = 'CRITICAL';
    } else if (signals.some((s) => s.healthState === 'AT_RISK')) {
      overallState = 'AT_RISK';
    }

    const summary =
      overallState === 'HEALTHY'
        ? `Project ${project.name} is HEALTHY. All 5 operational signals are within normal parameters.`
        : overallState === 'AT_RISK'
          ? `Project ${project.name} is AT RISK. ${signals.filter((s) => s.healthState !== 'HEALTHY').length} signals require proactive supervisory intervention.`
          : `Project ${project.name} is CRITICAL. Severe delivery impediments identified on critical path or overdue load.`;

    return {
      scopeType: 'PROJECT',
      scopeId: project.id,
      scopeName: project.name,
      overallState,
      summary,
      signals,
      evaluatedAt: now.toISOString(),
    };
  }
}
