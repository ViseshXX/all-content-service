import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { RolesGuard, Roles } from 'src/auth/roles.guard';
import { CmsUserService } from 'src/services/cms-user.service';
import { AuditLogService } from 'src/services/audit-log.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UserManagementController {
  constructor(
    private readonly cmsUserService: CmsUserService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @ApiOperation({ summary: 'Create a new user (admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', example: 'john_curator' },
        password: { type: 'string', example: 'securePassword123' },
        email: { type: 'string', example: 'john@example.com' },
        role: { type: 'string', enum: ['admin', 'curator'], example: 'curator' },
      },
    },
  })
  @Post()
  async createUser(@Req() request: any, @Res() response: FastifyReply, @Body() body: any) {
    try {
      const existing = await this.cmsUserService.findByUsername(body.username);
      if (existing) {
        return response.status(HttpStatus.CONFLICT).send({
          status: 'error',
          message: `Username '${body.username}' already exists`,
        });
      }

      const user = await this.cmsUserService.create({
        username: body.username,
        password: body.password,
        email: body.email,
        role: body.role,
      });

      this.auditLogService.log({
        action: 'CREATE',
        resource: 'user',
        resourceId: String(user.virtualId),
        actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
        summary: `Created user '${user.username}' with role '${user.role}'`,
        ipAddress: request.ip,
      });

      return response.status(HttpStatus.CREATED).send({
        status: 'success',
        data: {
          virtualId: user.virtualId,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      });
    } catch (error: any) {
      console.error('[UserManagement] Create error:', error?.message);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: error?.message || 'Failed to create user',
      });
    }
  }

  @ApiOperation({ summary: 'List all users (admin only)' })
  @Get()
  async listUsers(@Res() response: FastifyReply) {
    try {
      const users = await this.cmsUserService.findAll();
      return response.status(HttpStatus.OK).send({
        status: 'success',
        data: users,
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to fetch users',
      });
    }
  }

  @ApiOperation({ summary: 'Update user details (admin only)' })
  @Put(':virtualId')
  async updateUser(
    @Req() request: any,
    @Res() response: FastifyReply,
    @Param('virtualId') virtualId: string,
    @Body() body: { username?: string; email?: string; role?: string },
  ) {
    try {
      const updated = await this.cmsUserService.update(Number(virtualId), body);
      if (!updated) {
        return response.status(HttpStatus.NOT_FOUND).send({
          status: 'error',
          message: 'User not found',
        });
      }

      this.auditLogService.log({
        action: 'UPDATE',
        resource: 'user',
        resourceId: virtualId,
        actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
        summary: `Updated user '${updated.username}'`,
        changes: body as any,
        ipAddress: request.ip,
      });

      return response.status(HttpStatus.OK).send({
        status: 'success',
        data: updated,
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to update user',
      });
    }
  }

  @ApiOperation({ summary: 'Deactivate user (admin only)' })
  @Delete(':virtualId')
  async deactivateUser(
    @Req() request: any,
    @Res() response: FastifyReply,
    @Param('virtualId') virtualId: string,
  ) {
    try {
      const deactivated = await this.cmsUserService.deactivate(Number(virtualId));
      if (!deactivated) {
        return response.status(HttpStatus.NOT_FOUND).send({
          status: 'error',
          message: 'User not found',
        });
      }

      this.auditLogService.log({
        action: 'DELETE',
        resource: 'user',
        resourceId: virtualId,
        actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
        summary: `Deactivated user '${deactivated.username}'`,
        ipAddress: request.ip,
      });

      return response.status(HttpStatus.OK).send({
        status: 'success',
        message: `User '${deactivated.username}' deactivated`,
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to deactivate user',
      });
    }
  }

  @ApiOperation({ summary: 'Change user password (admin only)' })
  @Put(':virtualId/password')
  async changePassword(
    @Req() request: any,
    @Res() response: FastifyReply,
    @Param('virtualId') virtualId: string,
    @Body() body: { password: string },
  ) {
    try {
      if (!body.password || body.password.length < 6) {
        return response.status(HttpStatus.BAD_REQUEST).send({
          status: 'error',
          message: 'Password must be at least 6 characters',
        });
      }

      const updated = await this.cmsUserService.changePassword(Number(virtualId), body.password);
      if (!updated) {
        return response.status(HttpStatus.NOT_FOUND).send({
          status: 'error',
          message: 'User not found',
        });
      }

      this.auditLogService.log({
        action: 'UPDATE',
        resource: 'user',
        resourceId: virtualId,
        actor: { virtualId: request.user.virtual_id, username: request.user.username, role: request.user.role },
        summary: `Changed password for user virtualId=${virtualId}`,
        ipAddress: request.ip,
      });

      return response.status(HttpStatus.OK).send({
        status: 'success',
        message: 'Password changed successfully',
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to change password',
      });
    }
  }
}
