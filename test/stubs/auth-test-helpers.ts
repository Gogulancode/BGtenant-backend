import { BusinessType, Role, TenantType } from "@prisma/client";

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  businessType: BusinessType;
  role: Role;
  tenantId: string;
  mfaEnabled: boolean;
  mfaSecret?: string | null;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date;
  revoked: boolean;
  createdAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  replacedByToken?: string | null;
};

export type TenantRecord = {
  id: string;
  name: string;
  type: TenantType;
  slug: string;
  createdAt: Date;
};

export type InvitationRecord = {
  id: string;
  tokenHash: string;
  userId: string;
  tenantId: string;
  expiresAt: Date;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
};

export class PrismaAuthStub {
  private userSeq = 0;
  private tenantSeq = 0;
  private refreshSeq = 0;
  private inviteSeq = 0;

  users: UserRecord[] = [];
  refreshTokens: RefreshTokenRecord[] = [];
  tenants: TenantRecord[] = [];
  invitations: InvitationRecord[] = [];

  addTenant(partial: Partial<TenantRecord> = {}): TenantRecord {
    const record: TenantRecord = {
      id: partial.id ?? `tenant-${++this.tenantSeq}`,
      name: partial.name ?? `Tenant ${this.tenantSeq}`,
      type: partial.type ?? TenantType.COMPANY,
      slug: partial.slug ?? `tenant-${this.tenantSeq}`,
      createdAt: partial.createdAt ?? new Date(),
    };
    this.tenants.push(record);
    return record;
  }

  addUser(partial: Partial<UserRecord> = {}): UserRecord {
    const tenantId =
      partial.tenantId ?? this.tenants[0]?.id ?? this.addTenant().id;
    const record: UserRecord = {
      id: partial.id ?? `user-${++this.userSeq}`,
      name: partial.name ?? "Test User",
      email: partial.email ?? `user${this.userSeq}@example.com`,
      passwordHash: partial.passwordHash ?? "hash",
      businessType: partial.businessType ?? BusinessType.Startup,
      role: partial.role ?? Role.TENANT_ADMIN,
      tenantId,
      mfaEnabled: partial.mfaEnabled ?? false,
      mfaSecret: partial.mfaSecret ?? null,
    };
    this.users.push(record);
    return record;
  }

  addInvitation(partial: Partial<InvitationRecord> = {}): InvitationRecord {
    if (!partial.userId) {
      throw new Error("Invitation requires userId");
    }
    const record: InvitationRecord = {
      id: partial.id ?? `invite-${++this.inviteSeq}`,
      tokenHash: partial.tokenHash ?? `token-hash-${this.inviteSeq}`,
      userId: partial.userId,
      tenantId:
        partial.tenantId ??
        this.users.find((u) => u.id === partial.userId)?.tenantId ??
        this.addTenant().id,
      expiresAt: partial.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
      acceptedAt: partial.acceptedAt ?? null,
      revokedAt: partial.revokedAt ?? null,
    };
    this.invitations.push(record);
    return record;
  }

  private applySelect<T extends Record<string, any>>(
    record: T,
    select?: Record<string, boolean>,
  ) {
    if (!select) {
      return { ...record };
    }
    return Object.entries(select).reduce((acc, [key, enabled]) => {
      if (enabled && key in record) {
        return { ...acc, [key]: (record as any)[key] };
      }
      return acc;
    }, {} as Partial<T>);
  }

  private matchesWhere(record: any, where: Record<string, any> = {}) {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) {
        return true;
      }
      return (record as any)[key] === value;
    });
  }

  user = {
    findUnique: async ({ where, select }: any) => {
      const record = this.users.find((user) => this.matchesWhere(user, where));
      return record ? this.applySelect(record, select) : null;
    },
    create: async ({ data, select }: any) => {
      const record = this.addUser({ ...data });
      return this.applySelect(record, select);
    },
    update: async ({ where, data, select }: any) => {
      const record = this.users.find((user) => this.matchesWhere(user, where));
      if (!record) {
        throw new Error("User not found");
      }
      Object.assign(record, data);
      return this.applySelect(record, select);
    },
    findFirst: async ({ where, select }: any) => {
      const record = this.users.find((user) => this.matchesWhere(user, where));
      return record ? this.applySelect(record, select) : null;
    },
  };

  tenant = {
    create: async ({ data }: any) => {
      return this.addTenant(data);
    },
    findUnique: async ({ where, select }: any) => {
      const record = this.tenants.find((tenant) =>
        this.matchesWhere(tenant, where),
      );
      return record ? this.applySelect(record, select) : null;
    },
  };

  refreshToken = {
    create: async ({ data }: any) => {
      const record: RefreshTokenRecord = {
        id: data.id ?? `rt-${++this.refreshSeq}`,
        userId: data.userId,
        token: data.token,
        expiresAt: data.expiresAt,
        revoked: data.revoked ?? false,
        createdAt: data.createdAt ?? new Date(),
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        replacedByToken: data.replacedByToken ?? null,
      };
      this.refreshTokens.push(record);
      return record;
    },
    findUnique: async ({ where, include }: any) => {
      const record = this.refreshTokens.find(
        (token) => token.token === where.token,
      );
      if (!record) {
        return null;
      }
      if (include?.user) {
        const user = this.users.find((u) => u.id === record.userId) ?? null;
        return { ...record, user };
      }
      return { ...record };
    },
    update: async ({ where, data }: any) => {
      const token = this.refreshTokens.find((item) => item.id === where.id);
      if (!token) {
        throw new Error("Refresh token not found");
      }
      Object.assign(token, data);
      return token;
    },
    updateMany: async ({ where, data }: any) => {
      let count = 0;
      this.refreshTokens = this.refreshTokens.map((token) => {
        const matches = this.matchesWhere(token, where);
        if (matches) {
          count += 1;
          return { ...token, ...data };
        }
        return token;
      });
      return { count };
    },
    deleteMany: async ({ where }: any = {}) => {
      const before = this.refreshTokens.length;
      this.refreshTokens = this.refreshTokens.filter(
        (token) => !this.matchesWhere(token, where),
      );
      return { count: before - this.refreshTokens.length };
    },
  };

  invitation = {
    findUnique: async ({ where, include }: any) => {
      const record = this.invitations.find(
        (invite) => invite.tokenHash === where.tokenHash,
      );
      if (!record) {
        return null;
      }
      const result: any = { ...record };
      if (include?.user) {
        result.user = this.users.find((u) => u.id === record.userId) ?? null;
      }
      if (include?.tenant) {
        const tenant = this.tenants.find((t) => t.id === record.tenantId);
        result.tenant = tenant
          ? this.applySelect(tenant, include.tenant.select)
          : null;
      }
      return result;
    },
    update: async ({ where, data }: any) => {
      const record = this.invitations.find((invite) => invite.id === where.id);
      if (!record) {
        throw new Error("Invitation not found");
      }
      Object.assign(record, data);
      return record;
    },
  };

  $transaction = async <T>(operations: Array<Promise<T>>) =>
    Promise.all(operations);
}

export class ConfigStub {
  constructor(
    private readonly accessSecret = "hardening-access-secret",
    private readonly refreshSecret = "hardening-refresh-secret",
  ) {}

  get(key: string) {
    if (key === "JWT_SECRET") {
      return this.accessSecret;
    }
    if (key === "JWT_REFRESH_SECRET") {
      return this.refreshSecret;
    }
    return undefined;
  }
}
