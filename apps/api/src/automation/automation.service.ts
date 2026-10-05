import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksService } from '../tasks/tasks.service';
import {
  RoleCode,
  AutomationRuleDto,
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  WorkItemStatus,
  TaskPriority,
} from '@workdesk/shared';

@Injectable()
export class AutomationService {
  // In-memory rate limiter: projectId -> { count, windowStart }
  private rateLimitMap = new Map<string, { count: number; windowStart: number }>();
  private readonly MAX_EXECUTIONS_PER_MINUTE = 50;
  private readonly MAX_RECURSION_DEPTH = 2;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly tasksService: TasksService,
  ) {}

  private checkRateLimit(projectId: string): boolean {
    const now = Date.now();
    const window = this.rateLimitMap.get(projectId);

    if (!window || now - window.windowStart > 60000) {
      this.rateLimitMap.set(projectId, { count: 1, windowStart: now });
      return true;
    }

    if (window.count >= this.MAX_EXECUTIONS_PER_MINUTE) {
      return false; // Exceeded
    }

    window.count++;
    return true;
  }

  private async verifyProjectAccess(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    if (user.roleCode === RoleCode.ROLE_EMPLOYEE) {
      throw new ForbiddenException('Employees cannot configure or manage automation rules');
    }

    if (user.roleCode === RoleCode.ROLE_LEAD) {
      const isLeadOrMember =
        project.leadId === user.id || project.members.some((m) => m.userId === user.id);
      if (!isLeadOrMember) throw new NotFoundException(`Project ${projectId} not found`);
    }

    return project;
  }

  async createRule(
    dto: CreateAutomationRuleDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<AutomationRuleDto> {
    await this.verifyProjectAccess(dto.projectId, user);

    const rule = await this.prisma.automationRule.create({
      data: {
        projectId: dto.projectId,
        name: dto.name,
        description: dto.description,
        eventType: dto.eventType,
        conditions: JSON.stringify(dto.conditions || {}),
        actions: JSON.stringify(dto.actions || {}),
        isEnabled: true,
        creatorId: user.id,
      },
      include: {
        creator: { select: { fullName: true } },
      },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'AUTOMATION_RULE_CREATED',
      entityName: 'AutomationRule',
      entityId: rule.id,
      metadata: {
        projectId: dto.projectId,
        ruleName: dto.name,
        eventType: dto.eventType,
      },
      ipAddress,
    });

    return this.mapRuleToDto(rule);
  }

  async getRules(
    projectId: string,
    user: { id: string; roleCode: RoleCode },
  ): Promise<AutomationRuleDto[]> {
    await this.verifyProjectAccess(projectId, user);

    const rules = await this.prisma.automationRule.findMany({
      where: { projectId },
      include: { creator: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return rules.map((r) => this.mapRuleToDto(r));
  }

  async updateRule(
    ruleId: string,
    dto: UpdateAutomationRuleDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<AutomationRuleDto> {
    const existing = await this.prisma.automationRule.findUnique({
      where: { id: ruleId },
    });
    if (!existing) throw new NotFoundException(`Rule ${ruleId} not found`);

    await this.verifyProjectAccess(existing.projectId, user);

    const updated = await this.prisma.automationRule.update({
      where: { id: ruleId },
      data: {
        name: dto.name ?? undefined,
        description: dto.description ?? undefined,
        conditions: dto.conditions ? JSON.stringify(dto.conditions) : undefined,
        actions: dto.actions ? JSON.stringify(dto.actions) : undefined,
        isEnabled: dto.isEnabled ?? undefined,
      },
      include: { creator: { select: { fullName: true } } },
    });

    await this.auditService.log({
      actorId: user.id,
      action: 'AUTOMATION_RULE_UPDATED',
      entityName: 'AutomationRule',
      entityId: updated.id,
      metadata: { isEnabled: updated.isEnabled },
      ipAddress,
    });

    return this.mapRuleToDto(updated);
  }

  async deleteRule(
    ruleId: string,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<{ success: boolean }> {
    const existing = await this.prisma.automationRule.findUnique({
      where: { id: ruleId },
    });
    if (!existing) throw new NotFoundException(`Rule ${ruleId} not found`);

    await this.verifyProjectAccess(existing.projectId, user);

    await this.prisma.automationRule.delete({ where: { id: ruleId } });

    await this.auditService.log({
      actorId: user.id,
      action: 'AUTOMATION_RULE_DELETED',
      entityName: 'AutomationRule',
      entityId: ruleId,
      ipAddress,
    });

    return { success: true };
  }

  async getExecutionLogs(
    ruleId: string,
    user: { id: string; roleCode: RoleCode },
  ) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id: ruleId },
    });
    if (!rule) throw new NotFoundException(`Rule ${ruleId} not found`);

    await this.verifyProjectAccess(rule.projectId, user);

    return this.prisma.automationExecutionLog.findMany({
      where: { ruleId },
      orderBy: { executedAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Authoritative Event Execution Dispatcher
   */
  async triggerEvent(
    eventType: string,
    projectId: string,
    targetEntityId: string,
    payload: Record<string, any>,
    recursionDepth: number = 0,
  ): Promise<{ executed: number; aborted: number; rateLimited: boolean }> {
    // 1. Recursion Safety Check
    if (recursionDepth >= this.MAX_RECURSION_DEPTH) {
      console.warn(
        `[AUTOMATION] Recursion depth ${recursionDepth} exceeded limit ${this.MAX_RECURSION_DEPTH}. Aborting.`,
      );
      return { executed: 0, aborted: 1, rateLimited: false };
    }

    // 2. Rate Limiting Check (50 executions / project / min)
    if (!this.checkRateLimit(projectId)) {
      console.warn(`[AUTOMATION] Project ${projectId} rate limit breached (50/min).`);
      return { executed: 0, aborted: 1, rateLimited: true };
    }

    // 3. Find Enabled Rules for this project and event
    const rules = await this.prisma.automationRule.findMany({
      where: {
        projectId,
        eventType,
        isEnabled: true,
      },
      include: {
        creator: {
          include: { role: true },
        },
      },
    });

    if (rules.length === 0) {
      return { executed: 0, aborted: 0, rateLimited: false };
    }

    let executed = 0;
    let aborted = 0;

    for (const rule of rules) {
      const creator = rule.creator;

      // 4. Runtime Creator Permission & Scope Verification
      const isCreatorValid =
        creator &&
        creator.approvalStatus === 'APPROVED' &&
        (creator.role.code === RoleCode.ROLE_LEAD ||
          creator.role.code === RoleCode.ROLE_MANAGER);

      if (!isCreatorValid) {
        // Creator lost permissions or is deactivated -> disable rule and abort
        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: { isEnabled: false },
        });

        await this.prisma.automationExecutionLog.create({
          data: {
            ruleId: rule.id,
            triggerEvent: eventType,
            targetEntityId,
            status: 'ABORTED_PERMISSION_LOST',
            resultSummary: `Creator ${rule.creatorId} is no longer an authorized Lead/Manager. Rule disabled.`,
          },
        });

        await this.auditService.log({
          actorId: rule.creatorId,
          action: 'AUTOMATION_DISABLED_PERMISSION_LOST',
          entityName: 'AutomationRule',
          entityId: rule.id,
          metadata: { ruleName: rule.name, reason: 'Permission lost' },
        });

        aborted++;
        continue;
      }

      // 5. Evaluate Conditions
      let conditions: Record<string, any> = {};
      let actions: Record<string, any> = {};
      try {
        conditions = JSON.parse(rule.conditions);
        actions = JSON.parse(rule.actions);
      } catch (e) {
        console.error('Failed to parse rule conditions/actions', e);
        continue;
      }

      const matchesCondition = this.evaluateConditions(conditions, payload);
      if (!matchesCondition) {
        continue;
      }

      // 6. Execute Governed Action
      try {
        const creatorCtx = { id: creator.id, roleCode: creator.role.code as RoleCode };
        await this.executeAction(actions, targetEntityId, creatorCtx, recursionDepth);

        await this.prisma.automationExecutionLog.create({
          data: {
            ruleId: rule.id,
            triggerEvent: eventType,
            targetEntityId,
            status: 'SUCCESS',
            resultSummary: `Executed action ${actions.actionType || 'GENERIC'} on ${targetEntityId}`,
          },
        });

        await this.auditService.log({
          actorId: creator.id,
          action: 'AUTOMATION_EXECUTED',
          entityName: 'AutomationRule',
          entityId: rule.id,
          metadata: { targetEntityId, actionType: actions.actionType },
        });

        executed++;
      } catch (err: any) {
        console.error(`[AUTOMATION] Execution failed for rule ${rule.id}:`, err);
        await this.prisma.automationExecutionLog.create({
          data: {
            ruleId: rule.id,
            triggerEvent: eventType,
            targetEntityId,
            status: 'FAILED',
            resultSummary: err.message || 'Execution error',
          },
        });
        aborted++;
      }
    }

    return { executed, aborted, rateLimited: false };
  }

  private evaluateConditions(
    conditions: Record<string, any>,
    payload: Record<string, any>,
  ): boolean {
    if (Object.keys(conditions).length === 0) return true;

    if (conditions.statusEquals && payload.targetStatus !== conditions.statusEquals) {
      return false;
    }

    if (conditions.priorityEquals && payload.priority !== conditions.priorityEquals) {
      return false;
    }

    if (conditions.typeEquals && payload.type !== conditions.typeEquals) {
      return false;
    }

    return true;
  }

  private async executeAction(
    actions: Record<string, any>,
    targetEntityId: string,
    creatorCtx: { id: string; roleCode: RoleCode },
    recursionDepth: number,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: targetEntityId },
      select: { id: true, ticketId: true, status: true, projectId: true },
    });
    if (!task) return;

    switch (actions.actionType) {
      case 'ASSIGN': {
        if (actions.assigneeId) {
          await this.tasksService.updateTask(
            task.id,
            { assigneeId: actions.assigneeId },
            creatorCtx,
          );
        }
        break;
      }

      case 'SET_PRIORITY': {
        if (actions.priority) {
          await this.tasksService.updateTask(
            task.id,
            { priority: actions.priority as TaskPriority },
            creatorCtx,
          );
        }
        break;
      }

      case 'TRANSITION': {
        if (actions.targetStatus) {
          // Governed transition through Phase 2 engine and Done Gate
          await this.tasksService.transitionTask(
            task.ticketId,
            {
              targetStatus: actions.targetStatus as WorkItemStatus,
              comment: actions.comment || 'Automated transition by WorkDesk Automation Engine',
            },
            creatorCtx,
          );
        }
        break;
      }

      default:
        console.warn(`[AUTOMATION] Unknown action type: ${actions.actionType}`);
    }
  }

  private mapRuleToDto(rule: any): AutomationRuleDto {
    return {
      id: rule.id,
      projectId: rule.projectId,
      name: rule.name,
      description: rule.description,
      eventType: rule.eventType,
      conditions: JSON.parse(rule.conditions || '{}'),
      actions: JSON.parse(rule.actions || '{}'),
      isEnabled: rule.isEnabled,
      creatorId: rule.creatorId,
      creatorName: rule.creator?.fullName,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
}
