import type { ServiceProvider } from './provider.types';

export type StageStatus = 'completed' | 'active' | 'locked' | 'watching';
export type JourneyRole = 'seller' | 'buyer';

export interface StageConfig {
  id: string;
  order: number;
  title: string;
  description: string;
  status: StageStatus;
  journeyRole: JourneyRole;
  prerequisiteStageIds: string[];
  hasProviderMarketplace: boolean;
  providerCategory?: ServiceProvider['category'];
  costPence?: number;
  completedAt?: number;
  serviceMode: 'real-read' | 'real-readwrite' | 'mock';
  serviceKey?: 'rightmove' | 'searchflow' | 'conveyancer';
}
