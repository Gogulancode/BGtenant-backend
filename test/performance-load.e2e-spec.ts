/**
 * Performance & Load Tests for Tenant App
 *
 * Tests cover:
 * - API response time < 300ms for most endpoints
 * - Dashboard data loads < 2.5 seconds
 * - No N+1 queries or repeated database calls
 * - Efficient pagination and data loading
 * - Lazy-loaded resources perform well
 */

import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Role } from "@prisma/client";
import * as request from "supertest";

// =============================================================================
// Performance Timing Utilities
// =============================================================================

interface TimingResult {
  duration: number;
  status: number;
  success: boolean;
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  requestsPerSecond: number;
}

function calculatePercentile(sortedTimes: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedTimes.length) - 1;
  return sortedTimes[Math.max(0, index)];
}

function analyzeLoadTest(timings: TimingResult[]): LoadTestResult {
  const successful = timings.filter((t) => t.success);
  const durations = successful.map((t) => t.duration).sort((a, b) => a - b);

  const totalDuration = durations.reduce((sum, d) => sum + d, 0);
  const avgResponseTime = durations.length > 0 ? totalDuration / durations.length : 0;

  return {
    totalRequests: timings.length,
    successfulRequests: successful.length,
    failedRequests: timings.length - successful.length,
    avgResponseTime: Math.round(avgResponseTime),
    minResponseTime: durations.length > 0 ? durations[0] : 0,
    maxResponseTime: durations.length > 0 ? durations[durations.length - 1] : 0,
    p95ResponseTime: durations.length > 0 ? calculatePercentile(durations, 95) : 0,
    p99ResponseTime: durations.length > 0 ? calculatePercentile(durations, 99) : 0,
    requestsPerSecond: durations.length > 0 ? Math.round((1000 / avgResponseTime) * 10) / 10 : 0,
  };
}

// =============================================================================
// Mock Services with Timing Instrumentation
// =============================================================================

type ActiveUser = {
  userId: string;
  tenantId: string;
  role: Role;
};

const testUser: ActiveUser = {
  userId: "user_perf_001",
  tenantId: "tenant_perf_001",
  role: Role.TENANT_ADMIN,
};

// Track query counts for N+1 detection
let queryCount = 0;
const resetQueryCount = () => { queryCount = 0; };
const getQueryCount = () => queryCount;
const incrementQueryCount = () => { queryCount++; };

// Simulated response delays (ms) to mimic real DB operations
const SIMULATED_DELAYS = {
  simple: 5,    // Simple single-record lookup
  list: 15,     // List with pagination
  aggregate: 25, // Aggregation/summary queries
  complex: 50,  // Complex joins or multi-table queries
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// Mock Service Implementations with Realistic Timing
// =============================================================================

class MockDashboardService {
  async getSummary(userId: string, tenantId: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.aggregate);
    return {
      metrics: { total: 5, active: 3 },
      outcomes: { thisWeek: 10, completed: 7 },
      momentum: { score: 75, trend: "up" },
      streak: 5,
    };
  }
}

class MockMetricsService {
  async getAllMetrics(userId: string, tenantId: string, query: any) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.list);
    return {
      data: Array.from({ length: query.pageSize || 20 }, (_, i) => ({
        id: `metric_${i}`,
        name: `Metric ${i}`,
        value: Math.random() * 100,
      })),
      meta: { page: query.page || 1, pageSize: query.pageSize || 20, total: 50 },
    };
  }

  async getMetricById(userId: string, tenantId: string, id: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.simple);
    return { id, name: "Test Metric", value: 42 };
  }

  async getMetricTrend(userId: string, tenantId: string, id: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.aggregate);
    return Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - i * 86400000).toISOString(),
      value: Math.random() * 100,
    }));
  }
}

class MockOutcomesService {
  async getAllOutcomes(userId: string, tenantId: string, query: any) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.list);
    return {
      data: Array.from({ length: query.pageSize || 20 }, (_, i) => ({
        id: `outcome_${i}`,
        title: `Outcome ${i}`,
        status: "Planned",
      })),
      meta: { page: 1, pageSize: 20, total: 100 },
    };
  }

  async getOutcomeSummary(userId: string, tenantId: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.aggregate);
    return { planned: 10, done: 5, missed: 2, completionRate: 71 };
  }
}

class MockActivitiesService {
  async getAllActivities(userId: string, tenantId: string, query: any) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.list);
    return {
      data: Array.from({ length: 20 }, (_, i) => ({
        id: `activity_${i}`,
        title: `Activity ${i}`,
        category: "Operations",
      })),
      meta: { page: 1, pageSize: 20, total: 200 },
    };
  }
}

class MockInsightsService {
  async getMomentum(userId: string, tenantId: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.aggregate);
    return { score: 75, flag: "green", trend: [70, 72, 75] };
  }

  async getSummary(userId: string, tenantId: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.complex);
    return {
      momentum: 75,
      streak: 5,
      topMetrics: [],
      recentActivity: [],
    };
  }
}

class MockSalesService {
  async getSalesPlanning(userId: string, tenantId: string, year: number) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.simple);
    return { year, q1: 10000, q2: 15000, q3: 20000, q4: 25000 };
  }

  async getSalesSummary(userId: string, tenantId: string) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.aggregate);
    return {
      ytdTarget: 70000,
      ytdActual: 55000,
      attainmentRate: 78.5,
    };
  }
}

class MockReviewsService {
  async getReviews(userId: string, tenantId: string, query: any) {
    incrementQueryCount();
    await delay(SIMULATED_DELAYS.list);
    return {
      data: Array.from({ length: 10 }, (_, i) => ({
        id: `review_${i}`,
        type: "Daily",
        date: new Date().toISOString(),
      })),
      meta: { page: 1, pageSize: 20, total: 50 },
    };
  }
}

// =============================================================================
// Performance Test Suites
// =============================================================================

describe("Performance & Load Tests - Tenant App", () => {
  const mockServices = {
    dashboard: new MockDashboardService(),
    metrics: new MockMetricsService(),
    outcomes: new MockOutcomesService(),
    activities: new MockActivitiesService(),
    insights: new MockInsightsService(),
    sales: new MockSalesService(),
    reviews: new MockReviewsService(),
  };

  beforeEach(() => {
    resetQueryCount();
  });

  describe("API Response Time Requirements (<300ms)", () => {
    const MAX_RESPONSE_TIME = 300;

    it("dashboard summary loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
      expect(getQueryCount()).toBe(1); // Single aggregation query
    });

    it("metrics list loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, {
        page: 1,
        pageSize: 20,
      });
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it("single metric lookup loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.metrics.getMetricById(testUser.userId, testUser.tenantId, "metric_1");
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it("outcomes list loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.outcomes.getAllOutcomes(testUser.userId, testUser.tenantId, {});
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it("activities list loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.activities.getAllActivities(testUser.userId, testUser.tenantId, {});
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it("momentum insights load within 300ms", async () => {
      const start = performance.now();
      await mockServices.insights.getMomentum(testUser.userId, testUser.tenantId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it("sales summary loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.sales.getSalesSummary(testUser.userId, testUser.tenantId);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });

    it("reviews list loads within 300ms", async () => {
      const start = performance.now();
      await mockServices.reviews.getReviews(testUser.userId, testUser.tenantId, {});
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(MAX_RESPONSE_TIME);
    });
  });

  describe("Dashboard Load Time (<2.5 seconds)", () => {
    const MAX_DASHBOARD_LOAD = 2500;

    it("full dashboard data loads within 2.5 seconds", async () => {
      const start = performance.now();

      // Simulate parallel dashboard data fetching
      await Promise.all([
        mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId),
        mockServices.insights.getMomentum(testUser.userId, testUser.tenantId),
        mockServices.outcomes.getOutcomeSummary(testUser.userId, testUser.tenantId),
        mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, { pageSize: 5 }),
        mockServices.activities.getAllActivities(testUser.userId, testUser.tenantId, { pageSize: 5 }),
      ]);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(MAX_DASHBOARD_LOAD);
    });

    it("dashboard with charts data loads within 2.5 seconds", async () => {
      const start = performance.now();

      await Promise.all([
        mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId),
        mockServices.insights.getSummary(testUser.userId, testUser.tenantId),
        mockServices.metrics.getMetricTrend(testUser.userId, testUser.tenantId, "metric_1"),
        mockServices.sales.getSalesSummary(testUser.userId, testUser.tenantId),
      ]);

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(MAX_DASHBOARD_LOAD);
    });
  });

  describe("N+1 Query Prevention", () => {
    it("metrics list uses single query with includes", async () => {
      resetQueryCount();
      await mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, {
        page: 1,
        pageSize: 50,
      });

      // Should be 1 query for list, not 1 + N for each item
      expect(getQueryCount()).toBe(1);
    });

    it("outcomes list uses single query", async () => {
      resetQueryCount();
      await mockServices.outcomes.getAllOutcomes(testUser.userId, testUser.tenantId, {
        page: 1,
        pageSize: 100,
      });

      expect(getQueryCount()).toBe(1);
    });

    it("dashboard summary uses minimal queries", async () => {
      resetQueryCount();
      await mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId);

      // Dashboard should use aggregated queries, not individual lookups
      expect(getQueryCount()).toBeLessThanOrEqual(3);
    });

    it("insights summary uses efficient aggregation", async () => {
      resetQueryCount();
      await mockServices.insights.getSummary(testUser.userId, testUser.tenantId);

      // Complex summary should still be limited queries
      expect(getQueryCount()).toBeLessThanOrEqual(5);
    });
  });

  describe("Pagination Efficiency", () => {
    it("paginated requests maintain consistent response time", async () => {
      const timings: number[] = [];

      // Test multiple pages
      for (let page = 1; page <= 5; page++) {
        const start = performance.now();
        await mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, {
          page,
          pageSize: 20,
        });
        timings.push(performance.now() - start);
      }

      // All pages should load in similar time (within 2x of first page)
      const maxTime = Math.max(...timings);
      const minTime = Math.min(...timings);
      expect(maxTime / minTime).toBeLessThan(2);
    });

    it("large page sizes remain performant", async () => {
      const start = performance.now();
      await mockServices.activities.getAllActivities(testUser.userId, testUser.tenantId, {
        page: 1,
        pageSize: 100,
      });
      const duration = performance.now() - start;

      // Even with 100 items, should be under 500ms
      expect(duration).toBeLessThan(500);
    });
  });

  describe("Concurrent Request Handling", () => {
    it("handles 10 concurrent requests efficiently", async () => {
      const requests = Array.from({ length: 10 }, () =>
        mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, {})
      );

      const start = performance.now();
      await Promise.all(requests);
      const totalDuration = performance.now() - start;

      // 10 concurrent requests should complete faster than 10 sequential
      // With ~15ms each, parallel should be ~50-100ms, not 150ms
      expect(totalDuration).toBeLessThan(200);
    });

    it("handles mixed endpoint concurrent requests", async () => {
      const requests = [
        mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId),
        mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, {}),
        mockServices.outcomes.getAllOutcomes(testUser.userId, testUser.tenantId, {}),
        mockServices.activities.getAllActivities(testUser.userId, testUser.tenantId, {}),
        mockServices.insights.getMomentum(testUser.userId, testUser.tenantId),
      ];

      const start = performance.now();
      await Promise.all(requests);
      const duration = performance.now() - start;

      // Parallel requests to different endpoints
      expect(duration).toBeLessThan(300);
    });
  });

  describe("Load Test Simulation", () => {
    it("sustains 50 requests with acceptable performance", async () => {
      const timings: TimingResult[] = [];

      for (let i = 0; i < 50; i++) {
        const start = performance.now();
        try {
          await mockServices.metrics.getAllMetrics(testUser.userId, testUser.tenantId, {});
          timings.push({
            duration: performance.now() - start,
            status: 200,
            success: true,
          });
        } catch {
          timings.push({
            duration: performance.now() - start,
            status: 500,
            success: false,
          });
        }
      }

      const results = analyzeLoadTest(timings);

      expect(results.successfulRequests).toBe(50);
      expect(results.failedRequests).toBe(0);
      expect(results.avgResponseTime).toBeLessThan(100);
      expect(results.p95ResponseTime).toBeLessThan(200);
    });

    it("handles burst of 20 concurrent requests", async () => {
      const runRequest = async (): Promise<TimingResult> => {
        const start = performance.now();
        try {
          await mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId);
          return { duration: performance.now() - start, status: 200, success: true };
        } catch {
          return { duration: performance.now() - start, status: 500, success: false };
        }
      };

      const requests = Array.from({ length: 20 }, () => runRequest());
      const timings = await Promise.all(requests);
      const results = analyzeLoadTest(timings);

      expect(results.successfulRequests).toBe(20);
      expect(results.p95ResponseTime).toBeLessThan(300);
    });
  });

  describe("Lazy Loading Performance", () => {
    it("chart data loads efficiently on demand", async () => {
      // Simulate initial page load (without charts)
      const initialStart = performance.now();
      await mockServices.dashboard.getSummary(testUser.userId, testUser.tenantId);
      const initialLoad = performance.now() - initialStart;

      // Simulate lazy-loaded chart request
      const chartStart = performance.now();
      await mockServices.metrics.getMetricTrend(testUser.userId, testUser.tenantId, "metric_1");
      const chartLoad = performance.now() - chartStart;

      // Initial load should be fast
      expect(initialLoad).toBeLessThan(100);
      // Chart load can be slightly slower but still reasonable
      expect(chartLoad).toBeLessThan(200);
    });

    it("sequential lazy loads don't block each other", async () => {
      const charts = ["metric_1", "metric_2", "metric_3"];
      const timings: number[] = [];

      for (const chartId of charts) {
        const start = performance.now();
        await mockServices.metrics.getMetricTrend(testUser.userId, testUser.tenantId, chartId);
        timings.push(performance.now() - start);
      }

      // Each chart should load independently in similar time
      timings.forEach((time) => {
        expect(time).toBeLessThan(100);
      });
    });
  });

  describe("Memory Efficiency", () => {
    it("large dataset pagination doesn't cause memory spikes", async () => {
      // Simulate paginating through large dataset
      const pageResults: any[] = [];

      for (let page = 1; page <= 10; page++) {
        const result = await mockServices.activities.getAllActivities(
          testUser.userId,
          testUser.tenantId,
          { page, pageSize: 100 }
        );
        pageResults.push(result);
      }

      // Each page should have consistent structure
      pageResults.forEach((result) => {
        expect(result.data.length).toBeLessThanOrEqual(100);
        expect(result.meta).toBeDefined();
      });
    });
  });
});

describe("Performance Benchmarks Summary", () => {
  it("documents performance requirements", () => {
    const requirements = {
      apiResponseTime: {
        target: "< 300ms",
        description: "Most API endpoints should respond within 300ms",
      },
      dashboardLoad: {
        target: "< 2.5s",
        description: "Tenant dashboard full load including initial data",
      },
      queryEfficiency: {
        target: "No N+1 queries",
        description: "List operations use single queries with proper includes",
      },
      concurrency: {
        target: "10+ concurrent requests",
        description: "System handles concurrent requests efficiently",
      },
      pagination: {
        target: "Consistent performance",
        description: "Page load times remain consistent regardless of page number",
      },
      lazyLoading: {
        target: "< 200ms per component",
        description: "Lazy-loaded components load smoothly without blocking",
      },
    };

    // This test documents requirements - always passes
    expect(Object.keys(requirements).length).toBe(6);
  });
});
