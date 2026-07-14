import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/auth.guard';
import { RolesGuard, Roles } from 'src/auth/roles.guard';
import { AuditLogService } from 'src/services/audit-log.service';

@ApiTags('audit-logs')
@ApiBearerAuth('access-token')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @ApiOperation({ summary: 'List audit logs with filters (admin only)' })
  @ApiQuery({ name: 'userId', required: false, type: Number })
  @ApiQuery({ name: 'action', required: false, enum: ['CREATE', 'UPDATE', 'DELETE', 'BULK_UPLOAD', 'LOGIN', 'LOGOUT'] })
  @ApiQuery({ name: 'resource', required: false, enum: ['content', 'collection', 'multilingual', 'bulk_upload', 'user', 'auth'] })
  @ApiQuery({ name: 'startDate', required: false, type: String, example: '2026-01-01' })
  @ApiQuery({ name: 'endDate', required: false, type: String, example: '2026-12-31' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @Get()
  async listAuditLogs(
    @Res() response: FastifyReply,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('resource') resource?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    try {
      const result = await this.auditLogService.findAll({
        userId: userId ? Number(userId) : undefined,
        action,
        resource,
        startDate,
        endDate,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      return response.status(HttpStatus.OK).send({
        status: 'success',
        ...result,
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to fetch audit logs',
      });
    }
  }

  @ApiOperation({ summary: 'Get audit history for a specific resource (admin only)' })
  @Get(':resourceType/:resourceId')
  async getResourceHistory(
    @Res() response: FastifyReply,
    @Param('resourceType') resourceType: string,
    @Param('resourceId') resourceId: string,
  ) {
    try {
      const data = await this.auditLogService.findByResource(resourceType, resourceId);
      return response.status(HttpStatus.OK).send({
        status: 'success',
        data,
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to fetch resource history',
      });
    }
  }
}
