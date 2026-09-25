import { describe, it, expect } from 'vitest';
import { plotImportService, CsvParseError } from './plotImport.service';
import type { PlotType } from './plot-types.service';

describe('plotImportService.parseCsv', () => {
  it('parses a minimal happy-path CSV', () => {
    const csv = `plot_number,plot_type
1,The Ashbourne
2,The Ashbourne`;
    const rows = plotImportService.parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ plot_number: '1', plot_type: 'The Ashbourne' });
  });

  it('lowercases and trims header whitespace', () => {
    const csv = `  Plot Number , Plot Type
1,The Ashbourne`;
    const rows = plotImportService.parseCsv(csv);
    expect(rows[0].plot_number).toBe('1');
    expect(rows[0].plot_type).toBe('The Ashbourne');
  });

  it('strips UTF-8 BOM', () => {
    const csv = '\uFEFFplot_number,plot_type\n1,The Ashbourne';
    const rows = plotImportService.parseCsv(csv);
    expect(rows[0].plot_number).toBe('1');
  });

  it('handles CRLF line endings', () => {
    const csv = 'plot_number,plot_type\r\n1,The Ashbourne\r\n2,The Ashbourne\r\n';
    expect(plotImportService.parseCsv(csv)).toHaveLength(2);
  });

  it('treats missing optional columns as empty strings', () => {
    const csv = `plot_number,plot_type
1,The Ashbourne`;
    const rows = plotImportService.parseCsv(csv);
    expect(rows[0].price).toBe('');
    expect(rows[0].features).toBe('');
  });

  it('throws CsvParseError when plot_number header is missing', () => {
    const csv = `plot_no,plot_type
1,The Ashbourne`;
    expect(() => plotImportService.parseCsv(csv)).toThrow(CsvParseError);
    expect(() => plotImportService.parseCsv(csv)).toThrow(/plot_number/);
  });

  it('throws CsvParseError when plot_type header is missing', () => {
    const csv = `plot_number,type
1,The Ashbourne`;
    expect(() => plotImportService.parseCsv(csv)).toThrow(/plot_type/);
  });

  it('trims whitespace from cell values', () => {
    const csv = `plot_number,plot_type
  1  ,  The Ashbourne  `;
    const rows = plotImportService.parseCsv(csv);
    expect(rows[0].plot_number).toBe('1');
    expect(rows[0].plot_type).toBe('The Ashbourne');
  });
});

function makePlotType(id: string, name: string, basePricePence = 29500000): PlotType {
  return {
    id,
    site_id: 'site-1',
    name,
    description: null,
    bedrooms: null,
    bathrooms: null,
    internal_area_sqft: null,
    base_price_pence: basePricePence,
    epc_rating: null,
    floor_plan_image_refs: [],
    exterior_image_refs: [],
    interior_image_refs: [],
    features: [],
    created_at: '',
    updated_at: '',
  };
}

const ashbourne = makePlotType('pt-1', 'The Ashbourne');
const typesByName = new Map<string, PlotType>([['the ashbourne', ashbourne]]);

describe('plotImportService.validateRows', () => {
  it('marks a fully valid row with inherited price', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type\n1,The Ashbourne',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('valid');
    if (results[0].status === 'valid') {
      expect(results[0].payload).toMatchObject({
        site_id: 'site-1',
        plot_number: '1',
        plot_type_id: 'pt-1',
      });
    }
  });

  it('rejects a row with empty plot_number', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type\n ,The Ashbourne',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('invalid');
    if (results[0].status === 'invalid') {
      expect(results[0].error).toMatch(/plot number is required/i);
    }
  });

  it('rejects a row with empty plot_type', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type\n1,',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('invalid');
    if (results[0].status === 'invalid') {
      expect(results[0].error).toMatch(/plot type is required/i);
    }
  });

  it('rejects a row whose plot_number already exists on the site', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type\nA12,The Ashbourne',
    );
    const existing = new Set(['A12']);
    const results = plotImportService.validateRows(rows, 'site-1', existing, typesByName);
    expect(results[0].status).toBe('invalid');
    if (results[0].status === 'invalid') {
      expect(results[0].error).toMatch(/already exists/i);
    }
  });

  it('rejects both rows when plot_number is duplicated within the CSV', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type\nA12,The Ashbourne\nA12,The Ashbourne',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('invalid');
    expect(results[1].status).toBe('invalid');
    if (results[0].status === 'invalid') {
      expect(results[0].error).toMatch(/appears twice/i);
    }
  });

  it('accepts a valid price and maps it to sale_price_pence', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type,price\n1,The Ashbourne,295000',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('valid');
    if (results[0].status === 'valid') {
      expect(results[0].payload.sale_price_pence).toBe(29500000);
    }
  });

  it.each([['£295,000'], ['295k'], ['-5'], ['295.50'], ['abc']])(
    'rejects malformed price %s',
    (badPrice) => {
      const rows = plotImportService.parseCsv(
        `plot_number,plot_type,price\n1,The Ashbourne,${badPrice}`,
      );
      const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
      expect(results[0].status).toBe('invalid');
      if (results[0].status === 'invalid') {
        expect(results[0].error).toMatch(/price/i);
      }
    },
  );

  it('accepts a valid ISO completion_date', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type,completion_date\n1,The Ashbourne,2026-09-01',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('valid');
    if (results[0].status === 'valid') {
      expect(results[0].payload.expected_practical_completion).toBe('2026-09-01');
    }
  });

  it.each([['1/9/26'], ['2026-13-01'], ['not-a-date']])(
    'rejects malformed completion_date %s',
    (badDate) => {
      const rows = plotImportService.parseCsv(
        `plot_number,plot_type,completion_date\n1,The Ashbourne,${badDate}`,
      );
      const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
      expect(results[0].status).toBe('invalid');
      if (results[0].status === 'invalid') {
        expect(results[0].error).toMatch(/date/i);
      }
    },
  );

  it('rejects notes longer than 500 chars', () => {
    const longNote = 'x'.repeat(501);
    const rows = plotImportService.parseCsv(
      `plot_number,plot_type,notes\n1,The Ashbourne,${longNote}`,
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('invalid');
  });

  it('splits features on semicolon and trims whitespace', () => {
    const rows = plotImportService.parseCsv(
      'plot_number,plot_type,features\n1,The Ashbourne,South-facing garden; EV charger ;Solar panels',
    );
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results[0].status).toBe('valid');
    if (results[0].status === 'valid') {
      expect(results[0].payload.features_addendum).toEqual([
        'South-facing garden',
        'EV charger',
        'Solar panels',
      ]);
    }
  });
});

describe('MAX_ROWS_PER_IMPORT', () => {
  it('validateRows flags every row as invalid when row count exceeds limit', () => {
    const header = 'plot_number,plot_type\n';
    const body = Array.from({ length: 1001 }, (_, i) => `${i + 1},The Ashbourne`).join('\n');
    const rows = plotImportService.parseCsv(header + body);
    const results = plotImportService.validateRows(rows, 'site-1', new Set(), typesByName);
    expect(results).toHaveLength(1001);
    expect(results.every((r) => r.status === 'invalid')).toBe(true);
    expect((results[0] as { error: string }).error).toMatch(/maximum is 1000/i);
  });
});

describe('plotImportService.buildTemplate', () => {
  it('outputs headers plus example rows using the site\'s plot type names', () => {
    const plotTypes = [
      makePlotType('pt-1', 'The Ashbourne'),
      makePlotType('pt-2', 'The Oakwood'),
    ];
    const template = plotImportService.buildTemplate(plotTypes);
    expect(template).toMatch(/^plot_number,plot_type,price,completion_date,notes,features\r?\n/);
    expect(template).toContain('The Ashbourne');
    expect(template).toContain('The Oakwood');
  });

  it('falls back to a placeholder when the site has no plot types', () => {
    const template = plotImportService.buildTemplate([]);
    expect(template).toContain('plot_number,plot_type');
    expect(template.trim().split(/\r?\n/).length).toBeGreaterThan(1);
  });

  it('escapes plot type names containing commas or quotes', () => {
    const plotTypes = [makePlotType('pt-1', 'The Chelsea, 2 Bed')];
    const template = plotImportService.buildTemplate(plotTypes);
    // The template must be re-parseable as valid CSV with the name preserved.
    const reparsed = plotImportService.parseCsv(template);
    expect(reparsed[0].plot_type).toBe('The Chelsea, 2 Bed');
  });
});
