import { CacheModuleOptions } from "@nestjs/cache-manager";
import { ConfigService } from "@nestjs/config";
import * as redisStore from "cache-manager-redis-store";

export const getCacheConfig = (
  configService: ConfigService,
): CacheModuleOptions => {
  const isProduction = configService.get("NODE_ENV") === "production";

  // Use Redis in production, in-memory cache in development
  if (isProduction) {
    return {
      store: redisStore as any,
      host: configService.get("REDIS_HOST", "localhost"),
      port: configService.get("REDIS_PORT", 6379),
      password: configService.get("REDIS_PASSWORD"),
      ttl: 60, // Default TTL: 60 seconds
      max: 100, // Maximum number of items in cache
    };
  }

  // In-memory cache for development (no Redis required)
  return {
    ttl: 60,
    max: 100,
  };
};
