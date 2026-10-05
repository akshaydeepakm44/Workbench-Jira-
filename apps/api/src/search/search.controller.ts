import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { SearchService } from './search.service';
import { SessionGuard } from '../auth/session.guard';
import { PolicyGuard } from '../auth/policy.guard';
import { GlobalSearchResponseDto } from '@workdesk/shared';
import { Request } from 'express';

@Controller('search')
@UseGuards(SessionGuard, PolicyGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  async search(
    @Query('q') q: string,
    @Query('limit') limit: number | undefined,
    @Req() req: Request,
  ): Promise<GlobalSearchResponseDto> {
    return this.searchService.search(q, (req as any).user, limit ? Number(limit) : 20);
  }
}
