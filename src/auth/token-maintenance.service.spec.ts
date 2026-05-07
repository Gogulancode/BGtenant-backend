import { Logger } from "@nestjs/common";
import { TokenMaintenanceService } from "./token-maintenance.service";

describe("TokenMaintenanceService", () => {
  const tokensService = {
    cleanupExpiredTokens: jest.fn(),
  } as any;
  const telemetry = {
    recordJobSuccess: jest.fn(),
    recordJobFailure: jest.fn(),
  } as any;

  let service: TokenMaintenanceService;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TokenMaintenanceService(tokensService, telemetry);
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("cleans up tokens and logs the removal count", async () => {
    tokensService.cleanupExpiredTokens.mockResolvedValue(4);

    await service.cleanupStaleTokens();

    expect(tokensService.cleanupExpiredTokens).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      "Removed 4 expired/rotated refresh tokens",
    );
    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith(
      "token-maintenance",
      { removed: 4 },
    );
  });

  it("skips logging when no tokens are removed", async () => {
    tokensService.cleanupExpiredTokens.mockResolvedValue(0);

    await service.cleanupStaleTokens();

    expect(tokensService.cleanupExpiredTokens).toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
    expect(telemetry.recordJobSuccess).toHaveBeenCalledWith(
      "token-maintenance",
      { removed: 0 },
    );
  });

  it("reports telemetry failure when cleanup throws", async () => {
    const error = new Error("db down");
    tokensService.cleanupExpiredTokens.mockRejectedValue(error);

    await expect(service.cleanupStaleTokens()).rejects.toThrow("db down");

    expect(telemetry.recordJobFailure).toHaveBeenCalledWith(
      "token-maintenance",
      error,
    );
  });
});
