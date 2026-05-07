import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import * as crypto from "crypto";

/**
 * JWT Payload structure for multi-tenant SaaS
 */
export interface TokenPayload {
  sub: string; // User ID
  email: string;
  role: string;
  tenantId?: string | null; // Tenant context for scoped operations
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface TokenPairWithUser extends TokenPair {
  userId: string;
  email: string;
  role: string;
  tenantId?: string | null;
}

@Injectable()
export class TokensService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Issues a new access + refresh token pair
   * Saves refresh token to database with metadata
   *
   * @param payload - User identification payload (must include tenantId for multi-tenant)
   * @param ipAddress - Client IP for security tracking
   * @param userAgent - Client user agent for session tracking
   */
  async issueTokens(
    payload: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    // Generate access token (short-lived: 30 minutes)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: "30m",
    });

    // Generate refresh token (long-lived: 30 days)
    const refreshTokenValue = this.generateSecureToken();
    const refreshTokenSecret = this.configService.get("JWT_REFRESH_SECRET");

    const refreshToken = this.jwtService.sign(
      {
        sub: payload.sub,
        token: refreshTokenValue,
        role: payload.role,
        tenantId: payload.tenantId,
      },
      {
        secret: refreshTokenSecret,
        expiresIn: "30d",
      },
    );

    // Calculate expiry (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Save refresh token to database with metadata
    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        token: refreshTokenValue,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  /**
   * Validates and rotates refresh token
   * Implements token rotation security pattern
   *
   * @param refreshToken - The refresh token to validate and rotate
   * @param ipAddress - Client IP for new token
   * @param userAgent - Client user agent for new token
   * @returns New token pair with user info
   */
  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPairWithUser> {
    try {
      // 1. Verify JWT signature
      const refreshTokenSecret = this.configService.get("JWT_REFRESH_SECRET");
      const decoded = this.jwtService.verify(refreshToken, {
        secret: refreshTokenSecret,
      });

      const { sub: userId, token: tokenValue } = decoded;

      // 2. Find token in database and validate
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: tokenValue },
        include: { user: true },
      });

      if (!storedToken) {
        throw new Error("Refresh token not found");
      }

      // 3. Check if token is revoked
      if (storedToken.revoked) {
        throw new Error("Refresh token has been revoked");
      }

      // 4. Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        throw new Error("Refresh token has expired");
      }

      // 5. Generate new token pair
      const newTokenPair = await this.issueTokens(
        {
          sub: userId,
          email: storedToken.user.email,
          role: storedToken.user.role,
          tenantId: storedToken.user.tenantId,
        },
        ipAddress,
        userAgent,
      );

      // 6. Revoke old token and mark replacement (Token Rotation)
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revoked: true,
          replacedByToken: newTokenPair.refresh_token.substring(0, 50), // Store first 50 chars for reference
        },
      });

      return {
        userId,
        email: storedToken.user.email,
        role: storedToken.user.role,
        tenantId: storedToken.user.tenantId,
        ...newTokenPair,
      };
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Revokes a specific refresh token
   */
  async revokeToken(token: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { token, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Revokes all refresh tokens for a user (logout all devices)
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Cleanup expired and revoked tokens (scheduled job)
   */
  async cleanupTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            revoked: true,
            createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
          }, // 90 days old
        ],
      },
    });

    return result.count;
  }

  /**
   * Generate a cryptographically secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(64).toString("hex");
  }
}
