// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

// ============================================================================
// Types
// ============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMetadata {
  [key: string]: unknown;
}

// ============================================================================
// Sensitive Data Patterns (for sanitization)
// ============================================================================

const SENSITIVE_PATTERNS = {
  // ICP Principal IDs (5+ groups of base32 chars separated by hyphens)
  principal: /\b[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{5}-[a-z0-9]{3,}\b/gi,

  // SHA-256 hashes (64 hex characters)
  hash: /\b[a-fA-F0-9]{64}\b/g,

  // CSRF tokens (32+ hex characters)
  token: /\b[a-fA-F0-9]{32,}\b/g,

  // Common password/secret field patterns
  password: /(password|secret|apiKey|privateKey|accessToken)["']?\s*[:=]\s*["']?[^"'\s,}]+/gi,
};

// ============================================================================
// Sanitization Functions
// ============================================================================

/**
 * Redacts a principal ID to show only first/last segments
 * Example: "76l4h-lzfta-x3y3g-mgoev-o6uwb-dbott-blau3-m56bc-7n27c-ge66m-dqe"
 *       -> "76l4h-***-dqe"
 */
function redactPrincipal(principal: string): string {
  const parts = principal.split('-');
  if (parts.length < 3) return '[PRINCIPAL]';
  return `${parts[0]}-***-${parts[parts.length - 1]}`;
}

/**
 * Redacts a hash to show only first 8 characters
 * Example: "a3f5d9..." -> "a3f5d9...[HASH]"
 */
function redactHash(hash: string): string {
  return `${hash.substring(0, 8)}...[HASH]`;
}

/**
 * Sanitizes a string by replacing sensitive data patterns
 */
function sanitizeString(str: string): string {
  let sanitized = str;

  // Redact principal IDs
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.principal, (match) => redactPrincipal(match));

  // Redact hashes
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.hash, (match) => redactHash(match));

  // Redact tokens
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.token, '[TOKEN]');

  // Redact password/secret fields
  sanitized = sanitized.replace(SENSITIVE_PATTERNS.password, (match) => {
    const [field] = match.split(/[:=]/);
    return `${field}: [REDACTED]`;
  });

  return sanitized;
}

/**
 * Recursively sanitizes an object/array
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      // Redact known sensitive keys
      if (['password', 'secret', 'token', 'csrfToken', 'apiKey', 'privateKey'].includes(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(val);
      }
    }
    return sanitized;
  }

  return value;
}

/**
 * Sanitizes all arguments to a log function
 */
function sanitizeArgs(...args: unknown[]): unknown[] {
  return args.map(sanitizeValue);
}

// ============================================================================
// Logger Class
// ============================================================================

class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
  }

  /**
   * Logs a debug message (only in development)
   */
  debug(...args: unknown[]): void {
    if (!this.isDevelopment) return;

    const sanitized = sanitizeArgs(...args);
    console.log('[DEBUG]', ...sanitized);
  }

  /**
   * Logs an info message (only in development)
   */
  info(...args: unknown[]): void {
    if (!this.isDevelopment) return;

    const sanitized = sanitizeArgs(...args);
    console.log('[INFO]', ...sanitized);
  }

  /**
   * Logs a warning message
   * Enabled in both dev and production, but sanitized
   */
  warn(...args: unknown[]): void {
    const sanitized = sanitizeArgs(...args);
    console.warn('[WARN]', ...sanitized);
  }

  /**
   * Logs an error message
   * Enabled in both dev and production, but sanitized
   */
  error(...args: unknown[]): void {
    const sanitized = sanitizeArgs(...args);
    console.error('[ERROR]', ...sanitized);
  }

  /**
   * Logs with metadata (structured logging)
   * Only in development
   */
  logWithMetadata(level: LogLevel, message: string, metadata?: LogMetadata): void {
    if (!this.isDevelopment && level !== 'error' && level !== 'warn') return;

    const sanitizedMessage = sanitizeString(message);
    const sanitizedMetadata = metadata ? sanitizeValue(metadata) : undefined;

    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

    if (sanitizedMetadata) {
      logFn(`[${level.toUpperCase()}]`, sanitizedMessage, sanitizedMetadata);
    } else {
      logFn(`[${level.toUpperCase()}]`, sanitizedMessage);
    }
  }

  /**
   * Creates a group for related log messages (development only)
   */
  group(label: string): void {
    if (!this.isDevelopment) return;
    console.group(sanitizeString(label));
  }

  /**
   * Ends the current log group (development only)
   */
  groupEnd(): void {
    if (!this.isDevelopment) return;
    console.groupEnd();
  }

  /**
   * Logs a table (development only)
   */
  table(data: unknown): void {
    if (!this.isDevelopment) return;
    console.table(sanitizeValue(data));
  }

  /**
   * Asserts a condition and logs an error if false
   */
  assert(condition: boolean, message: string): void {
    if (!condition) {
      this.error('Assertion failed:', message);
    }
  }

  /**
   * Times an operation (development only)
   */
  time(label: string): void {
    if (!this.isDevelopment) return;
    console.time(sanitizeString(label));
  }

  /**
   * Ends timing an operation (development only)
   */
  timeEnd(label: string): void {
    if (!this.isDevelopment) return;
    console.timeEnd(sanitizeString(label));
  }
}

// ============================================================================
// Export Singleton Instance
// ============================================================================

/**
 * Singleton logger instance
 *
 * Usage:
 * ```typescript
 * import { logger } from '@/utils/logger';
 *
 * logger.info('User logged in');
 * logger.error('Failed to save document:', error);
 * logger.logWithMetadata('info', 'Transaction created', { id: '123', status: 'pending' });
 * ```
 */
export const logger = new Logger();

// ============================================================================
// Legacy console.log Migration Helpers
// ============================================================================

/**
 * Drop-in replacement for console.log
 * Use this to quickly migrate existing console.log statements
 *
 * @deprecated Use logger.info() instead for better control
 */
export function log(...args: unknown[]): void {
  logger.info(...args);
}

/**
 * Export individual methods for destructured imports
 */
export const { debug, info, warn, error, group, groupEnd, table, assert: logAssert } = logger;

// ============================================================================
// Production Environment Check
// ============================================================================

if (import.meta.env.PROD) {
  // In production, warn developers if they somehow imported this in production code
  logger.warn(
    '[LOGGER] Running in PRODUCTION mode - most logs are disabled. Only warn() and error() will output.'
  );
}
