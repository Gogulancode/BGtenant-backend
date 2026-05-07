import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  Min,
  Max,
  IsUrl,
  MaxLength,
  ValidateNested,
  ValidateIf,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { BusinessType } from '@prisma/client';

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export enum MaritalStatus {
  SINGLE = 'SINGLE',
  MARRIED = 'MARRIED',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
  PREFER_NOT_TO_SAY = 'PREFER_NOT_TO_SAY',
}

export class SocialHandlesDto {
  @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
  @IsOptional()
  @IsUrl({}, { message: 'linkedin must be a valid URL' })
  @ValidateIf((o) => o.linkedin !== '' && o.linkedin !== undefined)
  linkedin?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/johndoe' })
  @IsOptional()
  @IsUrl({}, { message: 'twitter must be a valid URL' })
  @ValidateIf((o) => o.twitter !== '' && o.twitter !== undefined)
  twitter?: string;

  @ApiPropertyOptional({ example: 'https://instagram.com/johndoe' })
  @IsOptional()
  @IsUrl({}, { message: 'instagram must be a valid URL' })
  @ValidateIf((o) => o.instagram !== '' && o.instagram !== undefined)
  instagram?: string;

  @ApiPropertyOptional({ example: 'https://facebook.com/johndoe' })
  @IsOptional()
  @IsUrl({}, { message: 'facebook must be a valid URL' })
  @ValidateIf((o) => o.facebook !== '' && o.facebook !== undefined)
  facebook?: string;

  @ApiPropertyOptional({ example: 'https://mywebsite.com' })
  @IsOptional()
  @IsUrl({}, { message: 'website must be a valid URL' })
  @ValidateIf((o) => o.website !== '' && o.website !== undefined)
  website?: string;
}

export class PainPointsDto {
  @ApiPropertyOptional({ description: 'Difficulty getting new customers' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  gettingCustomers?: boolean;

  @ApiPropertyOptional({ description: 'Difficulty with pricing' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  pricing?: boolean;

  @ApiPropertyOptional({ description: 'Difficulty negotiating with customers' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  negotiating?: boolean;

  @ApiPropertyOptional({ description: 'Difficulty getting referrals' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  referrals?: boolean;

  @ApiPropertyOptional({ description: 'Difficulty retaining customers' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  retaining?: boolean;

  @ApiPropertyOptional({ description: 'Difficulty executing plans consistently' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  executingPlans?: boolean;
}

export class UpdateProfileOnboardingDto {
  @ApiPropertyOptional({ description: 'Full name of the user', example: 'John Doe' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ description: 'Age of the user', example: 35 })
  @IsOptional()
  @IsInt()
  @Min(18, { message: 'Age must be at least 18' })
  @Max(120, { message: 'Age must be at most 120' })
  age?: number;

  @ApiPropertyOptional({
    description: 'Gender',
    enum: Gender,
    example: Gender.MALE,
  })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiPropertyOptional({
    description: 'Marital status',
    enum: MaritalStatus,
    example: MaritalStatus.MARRIED,
  })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiPropertyOptional({
    description: 'Business type',
    enum: BusinessType,
    example: BusinessType.Solopreneur,
  })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiPropertyOptional({
    description: 'Brief description of the business',
    example: 'I run a digital marketing agency focused on small businesses.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessDescription?: string;

  @ApiPropertyOptional({
    description: 'Social media handles and website',
    type: SocialHandlesDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => SocialHandlesDto)
  socialHandles?: SocialHandlesDto;

  @ApiPropertyOptional({
    description: 'Business challenges and pain points',
    type: PainPointsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => PainPointsDto)
  painPoints?: PainPointsDto;
}

export class ProfileOnboardingResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  age?: number;

  @ApiPropertyOptional({ enum: Gender })
  gender?: Gender;

  @ApiPropertyOptional({ enum: MaritalStatus })
  maritalStatus?: MaritalStatus;

  @ApiProperty({ enum: BusinessType })
  businessType: BusinessType;

  @ApiPropertyOptional()
  businessDescription?: string;

  @ApiPropertyOptional({ type: SocialHandlesDto })
  socialHandles?: SocialHandlesDto;

  @ApiPropertyOptional({ type: PainPointsDto })
  painPoints?: PainPointsDto;

  @ApiProperty()
  updatedAt: Date;
}
