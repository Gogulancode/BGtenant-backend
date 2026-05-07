import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as request from "supertest";
import * as bcrypt from "bcrypt";
import * as crypto from "crypto";
import { BusinessType, Role } from "@prisma/client";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { TokensService } from "../src/auth/tokens.service";
import { PasswordPolicyService } from "../src/auth/password-policy.service";
import { OnboardingService } from "../src/onboarding/onboarding.service";
import { MfaService } from "../src/auth/mfa.service";
import { JwtAuthGuard } from "../src/common/guards/jwt-auth.guard";
import { ConfigStub, PrismaAuthStub } from "./stubs/auth-test-helpers";

const TEST_JWT_SECRET = "hardening-access-secret";
const TEST_REFRESH_SECRET = "hardening-refresh-secret";

const registerPayload = (overrides: Partial<{ email: string }> = {}) => ({
  name: "New Owner",
  email: overrides.email ?? "owner@example.com",
  password: "Password123!",
  businessType: BusinessType.Startup,
});

describe("Auth flows (e2e)", () => {
  let app: INestApplication;
  let prisma: PrismaAuthStub;
  let activeUser: { userId: string; tenantId: string; role: Role };

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
  } as unknown as MfaService;

  beforeEach(async () => {
    prisma = new PrismaAuthStub();
    activeUser = {
      userId: "user-auth",
      tenantId: "tenant-auth",
      role: Role.TENANT_ADMIN,
    };

    passwordPolicyStub.assertStrong.mockReset();
    onboardingStub.seedNewTenantWorkspace.mockReset();
    onboardingStub.handleInviteAcceptance.mockReset();
    (mfaStub.assertValidLogin as jest.Mock)
      .mockReset()
      .mockResolvedValue(undefined);

    const moduleBuilder = Test.createTestingModule({
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
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.user = activeUser;
          return true;
        },
      });

    const moduleRef: TestingModule = await moduleBuilder.compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers a new tenant admin and seeds onboarding", async () => {
    const payload = registerPayload();

    const response = await request(app.getHttpServer())
      .post("/auth/register")
      .set("User-Agent", "jest")
      .send(payload)
      .expect(201);

    expect(response.body.user).toMatchObject({
      email: payload.email,
      role: Role.TENANT_ADMIN,
      tenantId: expect.any(String),
    });
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(passwordPolicyStub.assertStrong).toHaveBeenCalledWith(
      payload.password,
    );
    expect(onboardingStub.seedNewTenantWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: response.body.user.tenantId }),
    );
    expect(prisma.tenants).toHaveLength(1);
    expect(prisma.users).toHaveLength(1);
  });

  it("rejects duplicate registration attempts", async () => {
    const payload = registerPayload();
    prisma.addUser({ email: payload.email });

    await request(app.getHttpServer())
      .post("/auth/register")
      .send(payload)
      .expect(409);

    expect(passwordPolicyStub.assertStrong).toHaveBeenCalledWith(
      payload.password,
    );
    expect(onboardingStub.seedNewTenantWorkspace).not.toHaveBeenCalled();
  });

  it("logs in an existing user and rotates tokens", async () => {
    const password = "Password123!";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = prisma.addUser({
      email: "tenant@example.com",
      passwordHash,
      role: Role.MANAGER,
    });

    const response = await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password })
      .expect(200);

    expect(response.body.user).toMatchObject({
      id: user.id,
      role: Role.MANAGER,
    });
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(mfaStub.assertValidLogin).toHaveBeenCalledWith(
      expect.objectContaining({ id: user.id, mfaEnabled: false }),
      undefined,
    );
    expect(
      prisma.refreshTokens.filter((token) => token.userId === user.id),
    ).toHaveLength(1);
  });

  it("rejects invalid credentials on login", async () => {
    const passwordHash = await bcrypt.hash("Password123!", 10);
    const user = prisma.addUser({ email: "tenant@example.com", passwordHash });

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password: "WrongPass!" })
      .expect(401);
  });

  it("enforces MFA when enabled", async () => {
    const password = "Password123!";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = prisma.addUser({
      email: "mfa@example.com",
      passwordHash,
      mfaEnabled: true,
      mfaSecret: "secret",
    });

    (mfaStub.assertValidLogin as jest.Mock).mockImplementation(
      async (mfaUser: { mfaEnabled: boolean }, code?: string) => {
        if (mfaUser.mfaEnabled && !code) {
          throw new UnauthorizedException("MFA code required");
        }
      },
    );

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password, mfaCode: "123456" })
      .expect(200);
    expect(mfaStub.assertValidLogin).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: user.id, mfaEnabled: true }),
      "123456",
    );
  });

  it("accepts invitations and provisions the user", async () => {
    const tenant = prisma.addTenant({ id: "tenant-invite", name: "Acme" });
    const invitedUser = prisma.addUser({
      id: "user-invite",
      email: "invitee@example.com",
      tenantId: tenant.id,
      role: Role.STAFF,
    });
    const token = "invite-token";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    prisma.addInvitation({
      userId: invitedUser.id,
      tenantId: tenant.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    const response = await request(app.getHttpServer())
      .post("/auth/accept-invite")
      .send({ token, password: "InvitePass123!" })
      .expect(201);

    expect(response.body.user.id).toBe(invitedUser.id);
    expect(onboardingStub.handleInviteAcceptance).toHaveBeenCalledWith(
      expect.objectContaining({ userId: invitedUser.id, tenantId: tenant.id }),
    );
    const invitation = prisma.invitations[0];
    expect(invitation.acceptedAt).toBeInstanceOf(Date);
  });

  it("rejects expired invitations", async () => {
    const tenant = prisma.addTenant({ id: "tenant-expired" });
    const invitedUser = prisma.addUser({ tenantId: tenant.id });
    const token = "expired-token";
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    prisma.addInvitation({
      userId: invitedUser.id,
      tenantId: tenant.id,
      tokenHash,
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    await request(app.getHttpServer())
      .post("/auth/accept-invite")
      .send({ token, password: "InvitePass123!" })
      .expect(410);
  });

  it("revokes refresh tokens on logout", async () => {
    const password = "Password123!";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = prisma.addUser({
      id: "user-logout",
      passwordHash,
      email: "logout@example.com",
    });

    await request(app.getHttpServer())
      .post("/auth/login")
      .send({ email: user.email, password })
      .expect(200);
    expect(
      prisma.refreshTokens.some(
        (token) => token.userId === user.id && !token.revoked,
      ),
    ).toBe(true);

    activeUser = {
      userId: user.id,
      tenantId: user.tenantId,
      role: Role.TENANT_ADMIN,
    };
    await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", "Bearer fake")
      .expect(200)
      .expect({ message: "Logged out successfully" });

    expect(
      prisma.refreshTokens
        .filter((token) => token.userId === user.id)
        .every((token) => token.revoked),
    ).toBe(true);
  });
});
