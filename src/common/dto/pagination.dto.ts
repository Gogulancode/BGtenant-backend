import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  Max,
  Matches,
} from "class-validator";
import { Transform, Type } from "class-transformer";

export class PaginationDto {
  @ApiPropertyOptional({
    description: "Page number (1-indexed)",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "page must be an integer" })
  @Min(1, { message: "page must be at least 1" })
  page: number = 1;

  @ApiPropertyOptional({
    description: "Number of items per page",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: "pageSize must be an integer" })
  @Min(1, { message: "pageSize must be at least 1" })
  @Max(100, { message: "pageSize must not exceed 100" })
  pageSize: number = 20;

  @ApiPropertyOptional({
    description: "Search query string",
    example: "revenue",
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  search?: string;

  @ApiPropertyOptional({
    description: "Sort field and direction (e.g., createdAt:desc, name:asc)",
    example: "createdAt:desc",
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z_]+:(asc|desc)$/i, {
    message: "sort must be in format field:asc or field:desc",
  })
  sort?: string;

  /**
   * Get skip value for Prisma pagination
   */
  get skip(): number {
    return (this.page - 1) * this.pageSize;
  }

  /**
   * Get take value for Prisma pagination
   */
  get take(): number {
    return this.pageSize;
  }

  /**
   * Parse sort string into Prisma orderBy object
   * @param allowedFields Array of allowed field names for sorting
   * @param defaultField Default field to sort by
   * @param defaultDirection Default sort direction
   */
  getOrderBy(
    allowedFields: string[],
    defaultField = "createdAt",
    defaultDirection: "asc" | "desc" = "desc",
  ): Record<string, "asc" | "desc"> {
    if (!this.sort) {
      return { [defaultField]: defaultDirection };
    }

    const [field, direction] = this.sort.split(":");
    const normalizedField = field.toLowerCase();
    const normalizedDirection = direction?.toLowerCase() as "asc" | "desc";

    if (
      allowedFields.includes(normalizedField) &&
      ["asc", "desc"].includes(normalizedDirection)
    ) {
      return { [normalizedField]: normalizedDirection };
    }

    return { [defaultField]: defaultDirection };
  }
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Helper function to create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  pagination: PaginationDto,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pagination.pageSize);

  return {
    data,
    meta: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1,
    },
  };
}
