import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsUrl,
  MaxLength,
  Min,
  Max,
  IsArray,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum CompanyType {
  SOLE_PROPRIETORSHIP = 'SOLE_PROPRIETORSHIP',
  PARTNERSHIP = 'PARTNERSHIP',
  LLC = 'LLC',
  CORPORATION = 'CORPORATION',
  NON_PROFIT = 'NON_PROFIT',
  COOPERATIVE = 'COOPERATIVE',
  OTHER = 'OTHER',
}

export enum Industry {
  TECHNOLOGY = 'TECHNOLOGY',
  HEALTHCARE = 'HEALTHCARE',
  FINANCE = 'FINANCE',
  RETAIL = 'RETAIL',
  MANUFACTURING = 'MANUFACTURING',
  EDUCATION = 'EDUCATION',
  REAL_ESTATE = 'REAL_ESTATE',
  HOSPITALITY = 'HOSPITALITY',
  CONSULTING = 'CONSULTING',
  MARKETING = 'MARKETING',
  CONSTRUCTION = 'CONSTRUCTION',
  TRANSPORTATION = 'TRANSPORTATION',
  AGRICULTURE = 'AGRICULTURE',
  ENTERTAINMENT = 'ENTERTAINMENT',
  OTHER = 'OTHER',
}

export enum TurnoverBand {
  UNDER_1L = 'UNDER_1L',
  L1_TO_5L = 'L1_TO_5L',
  L5_TO_10L = 'L5_TO_10L',
  L10_TO_25L = 'L10_TO_25L',
  L25_TO_50L = 'L25_TO_50L',
  L50_TO_1CR = 'L50_TO_1CR',
  CR1_TO_5CR = 'CR1_TO_5CR',
  CR5_TO_10CR = 'CR5_TO_10CR',
  ABOVE_10CR = 'ABOVE_10CR',
}

export enum EmployeeRange {
  SOLO = 'SOLO',
  MICRO = 'MICRO',
  SMALL = 'SMALL',
  MEDIUM = 'MEDIUM',
  LARGE = 'LARGE',
  ENTERPRISE = 'ENTERPRISE',
}

export enum CustomerType {
  B2B = 'B2B',
  B2C = 'B2C',
  BOTH = 'BOTH',
}

export enum BusinessRegistrationStatus {
  REGISTERED = 'REGISTERED',
  UNREGISTERED = 'UNREGISTERED',
  IN_PROGRESS = 'IN_PROGRESS',
}

export enum OfferingType {
  PRODUCT = 'PRODUCT',
  SERVICE = 'SERVICE',
  BOTH = 'BOTH',
}

export class BusinessIdentityDto {
  @ApiPropertyOptional({
    description: 'Company/business name',
    example: 'Acme Corp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional({
    description: 'Type of company',
    enum: CompanyType,
    example: CompanyType.LLC,
  })
  @IsOptional()
  @IsEnum(CompanyType)
  companyType?: CompanyType;

  @ApiPropertyOptional({
    description: 'Primary customer segment',
    enum: CustomerType,
    example: CustomerType.B2B,
  })
  @IsOptional()
  @IsEnum(CustomerType)
  customerType?: CustomerType;

  @ApiPropertyOptional({
    description: 'Business registration status',
    enum: BusinessRegistrationStatus,
    example: BusinessRegistrationStatus.REGISTERED,
  })
  @IsOptional()
  @IsEnum(BusinessRegistrationStatus)
  registrationStatus?: BusinessRegistrationStatus;

  @ApiPropertyOptional({
    description: 'Whether the business sells products, services, or both',
    enum: OfferingType,
    example: OfferingType.SERVICE,
  })
  @IsOptional()
  @IsEnum(OfferingType)
  offeringType?: OfferingType;

  @ApiProperty({
    description: 'Industry sector',
    enum: Industry,
    example: Industry.TECHNOLOGY,
  })
  @IsEnum(Industry)
  industry: Industry;

  @ApiPropertyOptional({
    description: 'Custom industry description (when industry is OTHER)',
    example: 'Space Tourism',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  industryOther?: string;

  @ApiPropertyOptional({
    description: 'Year the business was founded',
    example: 2018,
  })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(new Date().getFullYear())
  foundedYear?: number;

  @ApiPropertyOptional({
    description: 'Annual turnover band',
    enum: TurnoverBand,
    example: TurnoverBand.L10_TO_25L,
  })
  @IsOptional()
  @IsEnum(TurnoverBand)
  turnoverBand?: TurnoverBand;

  @ApiPropertyOptional({
    description: 'Number of employees range',
    enum: EmployeeRange,
    example: EmployeeRange.SMALL,
  })
  @IsOptional()
  @IsEnum(EmployeeRange)
  employeeRange?: EmployeeRange;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://acme.com',
  })
  @IsOptional()
  @IsUrl({}, { message: 'website must be a valid URL' })
  website?: string;

  @ApiPropertyOptional({
    description: 'Brief description of the business',
    example: 'We provide innovative software solutions for SMBs.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Years in business',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(200)
  businessAge?: number;

  @ApiPropertyOptional({
    description: 'Unique Selling Proposition',
    example: 'We deliver results 50% faster than competitors.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  usp?: string;

  @ApiPropertyOptional({
    description: 'Business keywords/tags',
    example: ['software', 'consulting', 'cloud'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(10)
  keywords?: string[];

  @ApiPropertyOptional({
    description: 'Named products or services offered by the business',
    example: ['Sales excellence workshop', 'Business owner review'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(12)
  offerings?: string[];
}

export class BusinessIdentityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenantId: string;

  @ApiPropertyOptional()
  companyName?: string;

  @ApiPropertyOptional({ enum: CompanyType })
  companyType?: CompanyType;

  @ApiPropertyOptional({ enum: CustomerType })
  customerType?: CustomerType;

  @ApiPropertyOptional({ enum: BusinessRegistrationStatus })
  registrationStatus?: BusinessRegistrationStatus;

  @ApiPropertyOptional({ enum: OfferingType })
  offeringType?: OfferingType;

  @ApiPropertyOptional({ enum: Industry })
  industry?: Industry;

  @ApiPropertyOptional()
  industryOther?: string;

  @ApiPropertyOptional()
  foundedYear?: number;

  @ApiPropertyOptional({ enum: TurnoverBand })
  turnoverBand?: TurnoverBand;

  @ApiPropertyOptional({ enum: EmployeeRange })
  employeeRange?: EmployeeRange;

  @ApiPropertyOptional()
  website?: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  businessAge?: number;

  @ApiPropertyOptional()
  usp?: string;

  @ApiPropertyOptional({ type: [String] })
  keywords?: string[];

  @ApiPropertyOptional({ type: [String] })
  offerings?: string[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
