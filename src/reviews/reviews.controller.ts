import { Controller, Get, Post, Body, Query, UseGuards } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
} from "@nestjs/swagger";
import { ReviewsService } from "./reviews.service";
import { CreateReviewDto, GetReviewsQueryDto } from "./dto/create-review.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import {
  CurrentUser,
  UserContext,
} from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import {
  TENANT_CONTRIBUTOR_ROLES,
  TENANT_MEMBER_ROLES,
} from "../common/constants/roles.constants";
import { ApiTenantAuth } from "../common/docs/swagger.decorators";

@ApiTags("Reviews")
@ApiTenantAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("reviews")
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  @ApiOperation({ summary: "Get reviews" })
  @ApiOkResponse({ description: "Reviews filtered by type" })
  @Get()
  @Roles(...TENANT_MEMBER_ROLES)
  async getReviews(
    @CurrentUser() user: UserContext,
    @Query() query: GetReviewsQueryDto,
  ) {
    return this.reviewsService.getReviews(
      user.userId,
      user.tenantId,
      query.type,
    );
  }

  @ApiOperation({ summary: "Create review" })
  @ApiCreatedResponse({ description: "Review created" })
  @Post()
  @Roles(...TENANT_CONTRIBUTOR_ROLES)
  async createReview(
    @CurrentUser() user: UserContext,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(
      user.userId,
      user.tenantId,
      createReviewDto,
    );
  }

  @ApiOperation({ summary: "Get review summary for dashboard" })
  @ApiOkResponse({ description: "Review dashboard summary" })
  @Get("summary")
  @Roles(...TENANT_MEMBER_ROLES)
  async getSummary(@CurrentUser() user: UserContext) {
    return this.reviewsService.getSummary(user.userId, user.tenantId);
  }
}
