// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * Narration call for the searches explainer, via OpenRouter.
 *
 * A plain synchronous chat completion, unlike move-narrator's Managed Agent:
 * this card renders on stage open and cannot wait on a fire/poll/deliver
 * cycle. Every failure path returns null and the card falls back to its
 * deterministic content, so nothing here is load-bearing for correctness.
 */

import OpenAI from 'npm:openai@4.104.0';

import { EXPLAINER_RUBRIC } from './rubric.ts';
import type { ExplainerAnalysis } from './types.ts';

const MODEL = 'deepseek/deepseek-v4-flash-0731';

const NARRATION_SCHEMA = {
  type: 'object',
  properties: {
    paragraphs: { type: 'array', items: { type: 'string' }, maxItems: 3 },
  },
  required: ['paragraphs'],
  additionalProperties: false,
} as const;

export async function generateNarration(
  apiKey: string,
  analysis: ExplainerAnalysis,
): Promise<string[] | null> {
  const client = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://propxchain.com',
      'X-Title': 'PropXchain',
    },
  });

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1000,
    temperature: 0.3,
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'narration', strict: true, schema: NARRATION_SCHEMA },
    },
    // The rubric is invariant across every call and MUST stay first, as its own
    // system message — never concatenated with the per-call analysis. DeepSeek
    // does automatic prefix caching, so an unchanging leading prefix is what
    // earns the discount. Same rule as the Anthropic cache_control breakpoint
    // it replaces. scripts/check-explainer-rubric.sh enforces it.
    messages: [
      { role: 'system', content: EXPLAINER_RUBRIC },
      { role: 'user', content: JSON.stringify(analysis) },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as { paragraphs?: unknown };
    if (!Array.isArray(parsed.paragraphs)) return null;
    const paragraphs = parsed.paragraphs.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    );
    return paragraphs.length > 0 ? paragraphs : null;
  } catch {
    return null;
  }
}
