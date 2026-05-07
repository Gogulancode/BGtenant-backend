import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { AcceptInviteDto } from "./dto/accept-invite.dto";
import { MfaCodeDto } from "./dto/mfa.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { Request } from "express";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @ApiOperation({ summary: "Register new user" })
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 registrations per minute
  @Post("register")
  async register(@Body() registerDto: RegisterDto, @Req() req: Request) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip;
    const ua = req.headers["user-agent"];
    return this.authService.register(registerDto, ip, ua);
  }

  @ApiOperation({ summary: "Login user" })
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 login attempts per minute
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto, @Req() req: Request) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip;
    const ua = req.headers["user-agent"];
    return this.authService.login(loginDto, ip, ua);
  }

  @ApiOperation({ summary: "Refresh access token" })
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 refreshes per minute
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip;
    const ua = req.headers["user-agent"];
    return this.authService.refreshTokens(dto, ip, ua);
  }

  @ApiOperation({ summary: "Logout user" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: UserContext) {
    await this.authService.logout(user.userId);
    return { message: "Logged out successfully" };
  }

  @ApiOperation({ summary: "Start MFA enrollment" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("mfa/enroll")
  async enrollMfa(@CurrentUser() user: UserContext) {
    return this.authService.generateMfaSetup(user.userId);
  }

  @ApiOperation({ summary: "Enable MFA" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("mfa/enable")
  async enableMfa(@CurrentUser() user: UserContext, @Body() dto: MfaCodeDto) {
    return this.authService.enableMfa(user.userId, dto.code);
  }

  @ApiOperation({ summary: "Disable MFA" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("mfa/disable")
  async disableMfa(@CurrentUser() user: UserContext, @Body() dto: MfaCodeDto) {
    return this.authService.disableMfa(user.userId, dto.code);
  }

  @ApiOperation({ summary: "Accept tenant invitation" })
  @Post("accept-invite")
  async acceptInvite(@Body() dto: AcceptInviteDto, @Req() req: Request) {
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip;
    const ua = req.headers["user-agent"];
    return this.authService.acceptInvite(dto, ip, ua);
  }

  @ApiOperation({ summary: "Get current user" })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async getMe(@CurrentUser() user: UserContext) {
    return user;
  }
}
