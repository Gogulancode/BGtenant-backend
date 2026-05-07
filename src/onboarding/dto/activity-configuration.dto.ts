import {
  IsBoolean,
  IsOptional,
  IsInt,
  IsArray,
  IsString,
  IsEnum,
  ValidateNested,
  Min,
  Max,
  ArrayMaxSize,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ActivityPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum ActivityRelevance {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BOTH = 'BOTH',
}

export class ActivityTemplateDto {
  @ApiProperty({ example: 'Creating weekly social media content' })
  @IsString()
  @MaxLength(120)
  category: string;

  @ApiProperty({ enum: ActivityPriority, example: ActivityPriority.HIGH })
  @IsEnum(ActivityPriority)
  priority: ActivityPriority;

  @ApiProperty({ example: 3 })
  @IsInt()
  @Min(1)
  @Max(50)
  weeklyGoal: number;

  @ApiProperty({ type: [Number], example: [1, 3, 5] })
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  reminderDays: number[];

  @ApiProperty({
    example: 'Increase or decrease in followers, views, likes, comments, and shares',
  })
  @IsString()
  @MaxLength(300)
  measurability: string;

  @ApiProperty({ example: 'Generating Leads' })
  @IsString()
  @MaxLength(120)
  impact: string;

  @ApiProperty({ enum: ActivityRelevance, example: ActivityRelevance.BOTH })
  @IsEnum(ActivityRelevance)
  relevance: ActivityRelevance;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class ActivityConfigurationDto {
  @ApiPropertyOptional({
    description: 'Enable sales development activities tracking',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  salesEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable marketing activities tracking',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  marketingEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable networking activities tracking',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  networkingEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable product development activities tracking',
    example: false,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  productDevEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable operations activities tracking',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  operationsEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Target number of activities per week',
    example: 5,
    default: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(1, { message: 'weeklyActivityGoal must be at least 1' })
  @Max(50, { message: 'weeklyActivityGoal must be at most 50' })
  weeklyActivityGoal?: number;

  @ApiPropertyOptional({
    description: 'Enable reminder notifications',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  enableReminders?: boolean;

  @ApiPropertyOptional({
    description: 'Days of the week to send reminders (0=Sun, 6=Sat)',
    example: [1, 3, 5],
    default: [1, 3, 5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  reminderDays?: number[];

  @ApiPropertyOptional({
    description: 'Selected activity templates with measurability and impact metadata',
    type: [ActivityTemplateDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ActivityTemplateDto)
  activities?: ActivityTemplateDto[];
}

export class ActivityConfigurationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  salesEnabled: boolean;

  @ApiProperty()
  marketingEnabled: boolean;

  @ApiProperty()
  networkingEnabled: boolean;

  @ApiProperty()
  productDevEnabled: boolean;

  @ApiProperty()
  operationsEnabled: boolean;

  @ApiProperty()
  weeklyActivityGoal: number;

  @ApiProperty()
  enableReminders: boolean;

  @ApiProperty({ type: [Number] })
  reminderDays: number[];

  @ApiPropertyOptional({ type: [ActivityTemplateDto] })
  activities?: ActivityTemplateDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export const DEFAULT_ACTIVITY_TEMPLATES: ActivityTemplateDto[] = [
  {
    category: 'Creating weekly social media content',
    priority: ActivityPriority.HIGH,
    weeklyGoal: 3,
    reminderDays: [1, 3, 5],
    measurability: 'Increase or decrease in followers, views, likes, comments, and shares',
    impact: 'Generating Leads',
    relevance: ActivityRelevance.BOTH,
    enabled: true,
  },
  {
    category: 'Creating a monthly ad campaign on social media',
    priority: ActivityPriority.HIGH,
    weeklyGoal: 1,
    reminderDays: [2],
    measurability: 'Leads generated vs leads converted',
    impact: 'Sales',
    relevance: ActivityRelevance.BOTH,
    enabled: true,
  },
  {
    category: 'Creating a delight for existing or past clients',
    priority: ActivityPriority.MEDIUM,
    weeklyGoal: 2,
    reminderDays: [4],
    measurability: 'Referrals or repeat business received',
    impact: 'Generating Leads',
    relevance: ActivityRelevance.SERVICE,
    enabled: true,
  },
  {
    category: 'Participating in exhibitions',
    priority: ActivityPriority.MEDIUM,
    weeklyGoal: 1,
    reminderDays: [1],
    measurability: 'Target vs achievement on sales generated or pre-bookings',
    impact: 'Sales',
    relevance: ActivityRelevance.PRODUCT,
    enabled: false,
  },
  {
    category: 'Sales follow-ups with warm prospects',
    priority: ActivityPriority.HIGH,
    weeklyGoal: 10,
    reminderDays: [1, 3, 5],
    measurability: 'Follow-ups completed and prospects moved forward',
    impact: 'Closure',
    relevance: ActivityRelevance.BOTH,
    enabled: true,
  },
  {
    category: 'Creating monthly offers',
    priority: ActivityPriority.MEDIUM,
    weeklyGoal: 1,
    reminderDays: [2],
    measurability: 'Offer responses, inquiries, and sales conversions',
    impact: 'Sales',
    relevance: ActivityRelevance.BOTH,
    enabled: true,
  },
  {
    category: 'Retention and customer community actions',
    priority: ActivityPriority.MEDIUM,
    weeklyGoal: 2,
    reminderDays: [5],
    measurability: 'Repeat business, engagement, referrals, and testimonials',
    impact: 'Retention',
    relevance: ActivityRelevance.BOTH,
    enabled: true,
  },
];
