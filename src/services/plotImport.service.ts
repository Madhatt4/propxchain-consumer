// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * CSV bulk plot upload — pure parse + validation.
 * Browser-layer validation is UX; the DB enforces the real constraints
 * (UNIQUE (site_id, plot_number), FOREIGN KEY plot_type_id).
 */

import Papa from 'papaparse';
import type { CreatePlotInput } from '@/services/plots.service';
import type { PlotType } from '@/services/plot-types.service';

export const MAX_ROWS_PER_IMPORT = 1000;

/** A single row as parsed from the CSV, keys lowercased + trimmed. */
export interface ParsedRow {
  plot_number: string;
  plot_type: string;
  price: string;
  completion_date: string;
  notes: string;
  features: string;
}

/** Per-row validation result. */
export type ValidationResult =
  | {
      rowIndex: number;
      raw: ParsedRow;
      status: 'valid';
      payload: CreatePlotInput;
    }
  | {
      rowIndex: number;
      raw: ParsedRow;
      status: 'invalid';
      error: string;
    };

/** Top-level parse error (missing header, unparseable file). */
export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

const REQUIRED_HEADERS = ['plot_number', 'plot_type'] as const;
const ALL_HEADERS = [
  'plot_number',
  'plot_type',
  'price',
  'completion_date',
  'notes',
  'features',
] as const;

export const plotImportService = {
  /** Parse a CSV string into typed rows. Throws CsvParseError on missing headers. */
  parseCsv(rawCsv: string): ParsedRow[] {
    const stripped = rawCsv.replace(/^\uFEFF/, '');
    const result = Papa.parse<Record<string, string>>(stripped, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'), // map "Plot Number" → plot_number so human-readable CSV headers match our field keys
      transform: (v) => (typeof v === 'string' ? v.trim() : v),
    });

    const headers = result.meta.fields ?? [];
    for (const required of REQUIRED_HEADERS) {
      if (!headers.includes(required)) {
        throw new CsvParseError(
          `CSV is missing required column "${required}"`,
        );
      }
    }

    return result.data.map((row) =>
      ALL_HEADERS.reduce(
        (acc, key) => ({ ...acc, [key]: row[key] ?? '' }),
        {} as ParsedRow,
      ),
    );
  },

  /** Validate parsed rows against site context. Pure function. */
  validateRows(
    rows: ParsedRow[],
    siteId: string,
    existingPlotNumbers: Set<string>,
    plotTypesByName: Map<string, PlotType>,
  ): ValidationResult[] {
    if (rows.length > MAX_ROWS_PER_IMPORT) {
      return rows.map((row, index) => ({
        rowIndex: index,
        raw: row,
        status: 'invalid' as const,
        error: `CSV has ${rows.length} rows — maximum is ${MAX_ROWS_PER_IMPORT} per import. Split the CSV.`,
      }));
    }

    const seenInCsv = new Map<string, number>();
    for (const row of rows) {
      if (row.plot_number) {
        seenInCsv.set(row.plot_number, (seenInCsv.get(row.plot_number) ?? 0) + 1);
      }
    }

    return rows.map((row, index) => {
      const invalid = (error: string): ValidationResult => ({
        rowIndex: index,
        raw: row,
        status: 'invalid',
        error,
      });

      if (!row.plot_number) return invalid('Plot number is required');
      if (!row.plot_type) return invalid('Plot type is required');
      if (existingPlotNumbers.has(row.plot_number)) {
        return invalid(`Plot number "${row.plot_number}" already exists on this site`);
      }
      if ((seenInCsv.get(row.plot_number) ?? 0) > 1) {
        return invalid(`Plot number "${row.plot_number}" appears twice in this CSV`);
      }
      const plotType = plotTypesByName.get(row.plot_type.toLowerCase());
      if (!plotType) {
        return invalid(
          `Unknown plot type "${row.plot_type}" — define it in Plot Types first`,
        );
      }

      let salePricePence: number | null = null;
      if (row.price) {
        if (!/^\d+$/.test(row.price)) {
          return invalid('Price must be a whole number of £ (no symbols, commas, or decimals)');
        }
        const pounds = Number(row.price);
        if (!Number.isFinite(pounds) || pounds < 0) {
          return invalid('Price must be a whole number of £ greater than or equal to 0');
        }
        salePricePence = pounds * 100;
      }

      let completion: string | null = null;
      if (row.completion_date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.completion_date)) {
          return invalid('Completion date must be YYYY-MM-DD');
        }
        const parsed = new Date(row.completion_date + 'T00:00:00Z');
        if (Number.isNaN(parsed.getTime())) {
          return invalid('Completion date is not a real calendar date');
        }
        // Guard against dates like 2026-02-31 that Date silently rolls over.
        if (parsed.toISOString().slice(0, 10) !== row.completion_date) {
          return invalid('Completion date is not a real calendar date');
        }
        completion = row.completion_date;
      }

      if (row.notes && row.notes.length > 500) {
        return invalid('Notes must be 500 characters or fewer');
      }

      const features = row.features
        ? row.features.split(';').map((f) => f.trim()).filter(Boolean)
        : [];

      return {
        rowIndex: index,
        raw: row,
        status: 'valid',
        payload: {
          site_id: siteId,
          plot_type_id: plotType.id,
          plot_number: row.plot_number,
          sale_price_pence: salePricePence,
          expected_practical_completion: completion,
          description_addendum: row.notes || null,
          features_addendum: features,
        },
      };
    });
  },

  /** Build a per-site template CSV string. */
  buildTemplate(plotTypes: PlotType[]): string {
    const header = 'plot_number,plot_type,price,completion_date,notes,features';

    // RFC 4180: wrap fields containing comma, quote, or newline in quotes; double-up inner quotes.
    const escapeField = (s: string): string =>
      /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

    const exampleTypes =
      plotTypes.length > 0
        ? plotTypes.slice(0, 2).map((t) => t.name)
        : ['YOUR_PLOT_TYPE_NAME', 'YOUR_PLOT_TYPE_NAME'];

    const row1 = `1,${escapeField(exampleTypes[0])},,,,`;
    const row2 = `2,${escapeField(exampleTypes[1] ?? exampleTypes[0])},300000,2026-09-01,Corner plot,South-facing garden; EV charger`;
    return `${header}\n${row1}\n${row2}\n`;
  },
};
