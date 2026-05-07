import { Transform } from "class-transformer";
import { IsString, IsOptional, Length, IsEnum } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export enum ActivityTemplateCategory {
  SALES = "Sales",
  MARKETING = "Marketing",
  PRODUCT = "Product",
  OPERATIONS = "Operations",
  OTHER = "Other",
}

export class CreateActivityTemplateDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(3, 100)
  name: string;

  @ApiProperty({ required: false, enum: ActivityTemplateCategory })
  @IsOptional()
  @IsEnum(ActivityTemplateCategory)
  category?: ActivityTemplateCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  frequency?: string;
}

export class UpdateActivityTemplateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(3, 100)
  name?: string;

  @ApiProperty({ required: false, enum: ActivityTemplateCategory })
  @IsOptional()
  @IsEnum(ActivityTemplateCategory)
  category?: ActivityTemplateCategory;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  frequency?: string;
}
