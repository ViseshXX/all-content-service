import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from 'src/schemas/audit-log.schema';

export interface AuditEntry {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'BULK_UPLOAD' | 'LOGIN' | 'LOGOUT';
  resource: 'content' | 'collection' | 'multilingual' | 'bulk_upload' | 'user' | 'auth';
  resourceId?: string;
  resourceName?: string;
  actor: { virtualId: number; username: string; role: string };
  changes?: Record<string, { from: any; to: any }>;
  summary?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  /** Fire-and-forget audit log — never blocks the main operation. */
  log(entry: AuditEntry): void {
    this.auditLogModel.create(entry).catch((err) => {
      console.error('[AuditLog] Failed to write audit entry:', err?.message);
    });
  }

  async findAll(filters: {
    userId?: number;
    action?: string;
    resource?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLog[]; total: number; page: number; limit: number }> {
    const query: any = {};

    if (filters.userId) query['actor.virtualId'] = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.resource) query.resource = filters.resource;
    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
      if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.auditLogModel.countDocuments(query).exec(),
    ]);

    return { data: data as AuditLog[], total, page, limit };
  }

  async findByResource(
    resource: string,
    resourceId: string,
  ): Promise<AuditLog[]> {
    return this.auditLogModel
      .find({ resource, resourceId })
      .sort({ timestamp: -1 })
      .lean()
      .exec() as Promise<AuditLog[]>;
  }
}
