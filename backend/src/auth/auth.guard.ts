import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import axios from 'axios';
import { createHash } from 'crypto';
import { Request } from 'express';
import * as jose from 'jose';
import { CmsUser, CmsUserDocument } from 'src/schemas/cms-user.schema';


@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectModel(CmsUser.name) private cmsUserModel: Model<CmsUserDocument>,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.AUTH_BYPASS === 'true') {
      console.warn('[AUTH] AUTH_BYPASS=true — skipping token verification. DO NOT use in production.');
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }
    const token = authHeader.split(' ')[1];
   
    try {
      //Step 1: Correctly Generate Encryption Key
      const secret_key = process.env.JOSE_SECRET || '';
      const hash = createHash('sha256').update(secret_key).digest();

      //Step 2: Decrypt the Token
      const jwtDecryptedToken = await jose.jwtDecrypt(token, hash);

      if (!jwtDecryptedToken.payload.jwtSignedToken) {
        throw new Error('jwtSignedToken not found in decrypted payload');
      }

      //Step 3: Verify the Signed JWT
      const jwtSignedToken = String(jwtDecryptedToken.payload.jwtSignedToken);
      const jwtSigninKey = new TextEncoder().encode(
        process.env.JWT_SIGNIN_PRIVATE_KEY,
      );
      const verifiedToken = await jose.jwtVerify(jwtSignedToken, jwtSigninKey);
     
      // get the token status
      const tokenStatus = await this.checkTokenStatus(verifiedToken.payload.virtual_id);
      if (tokenStatus.serviceUnavailable) {
        // Orchestration is temporarily unreachable — trust the verified JWT rather than logging the user out
        console.warn('[AUTH] Orchestration tokenStatus unavailable — allowing request based on verified JWT');
      } else if (tokenStatus.token == null || tokenStatus.token !== token) {
        throw new UnauthorizedException('User is logged out');
      }
      
      //Step 4: Look up user in cms_users and attach enriched data to request
      const virtualId = verifiedToken.payload.virtual_id;
      const cmsUser = await this.cmsUserModel.findOne({ virtualId, isActive: true }).lean();
      if (!cmsUser) {
        throw new UnauthorizedException('User not found or deactivated');
      }

      (request as any).user = {
        ...verifiedToken.payload,
        virtual_id: virtualId,
        username: cmsUser.username,
        role: cmsUser.role,
      };

      return true;
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // check user status
  async checkTokenStatus(user_id: any): Promise<{ token: string | null; serviceUnavailable?: boolean }> {
    try {
      const url = process.env.ALL_ORC_SERVICE_URL;
      const response = await axios.post(url, {
        user_id: user_id,
      });

      return {
        token: response.data?.result?.token || null,
      };
    } catch (error: any) {
      // Network / timeout error — orchestration is unreachable, not the same as "logged out"
      console.error('Error calling tokenStatus API:', error?.response?.data || error.message);
      return { token: null, serviceUnavailable: true };
    }
  }

}
