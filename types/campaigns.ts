export type CampaignPlatform = "google" | "meta";

export interface RunningCampaign {
  id: string;
  projectId: string;
  platform: CampaignPlatform;
  title: string;
  subtitle: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignInput {
  projectId: string;
  platform: CampaignPlatform;
  title: string;
  subtitle?: string;
}

export interface UpdateCampaignInput {
  title?: string;
  subtitle?: string;
  platform?: CampaignPlatform;
}

export interface CampaignListFilters {
  projectId?: string;
}
