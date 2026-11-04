// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Detail cards for the report's surface water, coal mining and radon checks. Wording lives in groundRiskWording.ts. */

import type { ReactElement } from 'react';

import type { CoalMiningRisk, RadonRisk, SurfaceWaterRisk } from '../../services/groundRiskService';

import {
  GROUND_RISK_SOURCES,
  coalMiningDetailText,
  coalMiningSummaryStatus,
  radonDetailText,
  radonSummaryStatus,
  surfaceWaterDetailText,
  surfaceWaterSummaryStatus,
} from './groundRiskWording';
import { DetailCard } from './PropertyIntelSections';

function Body({ text, source }: { text: string; source: string }): ReactElement {
  return (
    <>
      <p className="font-[DM_Sans] text-sm text-gray-700 dark:text-gray-300">{text}</p>
      <p className="mt-2 font-[DM_Sans] text-xs text-gray-400 dark:text-gray-500">{source}</p>
    </>
  );
}

export function SurfaceWaterSection({ data }: { data: SurfaceWaterRisk | null }): ReactElement {
  return (
    <DetailCard title="Surface water flood risk" status={data ? surfaceWaterSummaryStatus(data) : undefined}>
      <Body text={surfaceWaterDetailText(data)} source={GROUND_RISK_SOURCES.surfaceWater} />
    </DetailCard>
  );
}

export function CoalMiningSection({ data }: { data: CoalMiningRisk | null }): ReactElement {
  return (
    <DetailCard title="Coal mining" status={data ? coalMiningSummaryStatus(data) : undefined}>
      <Body text={coalMiningDetailText(data)} source={GROUND_RISK_SOURCES.coalMining} />
    </DetailCard>
  );
}

export function RadonSection({ data }: { data: RadonRisk | null }): ReactElement {
  return (
    <DetailCard title="Radon" status={data ? radonSummaryStatus(data) : undefined}>
      <Body text={radonDetailText(data)} source={GROUND_RISK_SOURCES.radon} />
    </DetailCard>
  );
}
