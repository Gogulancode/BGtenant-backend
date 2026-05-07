import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { TokensService } from "./tokens.service";

describe("TokensService", () => {
  const jwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  } as unknown as jest.Mocked<JwtService>;

  const configService = {
    get: jest.fn((key: string) => {
      if (key === "JWT_SECRET") return "access-secret";
      if (key === "JWT_REFRESH_SECRET") return "refresh-secret";
      return undefined;
    }),
  } as unknown as ConfigService;

  const prisma = {
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  } as any;

  let service: TokensService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokensService(jwtService, configService, prisma);
  });

  describe("issueTokens", () => {
    it("persists refresh token metadata and returns pair", async () => {
      (jwtService.sign as jest.Mock)
        .mockReturnValueOnce("access-jwt")
        .mockReturnValueOnce("refresh-jwt");

      prisma.refreshToken.create.mockResolvedValue({
        id: "rt-1",
        token: "stored-token",
      });

      const result = await service.issueTokens(
        {
          sub: "user-1",
          email: "user@example.com",
          role: "TENANT_ADMIN",
          tenantId: "tenant-1",
        },
        "10.0.0.1",
        "Chrome",
      );

      expect(jwtService.sign).toHaveBeenNthCalledWith(
        1,
        {
          sub: "user-1",
          email: "user@example.com",
          role: "TENANT_ADMIN",
          tenantId: "tenant-1",
        },
        { secret: "access-secret", expiresIn: "15m" },
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            ipAddress: "10.0.0.1",
            userAgent: "Chrome",
          }),
          select: { id: true, token: true },
        }),
      );
      expect(result).toEqual({
        accessToken: "access-jwt",
        refreshToken: "refresh-jwt",
        refreshTokenRecordId: "rt-1",
        refreshTokenValue: "stored-token",
      });
    });
  });

  describe("refreshTokens", () => {
    const existingToken = {
      id: "token-1",
      userId: "user-1",
      token: "stored-refresh",
      revoked: false,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      user: {
        id: "user-1",
        email: "user@example.com",
        role: "TENANT_ADMIN",
        tenantId: "tenant-1",
      },
    };

    it("rotates refresh tokens and links previous token", async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: existingToken.userId,
        token: existingToken.token,
      });
      prisma.refreshToken.findUnique.mockResolvedValue(existingToken);

      const rotationPair = {
        accessToken: "new-access",
        refreshToken: "new-refresh",
        refreshTokenRecordId: "rt-2",
        refreshTokenValue: "stored-token-2",
      };
      const issueSpy = jest
        .spyOn(service, "issueTokens")
        .mockResolvedValue(rotationPair);

      const result = await service.refreshTokens("signed-refresh");

      expect(issueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: existingToken.user.id,
          email: existingToken.user.email,
          role: existingToken.user.role,
          tenantId: existingToken.user.tenantId,
        }),
        undefined,
        undefined,
      );
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: existingToken.id },
        data: { revoked: true, replacedByToken: "stored-token-2" },
      });
      expect(result).toEqual({
        ...rotationPair,
        userId: existingToken.user.id,
        email: existingToken.user.email,
        role: existingToken.user.role,
        tenantId: existingToken.user.tenantId,
      });
    });

    it("rejects refresh attempts for revoked tokens", async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: existingToken.userId,
        token: existingToken.token,
      });
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...existingToken,
        revoked: true,
      });

      await expect(service.refreshTokens("signed-refresh")).rejects.toThrow(
        "Token refresh failed: Refresh token has been revoked",
      );
    });

    it("prevents overlapping refresh attempts once rotation occurs", async () => {
      (jwtService.verify as jest.Mock).mockReturnValue({
        sub: existingToken.userId,
        token: existingToken.token,
      });

      prisma.refreshToken.findUnique
        .mockResolvedValueOnce(existingToken)
        .mockResolvedValueOnce({ ...existingToken, revoked: true });

      const issueSpy = jest.spyOn(service, "issueTokens").mockResolvedValue({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        refreshTokenRecordId: "rt-2",
        refreshTokenValue: "stored-token-2",
      });

      await service.refreshTokens("signed-refresh");

      await expect(service.refreshTokens("signed-refresh")).rejects.toThrow(
        "Token refresh failed: Refresh token has been revoked",
      );

      expect(issueSpy).toHaveBeenCalledTimes(1);
      expect(prisma.refreshToken.update).toHaveBeenCalledTimes(1);
    });
  });
});
