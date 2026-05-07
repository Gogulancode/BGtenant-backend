import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { ReviewType } from "@prisma/client";
import { assertTenantContext } from "../common/utils/tenant.utils";

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async getReviews(
    userId: string,
    tenantId: string | null | undefined,
    type?: ReviewType,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    const where: any = { userId, tenantId: scopedTenantId };
    if (type) {
      where.type = type;
    }

    return this.prisma.review.findMany({
      where,
      orderBy: { date: "desc" },
    });
  }

  async createReview(
    userId: string,
    tenantId: string | null | undefined,
    createReviewDto: CreateReviewDto,
  ) {
    const scopedTenantId = assertTenantContext(tenantId);
    return this.prisma.review.create({
      data: {
        userId,
        tenantId: scopedTenantId,
        type: createReviewDto.type,
        mood: createReviewDto.mood,
        content: createReviewDto.content,
        date: createReviewDto.date
          ? new Date(createReviewDto.date)
          : new Date(),
      },
    });
  }

  async getSummary(userId: string, tenantId: string | null | undefined) {
    const scopedTenantId = assertTenantContext(tenantId);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const reviews = await this.prisma.review.findMany({
      where: { userId, tenantId: scopedTenantId, date: { gte: sevenDaysAgo } },
      orderBy: { date: "desc" },
      select: { id: true, type: true, mood: true, date: true, content: true },
    });

    const daily = reviews.filter(
      (review) => review.type === ReviewType.Daily,
    ).length;
    const weekly = reviews.filter(
      (review) => review.type === ReviewType.Weekly,
    ).length;
    const averageMood = reviews.length
      ? Number(
          (
            reviews.reduce((sum, review) => sum + (review.mood ?? 0), 0) /
            reviews.length
          ).toFixed(2),
        )
      : 0;

    return {
      lastSevenDays: reviews.length,
      daily,
      weekly,
      averageMood,
      lastReview: reviews[0] ?? null,
    };
  }
}
