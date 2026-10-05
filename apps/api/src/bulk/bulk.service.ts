import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { SprintsService } from '../sprints/sprints.service';
import {
  RoleCode,
  WorkItemStatus,
  BulkOperationDto,
  BulkOperationResponseDto,
  BulkItemResultDto,
} from '@workdesk/shared';

@Injectable()
export class BulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasksService: TasksService,
    private readonly sprintsService: SprintsService,
  ) {}

  async executeBulk(
    dto: BulkOperationDto,
    user: { id: string; roleCode: RoleCode },
    ipAddress?: string,
  ): Promise<BulkOperationResponseDto> {
    if (!dto.taskIds || !Array.isArray(dto.taskIds) || dto.taskIds.length === 0) {
      throw new BadRequestException('taskIds array is required and must not be empty');
    }

    if (dto.taskIds.length > 50) {
      throw new BadRequestException('Bulk operations are capped at 50 items per batch');
    }

    const results: BulkItemResultDto[] = [];
    let succeededCount = 0;
    let failedCount = 0;

    for (const taskId of dto.taskIds) {
      // Find task for ticketId reference
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, ticketId: true, status: true, projectId: true, sprintId: true },
      });

      if (!task) {
        results.push({
          taskId,
          ticketId: 'UNKNOWN',
          success: false,
          reason: `Task ${taskId} not found`,
        });
        failedCount++;
        continue;
      }

      try {
        switch (dto.action) {
          case 'ASSIGN': {
            await this.tasksService.updateTask(
              task.id,
              { assigneeId: dto.payload.assigneeId ?? null },
              user,
              ipAddress,
            );
            results.push({
              taskId: task.id,
              ticketId: task.ticketId,
              success: true,
              status: task.status as WorkItemStatus,
            });
            succeededCount++;
            break;
          }

          case 'UPDATE_PRIORITY': {
            if (!dto.payload.priority) {
              throw new BadRequestException('Priority is required for UPDATE_PRIORITY action');
            }
            await this.tasksService.updateTask(
              task.id,
              { priority: dto.payload.priority },
              user,
              ipAddress,
            );
            results.push({
              taskId: task.id,
              ticketId: task.ticketId,
              success: true,
              status: task.status as WorkItemStatus,
            });
            succeededCount++;
            break;
          }

          case 'MOVE_SPRINT': {
            if (dto.payload.sprintId) {
              await this.sprintsService.addTasksToSprint(
                dto.payload.sprintId,
                [task.id],
                user,
                ipAddress,
              );
            } else if (task.sprintId) {
              // Move to backlog
              await this.sprintsService.removeTaskFromSprint(task.sprintId, task.ticketId, user, ipAddress);
            }
            results.push({
              taskId: task.id,
              ticketId: task.ticketId,
              success: true,
              status: task.status as WorkItemStatus,
            });
            succeededCount++;
            break;
          }

          case 'TRANSITION': {
            if (!dto.payload.targetStatus) {
              throw new BadRequestException('targetStatus is required for TRANSITION action');
            }
            // Authoritative server-side transition through Phase 2 Transition Engine & Done Gate
            const updated = await this.tasksService.transitionTask(
              task.ticketId,
              {
                targetStatus: dto.payload.targetStatus,
                comment: dto.payload.reviewComment,
              },
              user,
              ipAddress,
            );
            results.push({
              taskId: task.id,
              ticketId: task.ticketId,
              success: true,
              status: updated.status as WorkItemStatus,
            });
            succeededCount++;
            break;
          }

          default:
            throw new BadRequestException(`Unsupported bulk action: ${dto.action}`);
        }
      } catch (err: any) {
        results.push({
          taskId: task.id,
          ticketId: task.ticketId,
          success: false,
          status: task.status as WorkItemStatus,
          reason: err.message || 'Operation failed',
        });
        failedCount++;
      }
    }

    return {
      totalRequested: dto.taskIds.length,
      succeededCount,
      failedCount,
      results,
    };
  }
}
