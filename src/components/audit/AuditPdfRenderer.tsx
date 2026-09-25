/**
 * Audit PDF Renderer — hidden DOM element for html2pdf export
 * Uses inline styles only (html2pdf renders from DOM, not Tailwind)
 */

import React, { forwardRef } from 'react';
import { logger } from '@/utils/logger';
import type { AuditReport, DocumentAuditEntry, AuditEvent } from '../../services/transactionAudit';
import { groupEventsIntoMilestones } from '../../services/transactionAudit';

interface AuditPdfRendererProps {
  report: AuditReport;
}

const STYLES = {
  page: { width: '210mm', fontFamily: 'DM Sans, sans-serif', color: '#1a1a1a', padding: '20mm' },
  heading: { fontFamily: 'Fraunces, serif', margin: '16px 0 8px', fontSize: '18px' },
  subheading: { fontFamily: 'Fraunces, serif', margin: '12px 0 6px', fontSize: '14px' },
  mono: { fontFamily: 'Geist Mono, monospace', fontSize: '11px', wordBreak: 'break-all' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: '12px', marginBottom: '12px' },
  th: { textAlign: 'left' as const, borderBottom: '1px solid #ddd', padding: '4px 8px', fontWeight: 600 },
  td: { borderBottom: '1px solid #eee', padding: '4px 8px' },
  badge: { display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' },
  divider: { borderTop: '1px solid #e5e5e5', margin: '16px 0' },
} as const;

function statusBadgeColor(status: string): string {
  if (status === 'verified') return '#059669';
  if (status === 'warning') return '#d97706';
  return '#dc2626';
}

function formatTs(ns: number): string {
  const ms = ns > 1e15 ? ns / 1_000_000 : ns;
  return new Date(ms).toLocaleString('en-GB');
}

const Header: React.FC = () => (
  <div style={{ borderBottom: '2px solid #0D9488', paddingBottom: '12px', marginBottom: '16px' }}>
    <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '22px', color: '#0D9488', margin: 0 }}>
      PropXchain Transaction Audit Report
    </h1>
    <p style={{ fontSize: '11px', color: '#666', margin: '4px 0 0' }}>
      Company No. 17018978 &bull; Blockchain-verified property conveyancing
    </p>
  </div>
);

const EventSection: React.FC<{ events: AuditEvent[] }> = ({ events }) => {
  const milestones = groupEventsIntoMilestones(events);
  return (
    <div>
      <h2 style={STYLES.heading}>Event Timeline</h2>
      {milestones.map(m => (
        <div key={m.name} style={{ marginBottom: '8px' }}>
          <h3 style={STYLES.subheading}>{m.name} ({m.events.length})</h3>
          {m.events.map(e => (
            <div key={e.eventId} style={{ marginLeft: '12px', marginBottom: '4px' }}>
              <span style={{ fontSize: '11px', color: '#666' }}>{formatTs(e.timestamp)}</span>
              <span style={{ fontSize: '12px', marginLeft: '8px' }}>{e.details}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

const DocSection: React.FC<{ docs: DocumentAuditEntry[] }> = ({ docs }) => (
  <div>
    <h2 style={STYLES.heading}>Document Inventory</h2>
    <table style={STYLES.table}>
      <thead>
        <tr>
          <th style={STYLES.th}>Document</th>
          <th style={STYLES.th}>Type</th>
          <th style={STYLES.th}>Hash</th>
          <th style={STYLES.th}>Size</th>
        </tr>
      </thead>
      <tbody>
        {docs.map(d => (
          <tr key={d.id}>
            <td style={STYLES.td}>{d.fileName}</td>
            <td style={STYLES.td}>{d.docType}</td>
            <td style={{ ...STYLES.td, ...STYLES.mono }}>{d.fileHash}</td>
            <td style={STYLES.td}>{d.fileSize} B</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const AuditPdfRenderer = forwardRef<HTMLDivElement, AuditPdfRendererProps>(
  ({ report }, ref) => {
    const integrity = report.integrityVerification;

    return (
      <div ref={ref} style={{ ...STYLES.page, display: 'none' }}>
        <Header />

        {/* Meta */}
        <p style={{ fontSize: '12px' }}>
          <strong>Transaction ID:</strong>{' '}
          <span style={STYLES.mono}>{report.transactionId}</span>
        </p>
        <p style={{ fontSize: '12px' }}>
          <strong>Generated:</strong> {report.reportGeneratedAt}
        </p>

        <div style={STYLES.divider} />

        {/* Integrity */}
        <h2 style={STYLES.heading}>Integrity Verification</h2>
        <p>
          <span
            style={{
              ...STYLES.badge,
              color: '#fff',
              backgroundColor: statusBadgeColor(integrity.overallStatus),
            }}
          >
            {integrity.overallStatus.toUpperCase()}
          </span>
        </p>
        <p style={{ fontSize: '12px' }}>
          Document hashes verified: {integrity.documentHashesVerified ? 'Yes' : 'No'}
        </p>

        <div style={STYLES.divider} />

        {/* Canister IDs */}
        <h2 style={STYLES.heading}>Canister IDs Queried</h2>
        <ul style={{ fontSize: '12px', paddingLeft: '20px' }}>
          {report.dataSources.blockchain.canistersQueried.map(c => (
            <li key={c}>{c}</li>
          ))}
        </ul>

        <div style={STYLES.divider} />

        {/* Events */}
        {report.blockchainEventLog.length > 0 && (
          <EventSection events={report.blockchainEventLog} />
        )}

        <div style={STYLES.divider} />

        {/* Documents */}
        {report.documents.length > 0 && <DocSection docs={report.documents} />}

        <div style={STYLES.divider} />

        {/* Parties */}
        <h2 style={STYLES.heading}>Party Principals</h2>
        {report.parties.map((p, i) => (
          <p key={i} style={{ fontSize: '12px' }}>
            <strong>{String(p.role ?? 'Party')}:</strong>{' '}
            <span style={STYLES.mono}>{String(p.principal ?? 'N/A')}</span>
          </p>
        ))}

        <div style={STYLES.divider} />

        {/* Footer */}
        <div style={{ borderTop: '2px solid #0D9488', paddingTop: '12px', marginTop: '24px' }}>
          {report.reportHash && (
            <p style={{ ...STYLES.mono, fontSize: '10px', color: '#666' }}>
              Report SHA-256: {report.reportHash}
            </p>
          )}
          <p style={{ fontSize: '10px', color: '#666', marginTop: '4px' }}>
            Verify this report by re-querying the Internet Computer canisters listed above
            with the same transaction ID. The SHA-256 hash covers all report data except itself.
          </p>
        </div>
      </div>
    );
  }
);

AuditPdfRenderer.displayName = 'AuditPdfRenderer';

export async function exportAuditPdf(
  containerRef: React.RefObject<HTMLDivElement | null>
): Promise<void> {
  if (!containerRef.current) return;

  try {
    await document.fonts.ready;

    const el = containerRef.current;
    el.style.display = 'block';

    const html2pdf = (await import('html2pdf.js')).default;
    await html2pdf()
      .set({
        margin: 0,
        filename: 'propxchain-audit-report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(el)
      .save();

    el.style.display = 'none';
  } catch (err) {
    logger.error('PDF export failed', { error: err });
    throw err;
  }
}

export default AuditPdfRenderer;
