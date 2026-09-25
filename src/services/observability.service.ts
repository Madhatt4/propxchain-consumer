// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

/**
 * Structured logging helper for observability.
 * TODO: Add edge function log sink for production monitoring.
 */

interface LogEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
}

interface StructuredPayload {
  timestamp: string;
  level: string;
  message: string;
  correlationId: string | null;
  context: Record<string, unknown> | null;
}

function formatPayload(event: LogEvent): StructuredPayload {
  return {
    timestamp: new Date().toISOString(),
    level: event.level,
    message: event.message,
    correlationId: event.correlationId ?? null,
    context: event.context ?? null,
  };
}

function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${random}`;
}

export const observability = {
  log(event: LogEvent): void {
    const payload = formatPayload(event);
    // TODO: Send to edge function log sink when available
    switch (event.level) {
      case 'info':
        // eslint-disable-next-line no-console
        console.log(JSON.stringify(payload));
        break;
      case 'warn':
        console.warn(JSON.stringify(payload));
        break;
      case 'error':
        console.error(JSON.stringify(payload));
        break;
    }
  },

  info(message: string, context?: Record<string, unknown>): void {
    observability.log({ level: 'info', message, context });
  },

  warn(message: string, context?: Record<string, unknown>): void {
    observability.log({ level: 'warn', message, context });
  },

  error(message: string, context?: Record<string, unknown>): void {
    observability.log({ level: 'error', message, context });
  },

  generateCorrelationId,
};
