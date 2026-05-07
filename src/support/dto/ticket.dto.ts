import {
  IsString,
  IsEnum,
  IsOptional,
  MinLength,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export enum SupportTicketStatus {
  OPEN = "OPEN",
  IN_PROGRESS = "IN_PROGRESS",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
}

export class CreateTicketDto {
  @ApiProperty({
    description: "Brief subject line for the ticket",
    minLength: 5,
    maxLength: 120,
    example: "Unable to access dashboard metrics",
  })
  @IsString()
  @MinLength(5, { message: "Subject must be at least 5 characters" })
  @MaxLength(120, { message: "Subject must not exceed 120 characters" })
  subject: string;

  @ApiProperty({
    description: "Detailed description of the issue",
    minLength: 10,
    maxLength: 2000,
    example:
      "When I try to load the metrics page, it shows a blank screen. This started happening after the latest update.",
  })
  @IsString()
  @MinLength(10, { message: "Description must be at least 10 characters" })
  @MaxLength(2000, { message: "Description must not exceed 2000 characters" })
  message: string;

  @ApiPropertyOptional({
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
    description: "Ticket priority level",
  })
  @IsOptional()
  @IsEnum(TicketPriority, { message: "Priority must be LOW, MEDIUM, or HIGH" })
  priority?: TicketPriority;
}

export class UpdateTicketDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: "Admin note must not exceed 1000 characters" })
  adminNote?: string;
}
