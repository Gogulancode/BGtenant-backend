import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import * as crypto from "crypto";

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  tenantId?: string | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  refreshTokenRecordId: string;
  refreshTokenValue: string;
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
   */
  async issueTokens(
    payload: TokenPayload,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPair> {
    // Generate access token (short-lived: 15 minutes)
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get("JWT_SECRET"),
      expiresIn: "15m",
    });

    // Generate refresh token (long-lived: 7 days)
    const refreshTokenValue = this.generateSecureToken();
    const refreshTokenSecret = this.configService.get("JWT_REFRESH_SECRET");

    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, token: refreshTokenValue },
      {
        secret: refreshTokenSecret,
        expiresIn: "7d",
      },
    );

    // Calculate expiry (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // Save refresh token to database
    const createdToken = await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        token: refreshTokenValue,
        expiresAt,
        ipAddress,
        userAgent,
      },
      select: { id: true, token: true },
    });

    return {
      accessToken,
      refreshToken,
      refreshTokenRecordId: createdToken.id,
      refreshTokenValue: createdToken.token,
    };
  }

  /**
   * Validates and rotates refresh token
   * Returns new token pair with user info if valid
   */
  async refreshTokens(
    refreshToken: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<TokenPairWithUser> {
    try {
      // Verify JWT signature
      const refreshTokenSecret = this.configService.get("JWT_REFRESH_SECRET");
      const decoded = this.jwtService.verify(refreshToken, {
        secret: refreshTokenSecret,
      });

      const { sub: userId, token: tokenValue } = decoded;

      // Find token in database
      const storedToken = await this.prisma.refreshToken.findUnique({
        where: { token: tokenValue },
        include: { user: true },
      });

      if (!storedToken) {
        throw new Error("Refresh token not found");
      }

      // Check if token is revoked
      if (storedToken.revoked) {
        throw new Error("Refresh token has been revoked");
      }

      // Check if token is expired
      if (new Date() > storedToken.expiresAt) {
        throw new Error("Refresh token has expired");
      }

      // Check if userId matches
      if (storedToken.userId !== userId) {
        throw new Error("Token user mismatch");
      }

      // Generate new token pair
      const newTokenPair = await this.issueTokens(
        {
          sub: storedToken.user.id,
          email: storedToken.user.email,
          role: storedToken.user.role,
          tenantId: storedToken.user.tenantId,
        },
        ipAddress,
        userAgent,
      );

      // Revoke old token and link to new one
      await this.prisma.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revoked: true,
          replacedByToken: newTokenPair.refreshTokenValue,
        },
      });

      return {
        ...newTokenPair,
        userId: storedToken.user.id,
        email: storedToken.user.email,
        role: storedToken.user.role,
        tenantId: storedToken.user.tenantId,
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
      where: { token },
      data: { revoked: true },
    });
  }

  /**
   * Revokes all refresh tokens for a user
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revoked: false },
      data: { revoked: true },
    });
  }

  /**
   * Cleans up expired tokens (can be run as cron job)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          {
            revoked: true,
            createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        ],
      },
    });
    return result.count;
  }

  /**
   * Generates a cryptographically secure random token
   */
  private generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
