import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as request from "supertest";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { TokensService, TokenPayload } from "../src/auth/tokens.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { PasswordPolicyService } from "../src/auth/password-policy.service";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { MfaService } from "../src/auth/mfa.service";
import {
  ConfigStub,
  PrismaAuthStub,
  RefreshTokenRecord,
  UserRecord,
} from "./stubs/auth-test-helpers";

const TEST_JWT_SECRET = "hardening-access-secret";
const TEST_REFRESH_SECRET = "hardening-refresh-secret";

describe("Auth refresh endpoint (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaAuthStub;
  let tokensService: TokensService;
  let jwtService: JwtService;
  let testUser: UserRecord;

  const passwordPolicyStub = { assertStrong: jest.fn() };
  const onboardingStub = {
    seedNewTenantWorkspace: jest.fn(),
    handleInviteAcceptance: jest.fn(),
  };
  const mfaStub = {
    assertValidLogin: jest.fn(),
    createEnrollment: jest.fn(),
    enableMfa: jest.fn(),
    disableMfa: jest.fn(),
  };

  beforeEach(async () => {
    prisma = new PrismaAuthStub();
    testUser = prisma.addUser({
      id: "user-refresh",
      email: "tenant@example.com",
      tenantId: "tenant-one",
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: TEST_JWT_SECRET })],
      controllers: [AuthController],
      providers: [
        AuthService,
        TokensService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: new ConfigStub(TEST_JWT_SECRET, TEST_REFRESH_SECRET),
        },
        { provide: PasswordPolicyService, useValue: passwordPolicyStub },
        { provide: OnboardingService, useValue: onboardingStub },
        { provide: MfaService, useValue: mfaStub },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    tokensService = moduleRef.get(TokensService);
    jwtService = moduleRef.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const basePayload = (): TokenPayload => ({
    sub: testUser.id,
    email: testUser.email,
    role: testUser.role,
    tenantId: testUser.tenantId,
  });

  const seedRefreshToken = async (
    overrides?: Partial<RefreshTokenRecord>,
    payloadOverrides?: Partial<TokenPayload>,
  ) => {
    const pair = await tokensService.issueTokens(
      { ...basePayload(), ...payloadOverrides },
      "10.0.0.1",
      "jest",
    );
    const record = prisma.refreshTokens[prisma.refreshTokens.length - 1];
    if (overrides) {
      Object.assign(record, overrides);
    }
    return { pair, record };
  };

  const decodeRefresh = (token: string) =>
    jwtService.verify(token, { secret: TEST_REFRESH_SECRET }) as {
      sub: string;
      token: string;
    };

  it("rotates tokens successfully when refresh token is valid", async () => {
    const { pair, record } = await seedRefreshToken();
    const initialCount = prisma.refreshTokens.length;

    const response = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: pair.refreshToken })
      .expect(200);

    expect(response.body.user.id).toBe(testUser.id);
    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
    expect(response.body.refresh_token).not.toEqual(pair.refreshToken);

      const oldRecord = prisma.refreshTokens.find(
        (token) => token.id === record.id,
      );
      expect(oldRecord?.revoked).toBe(true);
      const decoded = decodeRefresh(response.body.refresh_token);
      expect(oldRecord?.replacedByToken).toBe(decoded.token);
      expect(prisma.refreshTokens.length).toBe(initialCount + 1);
    const newRecord = prisma.refreshTokens.find(
      (token) => token.token === decoded.token,
    );
    expect(newRecord).toBeDefined();
    expect(newRecord?.revoked).toBe(false);
  });

  it("rejects expired refresh tokens", async () => {
    const { pair, record } = await seedRefreshToken({
      expiresAt: new Date(Date.now() - 60 * 1000),
    });
    const beforeCount = prisma.refreshTokens.length;

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: pair.refreshToken })
      .expect(401);

    expect(prisma.refreshTokens.length).toBe(beforeCount);
    expect(record.revoked).toBe(false);
    expect(record.replacedByToken ?? null).toBeNull();
  });

  it("rejects revoked refresh tokens", async () => {
    const { pair, record } = await seedRefreshToken({ revoked: true });
    const beforeCount = prisma.refreshTokens.length;

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: pair.refreshToken })
      .expect(401);

    expect(prisma.refreshTokens.length).toBe(beforeCount);
    expect(record.replacedByToken ?? null).toBeNull();
  });

  it("rejects refresh tokens that do not exist", async () => {
    const beforeCount = prisma.refreshTokens.length;
    const ghostToken = jwtService.sign(
      { sub: testUser.id, token: "non-existent" },
      { secret: TEST_REFRESH_SECRET, expiresIn: "7d" },
    );

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: ghostToken })
      .expect(401);

    expect(prisma.refreshTokens.length).toBe(beforeCount);
  });

  it("rejects tampered refresh tokens with mismatched user", async () => {
    const otherUser = prisma.addUser({
      id: "user-other",
      tenantId: "tenant-two",
      email: "other@example.com",
    });
    const { record } = await seedRefreshToken();
    const beforeCount = prisma.refreshTokens.length;

    const tampered = jwtService.sign(
      { sub: otherUser.id, token: record.token },
      { secret: TEST_REFRESH_SECRET, expiresIn: "7d" },
    );

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: tampered })
      .expect(401);

    expect(prisma.refreshTokens.length).toBe(beforeCount);
    const stored = prisma.refreshTokens.find((token) => token.id === record.id);
    expect(stored?.revoked).toBe(false);
    expect(stored?.replacedByToken ?? null).toBeNull();
  });

  it("returns 400 when refresh token is missing", async () => {
    const beforeCount = prisma.refreshTokens.length;

    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({})
      .expect(400);

    expect(prisma.refreshTokens.length).toBe(beforeCount);
  });
});
