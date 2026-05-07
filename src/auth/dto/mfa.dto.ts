import { ApiProperty } from "@nestjs/swagger";
import { IsString, Matches } from "class-validator";

export class MfaCodeDto {
  @ApiProperty({ description: "6-digit TOTP code" })
  @IsString()
  @Matches(/^\d{6}$/)
  code: string;
}
