import { Transform } from "class-transformer";
import { IsString, IsOptional, Length } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateOutcomeTemplateDto {
  @ApiProperty()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(3, 120)
  title: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  description?: string;
}

export class UpdateOutcomeTemplateDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  @Length(3, 120)
  title?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  @IsString()
  description?: string;
}
