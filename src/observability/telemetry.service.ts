import { Injectable, Logger } from "@nestjs/common";
import { EmailService } from "../notifications/email.service";

export interface JobTelemetrySnapshot {
  job: string;
  successCount: number;
  failureCount: number;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastMetadata?: Record<string, unknown>;
  lastError?: string;
}

interface JobTelemetryInternal {
  successCount: number;
  failureCount: number;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  lastMetadata?: Record<string, unknown>;
  lastError?: string;
}

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly jobStats = new Map<string, JobTelemetryInternal>();

  constructor(private readonly emailService: EmailService) {}

  async recordJobSuccess(job: string, metadata: Record<string, unknown> = {}) {
    const entry = this.getOrCreate(job);
    entry.successCount += 1;
    entry.lastSuccessAt = new Date();
    entry.lastMetadata = this.cloneMetadata(metadata);
    this.logger.log(`[JOB:${job}] success ${JSON.stringify(metadata)}`);
  }

  async recordJobFailure(
    job: string,
    error: unknown,
    metadata: Record<string, unknown> = {},
  ) {
    const entry = this.getOrCreate(job);
    const message =
      error instanceof Error ? error.message : (error as string | undefined);

    entry.failureCount += 1;
    entry.lastFailureAt = new Date();
    entry.lastMetadata = this.cloneMetadata(metadata);
    entry.lastError = message;

    this.logger.error(
      `[JOB:${job}] failure ${message ?? "unknown error"}`,
      error instanceof Error ? error.stack : undefined,
    );

    await this.emailService.sendSystemAlert({
      subject: `Job ${job} failed`,
      body: message ?? "Unknown error",
      severity: "critical",
      metadata,
    });
  }

  getJobTelemetry(job: string): JobTelemetrySnapshot | null {
    const entry = this.jobStats.get(job);
    if (!entry) {
      return null;
    }
    return this.serialize(job, entry);
  }

  getAllTelemetry(): JobTelemetrySnapshot[] {
    return Array.from(this.jobStats.entries()).map(([job, entry]) =>
      this.serialize(job, entry),
    );
  }

  private getOrCreate(job: string): JobTelemetryInternal {
    if (!this.jobStats.has(job)) {
      this.jobStats.set(job, { successCount: 0, failureCount: 0 });
    }
    return this.jobStats.get(job)!;
  }

  private serialize(job: string, entry: JobTelemetryInternal) {
    return {
      job,
      successCount: entry.successCount,
      failureCount: entry.failureCount,
      lastSuccessAt: entry.lastSuccessAt?.toISOString(),
      lastFailureAt: entry.lastFailureAt?.toISOString(),
      lastMetadata: entry.lastMetadata,
      lastError: entry.lastError,
    } satisfies JobTelemetrySnapshot;
  }

  private cloneMetadata(metadata?: Record<string, unknown>) {
    if (!metadata || Object.keys(metadata).length === 0) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(metadata));
  }
}
