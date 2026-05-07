import * as Joi from "joi";

/**
 * Environment configuration schema for validation.
 * Ensures all required env vars are present and valid at startup.
 */
export const envValidationSchema = Joi.object({
  // Server
  NODE_ENV: Joi.string()
    .valid("development", "production", "test", "staging")
    .default("development"),
  PORT: Joi.number().default(3002),

  // Database
  DATABASE_URL: Joi.string().required().description("PostgreSQL connection URL"),

  // JWT
  JWT_SECRET: Joi.string().min(32).required().description("JWT signing secret"),
  JWT_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),

  // Redis (optional in development)
  REDIS_HOST: Joi.string().default("localhost"),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow("").optional(),

  // Rate Limiting
  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(20),

  // Email (optional)
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),

  // MFA
  MFA_ISSUER: Joi.string().default("BGAccountability"),
}).options({ stripUnknown: true });

/**
 * Validates environment variables at startup.
 * Throws if required vars are missing.
 */
export const validateEnv = (config: Record<string, unknown>) => {
  const { error, value } = envValidationSchema.validate(config, {
    abortEarly: false,
  });

  if (error) {
    const missingVars = error.details.map((d) => d.message).join(", ");
    throw new Error(`Environment validation failed: ${missingVars}`);
  }

  return value;
};
