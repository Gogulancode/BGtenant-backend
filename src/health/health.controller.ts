import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  HealthCheckResult,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma.health';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaHealthIndicator,
  ) {}

  /**
   * Basic liveness probe - is the app running?
   */
  @Get()
  @Public()
  @ApiOperation({ summary: 'Basic health check (liveness probe)' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  /**
   * Full readiness probe - is the app ready to serve traffic?
   */
  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe with database check' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  @ApiResponse({ status: 503, description: 'Application is not ready' })
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      // Check database connection
      () => this.prisma.isHealthy('database'),
      // Check memory usage (heap should be under 200MB)
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      // Check RSS memory (should be under 300MB)
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
    ]);
  }

  /**
   * Detailed health status for monitoring dashboards
   */
  @Get('detailed')
  @Public()
  @ApiOperation({ summary: 'Detailed health status for monitoring' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  @HealthCheck()
  detailed(): Promise<HealthCheckResult> {
    return this.health.check([
      // Database
      () => this.prisma.isHealthy('database'),
      // Memory checks
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024),
      // Disk check (at least 10% free space on root)
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.1,
        }),
    ]);
  }
}
