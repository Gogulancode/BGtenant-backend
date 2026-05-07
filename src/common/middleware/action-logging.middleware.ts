import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { PrismaService } from "../../prisma/prisma.service";
import * as jwt from "jsonwebtoken";
import { JwtPayload } from "jsonwebtoken";

@Injectable()
export class ActionLoggingMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    // Capture response
    const originalSend = res.send;
    let statusCode = 200;

    res.send = function (data: any): Response {
      statusCode = res.statusCode;
      return originalSend.call(this, data);
    };

    res.on("finish", async () => {
      try {
        const responseTime = Date.now() - startTime;
        const ipAddress =
          (req.headers["x-forwarded-for"] as string) || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        // Extract userId from JWT if available
        let userId: string | null = null;
        let tenantId: string | null = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          try {
            const token = authHeader.substring(7);
            const decoded = jwt.decode(token);
            if (decoded && typeof decoded === "object") {
              const payload = decoded as JwtPayload;
              userId = typeof payload.sub === "string" ? payload.sub : null;
              const payloadTenant = (payload as Record<string, unknown>)[
                "tenantId"
              ];
              tenantId =
                typeof payloadTenant === "string" ? payloadTenant : null;
            }
          } catch {
            // Invalid token, keep userId as null
          }
        }

        // Determine module and action from route
        const pathParts = req.path.split("/").filter((p) => p);
        const module = pathParts[2] || "unknown"; // After /api/v1/
        const action = `${req.method} ${req.path}`;

        // Skip logging for health/ops endpoints to reduce noise
        if (module === "ops" || req.path.includes("/health")) {
          return;
        }

        // Log to database asynchronously
        await this.prisma.actionLog
          .create({
            data: {
              userId,
              tenantId,
              module,
              action,
              method: req.method,
              endpoint: req.path,
              statusCode,
              responseTime,
              ipAddress,
              userAgent,
              details: {
                query: req.query,
                params: req.params,
              },
            },
          })
          .catch((err) => {
            // Silently fail logging to not break the request
            console.error("Failed to log action:", err.message);
          });
      } catch (error) {
        // Silently fail to not break the request
        console.error("Action logging error:", error);
      }
    });

    next();
  }
}
