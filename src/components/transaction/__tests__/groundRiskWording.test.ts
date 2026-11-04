// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { describe, it, expect } from 'vitest';
import {
  GROUND_RISK_SOURCES,
  coalMiningDetailText,
  coalMiningSummaryStatus,
  radonDetailText,
  radonSummaryStatus,
  surfaceWaterSummaryStatus,
  surfaceWaterDetailText,
  surfaceWaterSummaryText,
} from '../groundRiskWording';

describe('surface water wording', () => {
  it.each([
    ['high', 'high', 'High risk'],
    ['medium', 'medium', 'Medium risk'],
    ['low', 'low', 'Low risk'],
    ['very_low', 'low', 'Very low risk'],
  ] as const)('should show %s as a %s tile reading "%s"', (band, status, text) => {
    expect(surfaceWaterSummaryStatus({ band, confidence: null })).toBe(status);
    expect(surfaceWaterSummaryText({ band, confidence: null })).toBe(text);
  });

  it('should say the source is unavailable rather than imply no risk', () => {
    expect(surfaceWaterSummaryStatus(null)).toBe('unknown');
    expect(surfaceWaterSummaryText(null)).toBe('Source unavailable');
  });

  it('should explain the band as an annual chance', () => {
    expect(surfaceWaterDetailText({ band: 'high', confidence: 2 })).toContain('more than a 3.3% chance of flooding each year');
  });
});

describe('coal mining wording', () => {
  it('should send a high risk area to a CON29M search', () => {
    expect(coalMiningSummaryStatus({ inHighRiskArea: true })).toBe('high');
    expect(coalMiningDetailText({ inHighRiskArea: true })).toContain('CON29M');
  });

  it('should never call the area outside a high risk area risk-free', () => {
    const text = coalMiningDetailText({ inHighRiskArea: false });

    expect(text).toContain('coalfield is wider');
    expect(text.toLowerCase()).not.toContain('no risk');
  });

  it('should acknowledge the Mining Remediation Authority', () => {
    expect(GROUND_RISK_SOURCES.coalMining).toContain('Mining Remediation Authority');
  });
});

describe('radon wording', () => {
  it.each([
    [1, 'low'],
    [2, 'medium'],
    [3, 'medium'],
    [4, 'high'],
    [6, 'high'],
  ] as const)('should rate class %i as %s', (classMax, status) => {
    expect(radonSummaryStatus({ classMax, description: '', gridSquare: '' })).toBe(status);
  });

  it('should say it describes the 1 km square, not the home', () => {
    const text = radonDetailText({ classMax: 3, description: 'Some parts are elevated.', gridSquare: 'SX9292' });

    expect(text).toContain('1 km grid square (SX9292)');
    expect(text).toContain('not a measurement of this home');
  });

  it('should acknowledge the British Geological Survey', () => {
    expect(GROUND_RISK_SOURCES.radon).toContain('British Geological Survey');
  });
});
