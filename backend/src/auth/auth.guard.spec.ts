import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import * as jose from 'jose';
import { createHash } from 'crypto';
import { JwtAuthGuard } from './auth.guard';

// Mock external dependencies
jest.mock('axios');
jest.mock('jose');

const mockAxios = axios as jest.Mocked<typeof axios>;
const mockJose = jose as jest.Mocked<typeof jose>;

// Mock createHash
const mockCreateHash = {
  update: jest.fn().mockReturnThis(),
  digest: jest.fn().mockReturnValue(new Uint8Array(32)),
};
jest.spyOn(require('crypto'), 'createHash').mockReturnValue(mockCreateHash as any);

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;

  const mockRequest = {
    headers: {
      authorization: 'Bearer valid-token',
    },
    user: undefined,
  };

  const mockContext = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockRequest),
    }),
  } as unknown as ExecutionContext;

  beforeEach(async () => {
    // Reset environment variables
    process.env.JOSE_SECRET = 'test-secret';
    process.env.JWT_SIGNIN_PRIVATE_KEY = 'test-private-key';

    // Create mock JwtService
    jwtService = {
      sign: jest.fn(),
      verify: jest.fn(),
    } as any;

    // Create guard instance directly
    guard = new JwtAuthGuard(jwtService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('canActivate', () => {
    it('should successfully authenticate a valid token', async () => {
      // Mock successful token decryption
      const mockDecryptedToken = {
        payload: {
          jwtSignedToken: 'signed-jwt-token',
        },
      };

      // Mock successful JWT verification
      const mockVerifiedToken = {
        payload: {
          virtual_id: 'user-123',
          email: 'test@example.com',
        },
      };

      // Mock successful token status check
      mockAxios.post.mockResolvedValue({
        data: {
          result: {
            token: 'valid-token',
          },
        },
      });

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);
      mockJose.jwtVerify.mockResolvedValue(mockVerifiedToken as any);

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(mockVerifiedToken.payload);
    });

    it('should throw UnauthorizedException when authorization header is missing', async () => {
      const requestWithoutAuth = {
        headers: {},
      };
      const contextWithoutAuth = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithoutAuth),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(contextWithoutAuth)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(contextWithoutAuth)).rejects.toThrow(
        'Authorization header missing',
      );
    });

    it('should throw UnauthorizedException when token format is invalid', async () => {
      const requestWithInvalidToken = {
        headers: {
          authorization: 'InvalidFormat token',
        },
      };
      const contextWithInvalidToken = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithInvalidToken),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(contextWithInvalidToken)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token decryption fails', async () => {
      mockJose.jwtDecrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when jwtSignedToken is missing in payload', async () => {
      const mockDecryptedToken = {
        payload: {
          // Missing jwtSignedToken
        },
      };

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when JWT verification fails', async () => {
      const mockDecryptedToken = {
        payload: {
          jwtSignedToken: 'signed-jwt-token',
        },
      };

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);
      mockJose.jwtVerify.mockRejectedValue(new Error('Verification failed'));

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user is logged out (token mismatch)', async () => {
      const mockDecryptedToken = {
        payload: {
          jwtSignedToken: 'signed-jwt-token',
        },
      };

      const mockVerifiedToken = {
        payload: {
          virtual_id: 'user-123',
        },
      };

      // Mock token status check returning different token
      mockAxios.post.mockResolvedValue({
        data: {
          result: {
            token: 'different-token',
          },
        },
      });

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);
      mockJose.jwtVerify.mockResolvedValue(mockVerifiedToken as any);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should throw UnauthorizedException when token status returns null token', async () => {
      const mockDecryptedToken = {
        payload: {
          jwtSignedToken: 'signed-jwt-token',
        },
      };

      const mockVerifiedToken = {
        payload: {
          virtual_id: 'user-123',
        },
      };

      // Mock token status check returning null token
      mockAxios.post.mockResolvedValue({
        data: {
          result: {
            token: null,
          },
        },
      });

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);
      mockJose.jwtVerify.mockResolvedValue(mockVerifiedToken as any);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Invalid or expired token',
      );
    });

    it('should handle missing JOSE_SECRET environment variable', async () => {
      delete process.env.JOSE_SECRET;

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle missing JWT_SIGNIN_PRIVATE_KEY environment variable', async () => {
      delete process.env.JWT_SIGNIN_PRIVATE_KEY;

      const mockDecryptedToken = {
        payload: {
          jwtSignedToken: 'signed-jwt-token',
        },
      };

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('checkTokenStatus', () => {
    it('should return token when API call is successful', async () => {
      const userId = 'user-123';
      const expectedToken = 'valid-token';

      mockAxios.post.mockResolvedValue({
        data: {
          result: {
            token: expectedToken,
          },
        },
      });

      const result = await guard['checkTokenStatus'](userId);

      expect(result).toEqual({ token: expectedToken });
      expect(mockAxios.post).toHaveBeenCalledWith(
        process.env.ALL_ORC_SERVICE_URL,
        { user_id: userId },
      );
    });

    it('should return null token when API call fails', async () => {
      const userId = 'user-123';

      mockAxios.post.mockRejectedValue(new Error('API Error'));

      const result = await guard['checkTokenStatus'](userId);

      expect(result).toEqual({ token: null });
    });

    it('should return null token when API response has no result', async () => {
      const userId = 'user-123';

      mockAxios.post.mockResolvedValue({
        data: {},
      });

      const result = await guard['checkTokenStatus'](userId);

      expect(result).toEqual({ token: null });
    });

    it('should return null token when API response result has no token', async () => {
      const userId = 'user-123';

      mockAxios.post.mockResolvedValue({
        data: {
          result: {},
        },
      });

      const result = await guard['checkTokenStatus'](userId);

      expect(result).toEqual({ token: null });
    });

    it('should handle axios error with response data', async () => {
      const userId = 'user-123';
      const axiosError = {
        response: {
          data: { error: 'API Error' },
        },
        message: 'Network Error',
      };

      mockAxios.post.mockRejectedValue(axiosError);

      const result = await guard['checkTokenStatus'](userId);

      expect(result).toEqual({ token: null });
    });

    it('should handle axios error without response data', async () => {
      const userId = 'user-123';
      const axiosError = {
        message: 'Network Error',
      };

      mockAxios.post.mockRejectedValue(axiosError);

      const result = await guard['checkTokenStatus'](userId);

      expect(result).toEqual({ token: null });
    });
  });

  describe('constructor', () => {
    it('should create guard instance with JwtService dependency', () => {
      expect(guard).toBeDefined();
      expect(guard['jwtService']).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty authorization header', async () => {
      const requestWithEmptyAuth = {
        headers: {
          authorization: '',
        },
      };
      const contextWithEmptyAuth = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithEmptyAuth),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(contextWithEmptyAuth)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle authorization header with only Bearer prefix', async () => {
      const requestWithOnlyBearer = {
        headers: {
          authorization: 'Bearer ',
        },
      };
      const contextWithOnlyBearer = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithOnlyBearer),
        }),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(contextWithOnlyBearer)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle malformed authorization header', async () => {
      const requestWithMalformedAuth = {
        headers: {
          authorization: 'Bearer token extra',
        },
      };
      const contextWithMalformedAuth = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(requestWithMalformedAuth),
        }),
      } as unknown as ExecutionContext;

      // This should still work as it takes the second part after split
      const mockDecryptedToken = {
        payload: {
          jwtSignedToken: 'signed-jwt-token',
        },
      };

      const mockVerifiedToken = {
        payload: {
          virtual_id: 'user-123',
        },
      };

      mockAxios.post.mockResolvedValue({
        data: {
          result: {
            token: 'token',
          },
        },
      });

      mockJose.jwtDecrypt.mockResolvedValue(mockDecryptedToken as any);
      mockJose.jwtVerify.mockResolvedValue(mockVerifiedToken as any);

      const result = await guard.canActivate(contextWithMalformedAuth);
      expect(result).toBe(true);
    });
  });
}); 