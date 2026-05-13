export type GuidanceCardType = "next_action" | "insight" | "celebration";
export type GuidancePriority = "high" | "medium" | "low";
export type GuidanceSource = "setup" | "sales" | "crm" | "activity" | "profile";
export type GuidanceSignalStatus = "good" | "watch" | "risk";
export type GuidanceJourneyStage =
  | "Foundation"
  | "Rhythm"
  | "Pipeline"
  | "Growth"
  | "Scale";
export type GuidanceImpactMetric =
  | "setup_completion"
  | "weekly_sales"
  | "sales_gap"
  | "crm_pipeline"
  | "activity_rhythm"
  | "business_profile";

export interface GuidanceSummaryDto {
  title: string;
  message: string;
  tone: "encouraging";
  healthScore: number;
  journeyStage?: GuidanceJourneyStage;
}

export interface GuidanceCardDto {
  id: string;
  type: GuidanceCardType;
  priority: GuidancePriority;
  title: string;
  message: string;
  why?: string;
  actionLabel: string;
  actionRoute: string;
  source: GuidanceSource;
  impactMetric?: GuidanceImpactMetric;
  afterActionMessage?: string;
}

export interface GuidanceSignalDto {
  key: string;
  label: string;
  value: number;
  unit: "count" | "percent" | "currency";
  status: GuidanceSignalStatus;
}

export interface DashboardGuidanceDto {
  summary: GuidanceSummaryDto;
  cards: GuidanceCardDto[];
  signals: GuidanceSignalDto[];
  generatedAt: Date;
}
