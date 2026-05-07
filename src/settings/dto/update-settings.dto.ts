import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    description: "Preferred timezone (IANA name)",
    example: "America/New_York",
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({
    description: "Opt-in for email notifications",
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notificationsEmail?: boolean;

  @ApiPropertyOptional({
    description: "Opt-in for push notifications",
    default: true,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  notificationsPush?: boolean;
}
