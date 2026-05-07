import { IsEmail, IsEnum, IsString, Matches, MinLength } from "class-validator";
import { BusinessType } from "@prisma/client";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({
    description:
      "Minimum 10 characters with uppercase, lowercase, number, and symbol",
  })
  @MinLength(10)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "Password must include uppercase, lowercase, number, and symbol characters.",
  })
  password: string;

  @ApiProperty({ enum: BusinessType })
  @IsEnum(BusinessType)
  businessType: BusinessType;
}
