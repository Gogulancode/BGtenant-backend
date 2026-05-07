import { Injectable, Logger } from "@nestjs/common";

export interface InviteEmailPayload {
  email: string;
  inviteLink: string;
  tenantName: string;
  inviterName: string;
  role: string;
  expiresAt: Date;
}

export interface ReportDigestPayload {
  tenantName: string;
  recipientEmail: string;
  recipientName: string;
  summary: {
    users: number;
    metrics: number;
    outcomes: number;
    activities: number;
  };
}

export interface WeeklyExecutiveDigestPayload {
  tenantName: string;
  recipientEmail: string;
  recipientName: string;
  windowStart: string;
  kpis: {
    outcomesCompleted: number;
    outcomesPlanned: number;
    avgMomentum: number;
    activeUsers: number;
    openActivities: number;
    reviewsSubmitted: number;
    flagDistribution: Record<string, number>;
  };
}

export interface SystemAlertPayload {
  subject: string;
  body: string;
  severity?: "info" | "warning" | "critical";
  metadata?: Record<string, unknown>;
}

export interface OnboardingEmailPayload {
  tenantName: string;
  recipientEmail: string;
  recipientName: string;
  checklist: string[];
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendTenantInvite(payload: InviteEmailPayload) {
    this.logger.log(
      `Sending invite to ${payload.email} for tenant ${payload.tenantName} role ${payload.role}. Link: ${payload.inviteLink} (expires ${payload.expiresAt.toISOString()})`,
    );
  }

  async sendReportDigest(payload: ReportDigestPayload) {
    this.logger.log(
      `Sending daily digest to ${payload.recipientEmail} for ${payload.tenantName}: users=${payload.summary.users}, metrics=${payload.summary.metrics}, outcomes=${payload.summary.outcomes}, activities=${payload.summary.activities}`,
    );
  }

  async sendWeeklyExecutiveDigest(payload: WeeklyExecutiveDigestPayload) {
    this.logger.log(
      `Sending weekly executive digest to ${payload.recipientEmail} for ${payload.tenantName} (week starting ${payload.windowStart}) KPIs=${JSON.stringify(payload.kpis)}`,
    );
  }

  async sendSystemAlert(payload: SystemAlertPayload) {
    const severity = payload.severity ?? "info";
    this.logger.warn(
      `[ALERT:${severity}] ${payload.subject} - ${payload.body} ${payload.metadata ? JSON.stringify(payload.metadata) : ""}`,
    );
  }

  async sendOnboardingChecklistEmail(payload: OnboardingEmailPayload) {
    this.logger.log(
      `Sending onboarding checklist to ${payload.recipientEmail} for ${payload.tenantName}: steps=${payload.checklist.join(" | ")}`,
    );
  }
}
