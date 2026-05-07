import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsArray,
  IsHexColor,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SalesCycleStageDto {
  @ApiProperty({
    description: 'Stage name',
    example: 'Lead',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'Display order (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  order: number;

  @ApiPropertyOptional({
    description: 'Hex color for UI display',
    example: '#3B82F6',
  })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({
    description: 'Description of this stage',
    example: 'Initial contact with potential customer',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @ApiPropertyOptional({
    description: 'Probability of closing at this stage (0-100)',
    example: 10,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  probability?: number;

  @ApiPropertyOptional({
    description: 'Whether this stage is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SalesCycleSetupDto {
  @ApiProperty({
    description: 'Array of sales cycle stages (replaces all existing stages)',
    type: [SalesCycleStageDto],
    minItems: 2,
    maxItems: 10,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SalesCycleStageDto)
  @ArrayMinSize(2, { message: 'At least 2 stages are required' })
  @ArrayMaxSize(10, { message: 'Maximum 10 stages allowed' })
  stages: SalesCycleStageDto[];
}

export class SalesCycleStageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  order: number;

  @ApiPropertyOptional()
  color?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  probability?: number;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SalesCycleSetupResponseDto {
  @ApiProperty({
    description: 'Array of created/updated sales cycle stages',
    type: [SalesCycleStageResponseDto],
  })
  stages: SalesCycleStageResponseDto[];

  @ApiProperty({
    description: 'Total number of stages',
    example: 5,
  })
  totalStages: number;
}

/**
 * Default sales cycle stages template
 */
export const DEFAULT_SALES_CYCLE_STAGES: SalesCycleStageDto[] = [
  {
    name: 'Lead',
    order: 1,
    color: '#9CA3AF',
    description: 'Initial contact or inquiry',
    probability: 10,
  },
  {
    name: 'Qualified',
    order: 2,
    color: '#3B82F6',
    description: 'Prospect shows interest and fits criteria',
    probability: 25,
  },
  {
    name: 'Proposal',
    order: 3,
    color: '#F59E0B',
    description: 'Proposal or quote sent',
    probability: 50,
  },
  {
    name: 'Negotiation',
    order: 4,
    color: '#8B5CF6',
    description: 'Terms being negotiated',
    probability: 75,
  },
  {
    name: 'Closed Won',
    order: 5,
    color: '#10B981',
    description: 'Deal closed successfully',
    probability: 100,
  },
];
