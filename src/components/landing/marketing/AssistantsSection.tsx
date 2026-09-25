// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * "AI assistants" — which assistants can connect to PropXchain today. Status
 * comes from ASSISTANTS in ./data, where an assistant is marked available only
 * after a real connection has worked against the live connector.
 */

import { Link } from 'react-router-dom';

import { ASSISTANTS, MCP_CONNECTOR_URL } from './data';

export function AssistantsSection(): JSX.Element {
  return (
    <section
      id="assistants"
      className="section-pad divider-top"
      style={{ background: 'var(--ink)' }}
      data-screen-label="AI assistants"
    >
      <div className="wrap">
        <div className="reveal">
          <span className="eyebrow">AI assistants</span>
        </div>
        <h2 className="h-sec reveal">
          Your move, <span className="key">from your AI assistant.</span>
        </h2>
        <p className="lead reveal" style={{ maxWidth: '38rem', fontSize: '1rem', margin: '1.1rem 0 0' }}>
          Connect PropXchain to your AI assistant, then just ask: where is my sale up to, what is holding it up,
          which documents are still missing. It can also upload documents, message the other parties and start a
          new transaction for you.
        </p>

        <div className="px-g3 gap-5 mt-12">
          {ASSISTANTS.map((assistant) => (
            <div
              key={assistant.name}
              className={`card reveal${assistant.status === 'available' ? ' card-teal' : ''}`}
              style={{ padding: '1.6rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
              data-assistant-status={assistant.status}
            >
              <span
                className="num"
                style={{
                  fontSize: '0.7rem',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: assistant.status === 'available' ? 'var(--t)' : 'var(--fg-3)',
                }}
              >
                {assistant.statusLabel}
              </span>
              <h3 className="font-display" style={{ fontWeight: 700, fontSize: '1.15rem', margin: 0, color: 'var(--fg)' }}>
                {assistant.name}
              </h3>
              <p style={{ fontSize: '0.88rem', color: 'var(--fg-2)', lineHeight: 1.65, margin: 0 }}>{assistant.body}</p>
              {assistant.showsAddress && (
                <code
                  className="num"
                  style={{ fontSize: '0.8rem', color: 'var(--fg)', overflowWrap: 'anywhere', marginTop: 'auto' }}
                >
                  {MCP_CONNECTOR_URL}
                </code>
              )}
              {assistant.link && (
                <Link
                  to={assistant.link.path}
                  style={{ fontSize: '0.88rem', color: 'var(--t)', fontWeight: 600, marginTop: 'auto' }}
                >
                  {assistant.link.label} →
                </Link>
              )}
            </div>
          ))}
        </div>

        <p className="reveal" style={{ fontSize: '0.85rem', color: 'var(--fg-3)', margin: '1.75rem 0 0', maxWidth: '38rem' }}>
          Each connection gets its own identity on PropXchain and lasts 30 days before you approve it again. The
          changes it makes are recorded on-chain, like everything else in your transaction.
        </p>
      </div>
    </section>
  );
}
