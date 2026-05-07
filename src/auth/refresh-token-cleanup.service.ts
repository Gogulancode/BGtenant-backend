import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class RefreshTokenCleanupService {
  private readonly logger = new Logger(RefreshTokenCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Cleanup expired refresh tokens daily at 2 AM
   * This prevents the refresh_tokens table from growing indefinitely
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredTokens() {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired refresh tokens`);
      }

      return { deletedCount: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup expired refresh tokens: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  /**
   * Cleanup tokens for a specific user (useful for account deletion)
   */
  async cleanupUserTokens(userId: string) {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.log(`Cleaned up ${result.count} tokens for user ${userId}`);
      return { deletedCount: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup tokens for user ${userId}: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  /**
   * Cleanup old tokens (older than specified days) regardless of expiry
   * Useful for security compliance requirements
   */
  async cleanupOldTokens(olderThanDays: number = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.prisma.refreshToken.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      if (result.count > 0) {
        this.logger.log(
          `Cleaned up ${result.count} tokens older than ${olderThanDays} days`,
        );
      }

      return { deletedCount: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to cleanup old tokens: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  /**
   * Get token statistics for monitoring
   */
  async getTokenStats() {
    try {
      const [total, expired, uniqueUsers] = await this.prisma.$transaction([
        this.prisma.refreshToken.count(),
        this.prisma.refreshToken.count({
          where: {
            expiresAt: {
              lt: new Date(),
            },
          },
        }),
        this.prisma.refreshToken.findMany({
          select: { userId: true },
          distinct: ["userId"],
        }),
      ]);

      return {
        totalTokens: total,
        expiredTokens: expired,
        activeTokens: total - expired,
        usersWithTokens: uniqueUsers.length,
        averageTokensPerUser:
          uniqueUsers.length > 0
            ? Math.round((total / uniqueUsers.length) * 100) / 100
            : 0,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get token stats: ${error?.message ?? error}`,
      );
      throw error;
    }
  }

  /**
   * Force revoke all tokens for a user (emergency use)
   */
  async revokeAllUserTokens(userId: string, reason?: string) {
    try {
      const result = await this.prisma.refreshToken.deleteMany({
        where: { userId },
      });

      this.logger.warn(
        `Revoked all ${result.count} tokens for user ${userId}${
          reason ? ` - Reason: ${reason}` : ""
        }`,
      );

      return { revokedCount: result.count };
    } catch (error) {
      this.logger.error(
        `Failed to revoke tokens for user ${userId}: ${error?.message ?? error}`,
      );
      throw error;
    }
  }
}
