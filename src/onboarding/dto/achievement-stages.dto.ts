import {
  IsString,
  IsOptional,
  IsNumber,
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

export class AchievementStageDto {
  @ApiProperty({
    description: 'Stage name',
    example: 'Bronze',
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

  @ApiProperty({
    description: 'Target value (revenue/sales) to reach this stage',
    example: 375000,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  targetValue: number;

  @ApiPropertyOptional({
    description: 'Percentage of annual goal (e.g., 25 for 25%)',
    example: 25,
    minimum: 0,
    maximum: 200,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  percentOfGoal?: number;

  @ApiPropertyOptional({
    description: 'Hex color for UI display',
    example: '#CD7F32',
  })
  @IsOptional()
  @IsHexColor()
  color?: string;

  @ApiPropertyOptional({
    description: 'Icon identifier (e.g., trophy, star, medal)',
    example: 'medal',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({
    description: 'Reward or celebration description',
    example: 'Congratulations! You have reached your first milestone!',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reward?: string;

  @ApiPropertyOptional({
    description: 'Whether this stage is active',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AchievementStagesSetupDto {
  @ApiProperty({
    description: 'Array of achievement stages (replaces all existing stages)',
    type: [AchievementStageDto],
    minItems: 2,
    maxItems: 10,
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AchievementStageDto)
  @ArrayMinSize(2, { message: 'At least 2 achievement stages are required' })
  @ArrayMaxSize(10, { message: 'Maximum 10 achievement stages allowed' })
  stages: AchievementStageDto[];
}

export class AchievementStageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  order: number;

  @ApiProperty()
  targetValue: number;

  @ApiPropertyOptional()
  percentOfGoal?: number;

  @ApiPropertyOptional()
  color?: string;

  @ApiPropertyOptional()
  icon?: string;

  @ApiPropertyOptional()
  reward?: string;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AchievementStagesSetupResponseDto {
  @ApiProperty({
    description: 'Array of created/updated achievement stages',
    type: [AchievementStageResponseDto],
  })
  stages: AchievementStageResponseDto[];

  @ApiProperty({
    description: 'Total number of stages',
    example: 4,
  })
  totalStages: number;
}

/**
 * Helper function to generate default achievement stages based on annual goal
 */
export function generateDefaultAchievementStages(
  annualGoal: number,
): AchievementStageDto[] {
  return [
    {
      name: 'Bronze',
      order: 1,
      targetValue: annualGoal * 0.25,
      percentOfGoal: 25,
      color: '#CD7F32',
      icon: 'medal',
      reward: 'You have hit 25% of your annual goal! Keep up the momentum!',
    },
    {
      name: 'Silver',
      order: 2,
      targetValue: annualGoal * 0.5,
      percentOfGoal: 50,
      color: '#C0C0C0',
      icon: 'star',
      reward: 'Halfway there! 50% of your annual goal achieved!',
    },
    {
      name: 'Gold',
      order: 3,
      targetValue: annualGoal * 0.75,
      percentOfGoal: 75,
      color: '#FFD700',
      icon: 'trophy',
      reward: '75% achieved! The finish line is in sight!',
    },
    {
      name: 'Platinum',
      order: 4,
      targetValue: annualGoal,
      percentOfGoal: 100,
      color: '#E5E4E2',
      icon: 'crown',
      reward:
        'Congratulations! You have achieved 100% of your annual goal! Time to celebrate!',
    },
  ];
}
