export type GuidanceCardType = "next_action" | "insight" | "celebration";
export type GuidancePriority = "high" | "medium" | "low";
export type GuidanceSource = "setup" | "sales" | "crm" | "activity" | "profile";
export type GuidanceSignalStatus = "good" | "watch" | "risk";

export interface GuidanceSummaryDto {
  title: string;
  message: string;
  tone: "encouraging";
  healthScore: number;
}

export interface GuidanceCardDto {
  id: string;
  type: GuidanceCardType;
  priority: GuidancePriority;
  title: string;
  message: string;
  actionLabel: string;
  actionRoute: string;
  source: GuidanceSource;
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
