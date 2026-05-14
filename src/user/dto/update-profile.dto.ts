import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BusinessType, Gender, MaritalStatus } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class SocialHandlesDto {
  @ApiProperty({ required: false, example: "https://linkedin.com/in/yourname" })
  @IsOptional()
  @IsUrl({}, { message: "LinkedIn URL must be a valid URL" })
  linkedin?: string;

  @ApiProperty({ required: false, example: "https://twitter.com/yourhandle" })
  @IsOptional()
  @IsUrl({}, { message: "Twitter URL must be a valid URL" })
  twitter?: string;

  @ApiProperty({ required: false, example: "https://instagram.com/yourhandle" })
  @IsOptional()
  @IsUrl({}, { message: "Instagram URL must be a valid URL" })
  instagram?: string;

  @ApiProperty({ required: false, example: "https://yourwebsite.com" })
  @IsOptional()
  @IsUrl({}, { message: "Website must be a valid URL" })
  website?: string;
}

export class PainPointsDto {
  @ApiProperty({
    required: false,
    description: "Difficulty getting new customers",
  })
  @IsOptional()
  @IsBoolean()
  gettingCustomers?: boolean;

  @ApiProperty({ required: false, description: "Difficulty with pricing" })
  @IsOptional()
  @IsBoolean()
  pricing?: boolean;

  @ApiProperty({
    required: false,
    description: "Difficulty negotiating with clients",
  })
  @IsOptional()
  @IsBoolean()
  negotiating?: boolean;

  @ApiProperty({ required: false, description: "Difficulty getting referrals" })
  @IsOptional()
  @IsBoolean()
  referrals?: boolean;

  @ApiProperty({
    required: false,
    description: "Difficulty retaining existing customers",
  })
  @IsOptional()
  @IsBoolean()
  retaining?: boolean;

  @ApiProperty({ required: false, description: "Difficulty executing plans" })
  @IsOptional()
  @IsBoolean()
  executingPlans?: boolean;
}

export class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(18)
  @Max(120)
  age?: number;

  @ApiProperty({ enum: Gender, required: false })
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ enum: MaritalStatus, required: false })
  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @ApiProperty({ enum: BusinessType, required: false })
  @IsOptional()
  @IsEnum(BusinessType)
  businessType?: BusinessType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  businessDescription?: string;

  @ApiProperty({ required: false, type: SocialHandlesDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SocialHandlesDto)
  socialHandles?: SocialHandlesDto;

  @ApiProperty({ required: false, type: PainPointsDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PainPointsDto)
  painPoints?: PainPointsDto;
}
