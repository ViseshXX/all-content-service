import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import * as jose from 'jose';
import axios from 'axios';
import { CmsUser, CmsUserDocument } from 'src/schemas/cms-user.schema';

@Injectable()
export class CmsUserService {
  constructor(
    @InjectModel(CmsUser.name) private cmsUserModel: Model<CmsUserDocument>,
  ) {}

  /**
   * Call orchestration generateVirtualID endpoint with the CMS username.
   * This both registers the user (if new) and returns a JWE token.
   * We decrypt the token to extract the orchestration-generated virtualId.
   */
  private async getVirtualIdFromOrchestration(cmsUsername: string): Promise<number> {
    const orcBaseUrl = (process.env.ALL_ORC_SERVICE_URL || '').replace(/\/tokenStatus$/, '');
    const orcResponse = await axios.post(
      `${orcBaseUrl}/generateVirtualID?username=${encodeURIComponent(cmsUsername)}`,
    );
    const token = orcResponse.data?.result?.token;
    if (!token) {
      throw new Error('Orchestration did not return a token');
    }

    // Decrypt the JWE token to extract the virtualId
    const hash = createHash('sha256').update(process.env.JOSE_SECRET || '').digest();
    const decrypted = await jose.jwtDecrypt(token, hash);
    const signedJwt = String(decrypted.payload.jwtSignedToken);
    const jwtKey = new TextEncoder().encode(process.env.JWT_SIGNIN_PRIVATE_KEY);
    const verified = await jose.jwtVerify(signedJwt, jwtKey);

    return verified.payload.virtual_id as number;
  }

  async create(dto: {
    username: string;
    password: string;
    email?: string;
    role?: string;
  }): Promise<CmsUser> {
    // Get virtualId from orchestration (registers the username there)
    let virtualId: number;
    try {
      virtualId = await this.getVirtualIdFromOrchestration(dto.username);
    } catch (error: any) {
      console.error('[CmsUserService] Failed to register in orchestration:', error?.message);
      throw new Error('Failed to register user in orchestration service');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = new this.cmsUserModel({
      virtualId,
      username: dto.username,
      password: hashedPassword,
      email: dto.email || '',
      role: dto.role || 'curator',
    });
    return user.save();
  }

  async findByVirtualId(virtualId: number): Promise<CmsUserDocument | null> {
    return this.cmsUserModel.findOne({ virtualId, isActive: true }).exec();
  }

  async findByUsername(username: string): Promise<CmsUserDocument | null> {
    return this.cmsUserModel.findOne({ username }).exec();
  }

  async findAll(): Promise<CmsUser[]> {
    return this.cmsUserModel.find({}, { password: 0 }).exec();
  }

  async update(
    virtualId: number,
    dto: { username?: string; email?: string; role?: string },
  ): Promise<CmsUser | null> {
    return this.cmsUserModel
      .findOneAndUpdate({ virtualId }, { $set: dto }, { new: true, projection: { password: 0 } })
      .exec();
  }

  async deactivate(virtualId: number): Promise<CmsUser | null> {
    return this.cmsUserModel
      .findOneAndUpdate({ virtualId }, { $set: { isActive: false } }, { new: true, projection: { password: 0 } })
      .exec();
  }

  async changePassword(virtualId: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const result = await this.cmsUserModel.updateOne(
      { virtualId },
      { $set: { password: hashedPassword } },
    );
    return result.modifiedCount > 0;
  }

  async validatePassword(user: CmsUserDocument, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}
