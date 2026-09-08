export interface CreatorPricingFactors {
  followers: number;
  engagementRate: number; // e.g. 3.5%
  localRelevance: number; // 0 to 100
  creatorScore: number;   // 0 to 100
  mediaValueScore: number;// 0 to 100
}

export interface CreatorPricingRule {
  version: number;
  baseStoryCredits: number;
  baseFeedCredits: number;
  baseReelCredits: number;
  basePackageCredits: number;
  followerFactorPer10k: number;
  engagementWeight: number;
  localRelevanceWeight: number;
  creatorScoreWeight: number;
  mediaValueWeight: number;
  minPriceCredits: number;
  maxPriceCredits: number;
}

export const DEFAULT_CREATOR_PRICING_RULE: CreatorPricingRule = {
  version: 1,
  baseStoryCredits: 50.0,
  baseFeedCredits: 100.0,
  baseReelCredits: 150.0,
  basePackageCredits: 250.0,
  followerFactorPer10k: 15.0,
  engagementWeight: 0.25,
  localRelevanceWeight: 0.35,
  creatorScoreWeight: 0.20,
  mediaValueWeight: 0.20,
  minPriceCredits: 20.0,
  maxPriceCredits: 5000.0,
};

export type ContentFormat = 'story' | 'feed' | 'reel' | 'package';

export function calculateCreatorDynamicPrice(
  format: ContentFormat,
  factors: CreatorPricingFactors,
  rule: CreatorPricingRule = DEFAULT_CREATOR_PRICING_RULE
): {
  suggestedPriceCredits: number;
  basePriceCredits: number;
  calculatedPriceCredits: number;
  factors: CreatorPricingFactors;
  ruleVersion: number;
} {
  let basePrice = rule.baseFeedCredits;
  switch (format) {
    case 'story':
      basePrice = rule.baseStoryCredits;
      break;
    case 'reel':
      basePrice = rule.baseReelCredits;
      break;
    case 'package':
      basePrice = rule.basePackageCredits;
      break;
    case 'feed':
    default:
      basePrice = rule.baseFeedCredits;
      break;
  }

  const followers = Math.max(0, factors.followers || 0);
  const engagement = Math.max(0, factors.engagementRate || 0);
  const localRel = Math.max(0, Math.min(100, factors.localRelevance || 50));
  const creatorScore = Math.max(0, Math.min(100, factors.creatorScore || 50));
  const mediaScore = Math.max(0, Math.min(100, factors.mediaValueScore || 50));

  // Cálculo ponderado estável
  const followerComponent = (followers / 10000.0) * rule.followerFactorPer10k;
  const qualityMultiplier =
    1.0 +
    (engagement / 100.0) * rule.engagementWeight +
    (localRel / 100.0) * rule.localRelevanceWeight +
    (creatorScore / 100.0) * rule.creatorScoreWeight +
    (mediaScore / 100.0) * rule.mediaValueWeight;

  const rawCalculated = basePrice + followerComponent * qualityMultiplier;
  const clamped = Math.max(rule.minPriceCredits, Math.min(rule.maxPriceCredits, Math.round(rawCalculated * 100) / 100));

  return {
    suggestedPriceCredits: clamped,
    basePriceCredits: basePrice,
    calculatedPriceCredits: Math.round(rawCalculated * 100) / 100,
    factors: {
      followers,
      engagementRate: engagement,
      localRelevance: localRel,
      creatorScore,
      mediaValueScore: mediaScore,
    },
    ruleVersion: rule.version,
  };
}
