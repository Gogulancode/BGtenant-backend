import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsBoolean,
  IsArray,
  ValidateNested,
} from "class-validator";
import { Type, Transform } from "class-transformer";

// ============================================================================
// Enums
// ============================================================================

export enum TenantStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum SubscriptionPlan {
  FREE = "FREE",
  STARTER = "STARTER",
  PRO = "PRO",
  ENTERPRISE = "ENTERPRISE",
}

export enum SubscriptionStatus {
  ACTIVE = "ACTIVE",
  TRIAL = "TRIAL",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
}

export enum BillingCycle {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export enum TemplateScope {
  GLOBAL = "GLOBAL",
  DEFAULT = "DEFAULT",
}

export enum TemplateStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum TicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

// ============================================================================
// Pagination
// ============================================================================

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}

export class PaginatedResponseDto<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Dashboard DTOs
// ============================================================================

export class ActivityTrendPointDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  activeTenants: number;
}

export class TenantGrowthPointDto {
  @ApiProperty()
  month: string;

  @ApiProperty()
  count: number;
}

export class TopTenantActivityDto {
  @ApiProperty()
  tenantName: string;

  @ApiProperty()
  activityCount: number;
}

export class DashboardSummaryDto {
  @ApiProperty()
  totalTenants: number;

  @ApiProperty()
  activeTenants: number;

  @ApiProperty()
  inactiveTenants: number;

  @ApiProperty()
  createdLast7Days: number;

  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  totalMetrics: number;

  @ApiProperty()
  totalOutcomes: number;

  @ApiProperty()
  openSupportTickets: number;

  @ApiProperty({ type: [ActivityTrendPointDto] })
  activityTrend: ActivityTrendPointDto[];

  @ApiProperty({ type: [TenantGrowthPointDto] })
  tenantGrowthSeries: TenantGrowthPointDto[];

  @ApiProperty({ type: [TopTenantActivityDto] })
  topTenantsByActivity: TopTenantActivityDto[];
}

// ============================================================================
// Tenant DTOs
// ============================================================================

export class TenantQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ enum: ["ALL", "COMPLETED", "NOT_COMPLETED"] })
  @IsOptional()
  @IsEnum(["ALL", "COMPLETED", "NOT_COMPLETED"])
  onboarding?: "ALL" | "COMPLETED" | "NOT_COMPLETED";
}

export class CreateTenantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: SubscriptionPlan, default: SubscriptionPlan.FREE })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  adminPassword?: string;
}

export class UpdateTenantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiPropertyOptional({ enum: TenantStatus })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;
}

export class UpdateTenantSubscriptionDto {
  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ enum: BillingCycle })
  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  domain?: string;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;

  @ApiProperty({ enum: SubscriptionPlan })
  plan: SubscriptionPlan;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional()
  lastActiveAt?: Date;

  @ApiProperty()
  isOnboarded: boolean;

  @ApiPropertyOptional()
  onboardingStep?: number;

  @ApiPropertyOptional()
  onboardingCompletedAt?: Date;
}

export class TenantStatsDto {
  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  tenantName: string;

  @ApiProperty({ enum: TenantStatus })
  status: TenantStatus;

  @ApiPropertyOptional()
  lastActiveAt?: Date;

  @ApiProperty()
  userCount: number;

  @ApiProperty()
  metricsLogged: number;

  @ApiProperty()
  outcomesCompleted: number;

  @ApiProperty()
  activitiesLogged: number;

  @ApiProperty()
  salesLogged: number;

  @ApiProperty()
  momentumScore: number;

  @ApiProperty()
  streak: number;

  @ApiProperty()
  isOnboarded: boolean;

  @ApiPropertyOptional()
  onboardingStep?: number;
}

// ============================================================================
// Template DTOs
// ============================================================================

export class TemplateMetricSchemaDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ enum: ["number", "percentage", "currency", "boolean"] })
  @IsEnum(["number", "percentage", "currency", "boolean"])
  type: "number" | "percentage" | "currency" | "boolean";

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}

export class TemplateQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TemplateScope })
  @IsOptional()
  @IsEnum(TemplateScope)
  scope?: TemplateScope;

  @ApiPropertyOptional({ enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;
}

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TemplateScope, default: TemplateScope.GLOBAL })
  @IsOptional()
  @IsEnum(TemplateScope)
  scope?: TemplateScope;

  @ApiProperty({ type: [TemplateMetricSchemaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateMetricSchemaDto)
  metricSchema: TemplateMetricSchemaDto[];
}

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TemplateScope })
  @IsOptional()
  @IsEnum(TemplateScope)
  scope?: TemplateScope;

  @ApiPropertyOptional({ enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({ type: [TemplateMetricSchemaDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateMetricSchemaDto)
  metricSchema?: TemplateMetricSchemaDto[];
}

export class TemplateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: TemplateScope })
  scope: TemplateScope;

  @ApiProperty({ enum: TemplateStatus })
  status: TemplateStatus;

  @ApiProperty({ type: [TemplateMetricSchemaDto] })
  metricSchema: TemplateMetricSchemaDto[];

  @ApiPropertyOptional()
  usedByTenantsCount?: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ============================================================================
// Support DTOs
// ============================================================================

export class SupportTicketQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TicketStatus })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ enum: TicketPriority })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignee?: string;
}

export class CreateSupportTicketDto {
  @ApiProperty()
  @IsString()
  tenantId: string;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional({ enum: TicketPriority, default: TicketPriority.MEDIUM })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}

export class UpdateSupportTicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assignee?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class TicketCommentDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ticketId: string;

  @ApiProperty()
  author: string;

  @ApiProperty()
  content: string;

  @ApiProperty()
  createdAt: Date;
}

export class SupportTicketResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  tenantName: string;

  @ApiProperty()
  subject: string;

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus;

  @ApiProperty({ enum: TicketPriority })
  priority: TicketPriority;

  @ApiPropertyOptional()
  assignee?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SupportTicketDetailDto extends SupportTicketResponseDto {
  @ApiProperty()
  description: string;

  @ApiProperty({ type: [TicketCommentDto] })
  comments: TicketCommentDto[];

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Audit DTOs
// ============================================================================

export class AuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class AuditLogEntryDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  tenantId?: string;

  @ApiPropertyOptional()
  tenantName?: string;

  @ApiProperty()
  actor: string;

  @ApiProperty()
  eventType: string;

  @ApiPropertyOptional()
  resource?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty()
  createdAt: Date;
}

export class AuditLogResponseDto extends PaginatedResponseDto<AuditLogEntryDto> {
  @ApiProperty({ type: [AuditLogEntryDto] })
  data: AuditLogEntryDto[];
}

// ============================================================================
// Reports DTOs
// ============================================================================

export class TenantReportQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includeCharts?: boolean;
}

export class TenantReportMetricsDto {
  @ApiProperty()
  totalMetricsLogged: number;

  @ApiProperty()
  outcomesCompleted: number;

  @ApiProperty()
  outcomesTotal: number;

  @ApiProperty()
  completionRate: number;

  @ApiProperty()
  activitiesLogged: number;

  @ApiProperty()
  salesLogged: number;

  @ApiProperty()
  reviewsCompleted: number;
}

export class TenantReportMomentumDto {
  @ApiProperty()
  currentScore: number;

  @ApiProperty()
  previousScore: number;

  @ApiProperty({ enum: ["up", "down", "stable"] })
  trend: "up" | "down" | "stable";

  @ApiProperty()
  streak: number;
}

export class TenantReportEngagementDto {
  @ApiProperty()
  activeDays: number;

  @ApiProperty()
  totalDays: number;

  @ApiProperty()
  engagementRate: number;
}

export class TenantReportSummaryDto {
  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  tenantName: string;

  @ApiProperty()
  period: {
    startDate: string;
    endDate: string;
  };

  @ApiProperty({ type: TenantReportMetricsDto })
  metrics: TenantReportMetricsDto;

  @ApiProperty({ type: TenantReportMomentumDto })
  momentum: TenantReportMomentumDto;

  @ApiProperty({ type: TenantReportEngagementDto })
  engagement: TenantReportEngagementDto;
}
