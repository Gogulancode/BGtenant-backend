import { IsOptional, IsString, IsBoolean, MaxLength } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateBusinessSetupChecklistDto {
  @ApiPropertyOptional({ description: "USP defined step completed" })
  @IsOptional()
  @IsBoolean()
  uspDefined?: boolean;

  @ApiPropertyOptional({ description: "USP value", maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  uspValue?: string;

  @ApiPropertyOptional({ description: "Menu card defined step completed" })
  @IsOptional()
  @IsBoolean()
  menuCardDefined?: boolean;

  @ApiPropertyOptional({ description: "Menu card description", maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  menuCardValue?: string;

  @ApiPropertyOptional({ description: "Packages defined step completed" })
  @IsOptional()
  @IsBoolean()
  packagesDefined?: boolean;

  @ApiPropertyOptional({ description: "Packages description", maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  packagesValue?: string;

  @ApiPropertyOptional({ description: "Customer segment defined step completed" })
  @IsOptional()
  @IsBoolean()
  customerSegmentDefined?: boolean;

  @ApiPropertyOptional({ description: "Customer segment description", maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  customerSegmentValue?: string;
}
