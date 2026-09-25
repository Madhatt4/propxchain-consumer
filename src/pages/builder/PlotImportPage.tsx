// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  plotImportService,
  CsvParseError,
  type ValidationResult,
} from '@/services/plotImport.service';
import { plotsService } from '@/services/plots.service';
import { plotTypesService, type PlotType } from '@/services/plot-types.service';
import { sitesService } from '@/services/sites.service';
import { listingsService } from '@/services/listings.service';
import { PlotImportDropzone } from '@/components/builder/PlotImportDropzone';
import { PlotImportPreviewTable } from '@/components/builder/PlotImportPreviewTable';
import { PlotImportResult } from '@/components/builder/PlotImportResult';

type Phase =
  | { kind: 'loading' }
  | { kind: 'upload'; parseError: string | null }
  | { kind: 'preview'; results: ValidationResult[]; importing: boolean; importError: string | null }
  | {
      kind: 'result';
      importedCount: number;
      skippedCount: number;
      publishedCount: number | null;
      publishFailures: number;
    };

export function PlotImportPage(): JSX.Element {
  const { siteId } = useParams<{ siteId: string }>();
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [plotTypes, setPlotTypes] = useState<PlotType[]>([]);
  const [existingPlotNumbers, setExistingPlotNumbers] = useState<Set<string>>(new Set());
  const [siteSlug, setSiteSlug] = useState<string>('');

  useEffect(() => {
    if (!siteId) return;
    (async () => {
      const [types, plots, site] = await Promise.all([
        plotTypesService.getBySite(siteId),
        plotsService.getBySite(siteId),
        sitesService.getById(siteId),
      ]);
      setPlotTypes(types);
      setExistingPlotNumbers(new Set(plots.map((p) => p.plot_number)));
      setSiteSlug(site.slug ?? '');
      setPhase({ kind: 'upload', parseError: null });
    })().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to load site';
      setPhase({ kind: 'upload', parseError: message });
    });
  }, [siteId]);

  const typesByName = useMemo(
    () => new Map(plotTypes.map((t) => [t.name.toLowerCase(), t])),
    [plotTypes],
  );

  function handleFileText(text: string): void {
    if (!siteId) return;
    try {
      const rows = plotImportService.parseCsv(text);
      const results = plotImportService.validateRows(
        rows,
        siteId,
        existingPlotNumbers,
        typesByName,
      );
      setPhase({ kind: 'preview', results, importing: false, importError: null });
    } catch (err) {
      const message =
        err instanceof CsvParseError ? err.message : 'Could not read CSV file';
      setPhase({ kind: 'upload', parseError: message });
    }
  }

  async function handleConfirm(publishImmediately: boolean): Promise<void> {
    if (phase.kind !== 'preview') return;
    setPhase({ ...phase, importing: true, importError: null });

    try {
      const validPayloads = phase.results
        .filter((r): r is Extract<ValidationResult, { status: 'valid' }> => r.status === 'valid')
        .map((r) => r.payload);

      const inserted = await plotsService.bulkCreate(validPayloads);

      let publishedCount: number | null = null;
      let publishFailures = 0;
      if (publishImmediately && inserted.length > 0) {
        const outcomes = await Promise.allSettled(
          inserted.map((p) => listingsService.publishPlot(p.id, siteSlug, p.plot_number)),
        );
        publishedCount = outcomes.filter((o) => o.status === 'fulfilled').length;
        publishFailures = outcomes.length - publishedCount;
      }

      setPhase({
        kind: 'result',
        importedCount: inserted.length,
        skippedCount: phase.results.length - inserted.length,
        publishedCount,
        publishFailures,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to import plots';
      setPhase({ ...phase, importing: false, importError: message });
    }
  }

  if (!siteId || phase.kind === 'loading') {
    return <div className="p-8">Loading…</div>;
  }

  const templateCsv = plotImportService.buildTemplate(plotTypes);
  const templateFilename = `plots-template-${siteSlug || 'site'}.csv`;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link to={`/builder/sites/${siteId}/plots`} className="text-teal-600 hover:text-teal-700 underline">
          ← Back to Plots
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Import plots from CSV</h1>
      </div>

      {phase.kind === 'upload' && (
        <PlotImportDropzone
          templateCsv={templateCsv}
          templateFilename={templateFilename}
          onFileSelected={handleFileText}
          parseError={phase.parseError}
        />
      )}

      {phase.kind === 'preview' && (
        <PlotImportPreviewTable
          results={phase.results}
          onCancel={() => setPhase({ kind: 'upload', parseError: null })}
          onConfirm={(publishImmediately) => void handleConfirm(publishImmediately)}
          importing={phase.importing}
          importError={phase.importError}
        />
      )}

      {phase.kind === 'result' && (
        <PlotImportResult
          siteId={siteId}
          importedCount={phase.importedCount}
          skippedCount={phase.skippedCount}
          publishedCount={phase.publishedCount}
          publishFailures={phase.publishFailures}
        />
      )}
    </div>
  );
}

export default PlotImportPage;
