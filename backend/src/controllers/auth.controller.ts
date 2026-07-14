import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import axios from 'axios';
import { createHash } from 'crypto';
import * as jose from 'jose';
import { CmsUserService } from 'src/services/cms-user.service';
import { AuditLogService } from 'src/services/audit-log.service';
import { JwtAuthGuard } from 'src/auth/auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly cmsUserService: CmsUserService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @ApiOperation({ summary: 'Login with username and password' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['username', 'password'],
      properties: {
        username: { type: 'string', example: 'admin' },
        password: { type: 'string', example: 'password123' },
      },
    },
  })
  @Post('login')
  async login(
    @Req() request: FastifyRequest,
    @Res() response: FastifyReply,
    @Body() body: { username: string; password: string },
  ) {
    try {
      const { username, password } = body;
      if (!username || !password) {
        return response.status(HttpStatus.BAD_REQUEST).send({
          status: 'error',
          message: 'Username and password are required',
        });
      }

      const user = await this.cmsUserService.findByUsername(username);
      if (!user) {
        return response.status(HttpStatus.UNAUTHORIZED).send({
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      if (!user.isActive) {
        return response.status(HttpStatus.UNAUTHORIZED).send({
          status: 'error',
          message: 'Account is deactivated. Contact an administrator.',
        });
      }

      const isPasswordValid = await this.cmsUserService.validatePassword(user, password);
      if (!isPasswordValid) {
        return response.status(HttpStatus.UNAUTHORIZED).send({
          status: 'error',
          message: 'Invalid username or password',
        });
      }

      // Call orchestration service to generate JWE token (using CMS username, not virtualId)
      const orcBaseUrl = (process.env.ALL_ORC_SERVICE_URL || '').replace(/\/tokenStatus$/, '');
      const orcResponse = await axios.post(
        `${orcBaseUrl}/generateVirtualID?username=${encodeURIComponent(user.username)}`,
      );
      const token = orcResponse.data?.result?.token;

      if (!token) {
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
          status: 'error',
          message: 'Failed to generate authentication token',
        });
      }

      // Audit log
      this.auditLogService.log({
        action: 'LOGIN',
        resource: 'auth',
        actor: { virtualId: user.virtualId, username: user.username, role: user.role },
        summary: `User '${user.username}' logged in`,
        ipAddress: request.ip,
      });

      return response.status(HttpStatus.OK).send({
        status: 'success',
        data: {
          token,
          user: {
            virtualId: user.virtualId,
            username: user.username,
            role: user.role,
            email: user.email,
          },
        },
      });
    } catch (error: any) {
      console.error('[AuthController] Login error:', error?.message);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Login failed. Please try again.',
      });
    }
  }

  @ApiOperation({ summary: 'Refresh an expired token — returns a new JWE token from ORC' })
  @ApiBearerAuth('access-token')
  @Post('refresh')
  async refresh(@Req() request: FastifyRequest, @Res() response: FastifyReply) {
    const authHeader = request.headers.authorization as string;
    const token = authHeader?.split(' ')[1];
    if (!token) {
      return response.status(HttpStatus.UNAUTHORIZED).send({ status: 'error', message: 'No token provided' });
    }

    try {
      const hash = new Uint8Array(createHash('sha256').update(process.env.JOSE_SECRET || '').digest());

      // Decrypt even if the token expired recently (up to 2 hours ago)
      const { payload: outerPayload } = await jose.jwtDecrypt(token, hash, { clockTolerance: '2h' });
      if (!outerPayload.jwtSignedToken) {
        return response.status(HttpStatus.UNAUTHORIZED).send({ status: 'error', message: 'Malformed token' });
      }

      // Verify the inner signed JWT — same 2-hour tolerance
      const jwtSigninKey = new TextEncoder().encode(process.env.JWT_SIGNIN_PRIVATE_KEY);
      const { payload: innerPayload } = await jose.jwtVerify(
        String(outerPayload.jwtSignedToken),
        jwtSigninKey,
        { clockTolerance: '2h' },
      );

      const virtualId = innerPayload.virtual_id as number;

      const cmsUser = await this.cmsUserService.findByVirtualId(virtualId);
      if (!cmsUser || !cmsUser.isActive) {
        return response.status(HttpStatus.UNAUTHORIZED).send({ status: 'error', message: 'User not found or deactivated' });
      }

      // Ask ORC for a fresh token for this user
      const orcBaseUrl = (process.env.ALL_ORC_SERVICE_URL || '').replace(/\/tokenStatus$/, '');
      const orcResponse = await axios.post(
        `${orcBaseUrl}/generateVirtualID?username=${encodeURIComponent(cmsUser.username)}`,
      );
      const newToken = orcResponse.data?.result?.token;
      if (!newToken) {
        return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({ status: 'error', message: 'Failed to refresh session' });
      }

      return response.status(HttpStatus.OK).send({ status: 'success', data: { token: newToken } });
    } catch (err: any) {
      console.error('[AuthController] Refresh error:', err?.message);
      return response.status(HttpStatus.UNAUTHORIZED).send({ status: 'error', message: 'Token cannot be refreshed — please log in again' });
    }
  }

  @ApiOperation({ summary: 'Logout — invalidates the current token' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() request: any, @Res() response: FastifyReply) {
    try {
      const user = request.user;
      const orcBaseUrl = (process.env.ALL_ORC_SERVICE_URL || '').replace(/\/tokenStatus$/, '');
      const token = request.headers.authorization?.split(' ')[1];

      await axios.post(`${orcBaseUrl}/logout`, { token });

      this.auditLogService.log({
        action: 'LOGOUT',
        resource: 'auth',
        actor: { virtualId: user.virtual_id, username: user.username, role: user.role },
        summary: `User '${user.username}' logged out`,
        ipAddress: request.ip,
      });

      return response.status(HttpStatus.OK).send({
        status: 'success',
        message: 'Logged out successfully',
      });
    } catch (error: any) {
      console.error('[AuthController] Logout error:', error?.message);
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Logout failed',
      });
    }
  }

  @ApiOperation({ summary: 'Get current user profile' })
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() request: any, @Res() response: FastifyReply) {
    try {
      const user = request.user;
      return response.status(HttpStatus.OK).send({
        status: 'success',
        data: {
          virtualId: user.virtual_id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (error: any) {
      return response.status(HttpStatus.INTERNAL_SERVER_ERROR).send({
        status: 'error',
        message: 'Failed to fetch user profile',
      });
    }
  }
}
