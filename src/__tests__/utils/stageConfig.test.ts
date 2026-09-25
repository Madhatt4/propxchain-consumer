import { describe, it, expect } from 'vitest';
import {
  getSellerStages,
  getBuyerStages,
  getStagesForJourney,
  PROPXCHAIN_FEE_PENCE,
  MILESTONE_TO_STAGE_ID,
} from '../../utils/stageConfig';

describe('getSellerStages', () => {
  it('should return exactly 7 seller stages', () => {
    expect(getSellerStages()).toHaveLength(7);
  });

  it('should return stages in ascending order', () => {
    const stages = getSellerStages();
    stages.forEach((stage, index) => {
      expect(stage.order).toBe(index + 1);
    });
  });

  it('should use seller-N ID convention', () => {
    const stages = getSellerStages();
    stages.forEach((stage, index) => {
      expect(stage.id).toBe(`seller-${index + 1}`);
    });
  });

  it('should have seller journeyRole on all stages', () => {
    getSellerStages().forEach((stage) => {
      expect(stage.journeyRole).toBe('seller');
    });
  });
});

describe('getBuyerStages', () => {
  it('should return exactly 7 buyer stages', () => {
    expect(getBuyerStages()).toHaveLength(7);
  });

  it('should return stages in ascending order', () => {
    const stages = getBuyerStages();
    stages.forEach((stage, index) => {
      expect(stage.order).toBe(index + 1);
    });
  });

  it('should use buyer-N ID convention', () => {
    const stages = getBuyerStages();
    stages.forEach((stage, index) => {
      expect(stage.id).toBe(`buyer-${index + 1}`);
    });
  });

  it('should have buyer journeyRole on all stages', () => {
    getBuyerStages().forEach((stage) => {
      expect(stage.journeyRole).toBe('buyer');
    });
  });
});

describe('cross-journey dependencies', () => {
  it('buyer-4 should gate only on the seller property info forms (seller-3), not searches (seller-2)', () => {
    const stages = getBuyerStages();
    const buyerReviewStage = stages.find((s) => s.id === 'buyer-4');
    expect(buyerReviewStage).toBeDefined();
    expect(buyerReviewStage?.prerequisiteStageIds).toContain('seller-3');
    // Searches (seller-2) are ordered later, buyer/solicitor-side, and are not
    // self-serve on the starter flow — gating the buyer's Review on them
    // deadlocked the buyer on "Waiting…".
    expect(buyerReviewStage?.prerequisiteStageIds).not.toContain('seller-2');
  });
});

describe('parallel stages', () => {
  it('seller-2 and seller-3 should not depend on each other', () => {
    const stages = getSellerStages();
    const seller2 = stages.find((s) => s.id === 'seller-2');
    const seller3 = stages.find((s) => s.id === 'seller-3');

    expect(seller2?.prerequisiteStageIds).not.toContain('seller-3');
    expect(seller3?.prerequisiteStageIds).not.toContain('seller-2');
  });
});

describe('PROPXCHAIN_FEE_PENCE', () => {
  it('should equal 7500', () => {
    expect(PROPXCHAIN_FEE_PENCE).toBe(7500);
  });
});

describe('getStagesForJourney', () => {
  it('should return seller stages when role is seller', () => {
    expect(getStagesForJourney('seller')).toEqual(getSellerStages());
  });

  it('should return buyer stages when role is buyer', () => {
    expect(getStagesForJourney('buyer')).toEqual(getBuyerStages());
  });
});

describe('MILESTONE_TO_STAGE_ID', () => {
  const allValidStageIds = new Set([
    ...getSellerStages().map((s) => s.id),
    ...getBuyerStages().map((s) => s.id),
  ]);

  it('should map every milestone to a valid stage ID', () => {
    Object.entries(MILESTONE_TO_STAGE_ID).forEach(([milestone, stageId]) => {
      expect(
        allValidStageIds.has(stageId),
        `Milestone "${milestone}" maps to unknown stage ID "${stageId}"`,
      ).toBe(true);
    });
  });

  it('should have 14 milestone mappings (7 seller + 7 buyer)', () => {
    expect(Object.keys(MILESTONE_TO_STAGE_ID)).toHaveLength(14);
  });
});
