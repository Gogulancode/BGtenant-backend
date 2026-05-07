import {
  IsNumber,
  IsOptional,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  Min,
  Max,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

/**
 * Custom validator to ensure monthly contribution percentages sum to approximately 100% (±1%)
 */
@ValidatorConstraint({ name: 'sumToHundred', async: false })
export class SumToHundredConstraint implements ValidatorConstraintInterface {
  validate(values: number[], args: ValidationArguments) {
    if (!values || values.length !== 12) return false;
    const sum = values.reduce((acc, val) => acc + val, 0);
    // Allow ±1% tolerance
    return sum >= 99 && sum <= 101;
  }

  defaultMessage(args: ValidationArguments) {
    const values = args.value as number[];
    const sum = values ? values.reduce((acc, val) => acc + val, 0) : 0;
    return `Monthly contribution percentages must sum to 100% (±1%). Current sum: ${sum.toFixed(2)}%`;
  }
}

/**
 * Custom validator to ensure all values are positive numbers
 */
@ValidatorConstraint({ name: 'allPositive', async: false })
export class AllPositiveConstraint implements ValidatorConstraintInterface {
  validate(values: number[]) {
    if (!values || !Array.isArray(values)) return false;
    return values.every(val => typeof val === 'number' && val >= 0);
  }

  defaultMessage() {
    return 'All contribution percentages must be non-negative numbers';
  }
}

export class SalesPlanDto {
  @ApiPropertyOptional({
    description: 'Revenue from 3 years ago (null if business did not exist)',
    example: 500000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'yearMinus3Value must be a number' })
  @Min(0)
  yearMinus3Value?: number;

  @ApiPropertyOptional({
    description: 'Revenue from 2 years ago (null if business did not exist)',
    example: 750000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'yearMinus2Value must be a number' })
  @Min(0)
  yearMinus2Value?: number;

  @ApiPropertyOptional({
    description: 'Revenue from last year (null if business did not exist)',
    example: 1000000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'yearMinus1Value must be a number' })
  @Min(0)
  yearMinus1Value?: number;

  @ApiProperty({
    description: 'Projected revenue target for the upcoming year',
    example: 1500000,
  })
  @IsNumber({}, { message: 'projectedYearValue must be a number' })
  @Min(1, { message: 'projectedYearValue must be at least 1' })
  projectedYearValue: number;

  @ApiProperty({
    description:
      'Monthly contribution percentages (12 values that must sum to ~100%)',
    example: [8, 7, 8, 9, 8, 7, 9, 10, 9, 8, 8, 9],
    type: [Number],
  })
  @IsArray()
  @ArrayMinSize(12, { message: 'monthlyContribution must have exactly 12 values' })
  @ArrayMaxSize(12, { message: 'monthlyContribution must have exactly 12 values' })
  @Type(() => Number)
  @Transform(({ value }) => value?.map((v: unknown) => Number(v)))
  @Validate(AllPositiveConstraint)
  @Validate(SumToHundredConstraint)
  monthlyContribution: number[];

  @ApiProperty({
    description: 'Average ticket size / average transaction size',
    example: 25000,
  })
  @IsNumber({}, { message: 'averageTicketSize must be a number' })
  @Type(() => Number)
  @Min(1, { message: 'averageTicketSize must be at least 1' })
  averageTicketSize: number;

  @ApiProperty({
    description: 'Lead-to-order conversion ratio percentage',
    example: 20,
  })
  @IsNumber({}, { message: 'conversionRatio must be a number' })
  @Type(() => Number)
  @Min(0.01, { message: 'conversionRatio must be greater than 0' })
  @Max(100, { message: 'conversionRatio cannot exceed 100' })
  conversionRatio: number;

  @ApiProperty({
    description: 'Existing customer contribution percentage',
    example: 40,
  })
  @IsNumber({}, { message: 'existingCustomerContribution must be a number' })
  @Type(() => Number)
  @Min(0)
  @Max(100)
  existingCustomerContribution: number;

  @ApiProperty({
    description: 'New customer contribution percentage',
    example: 60,
  })
  @IsNumber({}, { message: 'newCustomerContribution must be a number' })
  @Type(() => Number)
  @Min(0)
  @Max(100)
  @CustomerContributionSum()
  newCustomerContribution: number;
}

export class SalesPlanResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiPropertyOptional({ example: 500000 })
  yearMinus3Value?: number;

  @ApiPropertyOptional({ example: 750000 })
  yearMinus2Value?: number;

  @ApiPropertyOptional({ example: 1000000 })
  yearMinus1Value?: number;

  @ApiProperty({ example: 1500000 })
  projectedYearValue: number;

  @ApiProperty({
    description: 'Monthly contribution percentages',
    example: [8, 7, 8, 9, 8, 7, 9, 10, 9, 8, 8, 9],
    type: [Number],
  })
  monthlyContribution: number[];

  @ApiProperty({
    description:
      'Calculated monthly targets based on projectedYearValue * monthlyContribution[i] / 100',
    example: [
      120000, 105000, 120000, 135000, 120000, 105000, 135000, 150000, 135000,
      120000, 120000, 135000,
    ],
    type: [Number],
  })
  monthlyTargets: number[];

  @ApiProperty({ example: 25000 })
  averageTicketSize: number;

  @ApiProperty({ example: 20 })
  conversionRatio: number;

  @ApiProperty({ example: 40 })
  existingCustomerContribution: number;

  @ApiProperty({ example: 60 })
  newCustomerContribution: number;

  @ApiProperty({ type: [Number] })
  monthlyOrderTargets: number[];

  @ApiProperty({ type: [Number] })
  monthlyLeadTargets: number[];

  @ApiProperty({ example: 600000 })
  existingCustomerTarget: number;

  @ApiProperty({ example: 900000 })
  newCustomerTarget: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

function CustomerContributionSum(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'customerContributionSum',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: number, args: ValidationArguments) {
          const objectValue = args.object as SalesPlanDto;
          const total =
            Number(objectValue.existingCustomerContribution ?? 0) + Number(value ?? 0);
          return total >= 99.99 && total <= 100.01;
        },
        defaultMessage(args: ValidationArguments) {
          const objectValue = args.object as SalesPlanDto;
          const total =
            Number(objectValue.existingCustomerContribution ?? 0) +
            Number(args.value ?? 0);
          return `Existing and new customer contribution must total 100%. Current total: ${total.toFixed(2)}%`;
        },
      },
    });
  };
}
