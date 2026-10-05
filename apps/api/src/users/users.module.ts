import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ProjectsController } from './projects.controller';

@Module({
  controllers: [UsersController, ProjectsController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

