import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from "class-validator";
import { BusinessType, Role } from "@prisma/client";

export const TENANT_ASSIGNABLE_ROLES: Role[] = [
  Role.MANAGER,
  Role.STAFF,
  Role.VIEWER,
];

export class InviteTenantUserDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(2, 80)
  name: string;

  @ApiProperty()
  @Transform(({ value }) => value?.toLowerCase())
  @IsEmail()
  email: string;

  @ApiProperty({ enum: TENANT_ASSIGNABLE_ROLES })
  @IsEnum(Role)
  role: Role;

  @ApiPropertyOptional({ enum: BusinessType })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;
}

export class UpdateTenantUserRoleDto {
  @ApiProperty({ enum: [Role.TENANT_ADMIN, ...TENANT_ASSIGNABLE_ROLES] })
  @IsEnum(Role)
  role: Role;
}

export class TenantUserQueryDto {
  @ApiPropertyOptional({ description: "Include inactive / archived users" })
  @Transform(({ value }) => value === true || value === "true")
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean;

  @ApiPropertyOptional({
    enum: [Role.TENANT_ADMIN, ...TENANT_ASSIGNABLE_ROLES],
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

export class UpdateTenantUserStatusDto {
  @ApiProperty()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isActive: boolean;
}
