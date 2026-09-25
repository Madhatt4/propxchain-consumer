import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { logger } from '@/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

const CHUNK_RELOAD_KEY = 'propxchain-chunk-reload';

/**
 * Detect Vite dynamic-import failures caused by stale chunk filenames.
 * Happens when the browser has a cached index.html referencing
 * content-hashed JS chunks from a previous build that no longer exist
 * after a rebuild. Message shape: "Failed to fetch dynamically imported
 * module: https://..." — name is TypeError, not a dedicated ChunkLoadError.
 */
function isStaleChunkError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    /ChunkLoadError/i.test(error.name)
  );
}

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs the error, and displays a fallback UI instead of crashing.
 *
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 *
 * // With custom fallback
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // Stale chunk auto-recovery: if the error is a Vite dynamic-import
    // failure (cached index.html pointing at a chunk filename that
    // no longer exists after a rebuild), force a single hard reload.
    // Reload loops are guarded by sessionStorage — if the same error
    // reappears after reload, fall through to the fallback UI so the
    // user sees a real error rather than a reload spiral.
    if (isStaleChunkError(error)) {
      const alreadyReloaded = sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
      if (!alreadyReloaded) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        logger.warn('[ErrorBoundary] Stale chunk detected — hard-reloading once');
        window.location.reload();
        return;
      }
      logger.error('[ErrorBoundary] Stale chunk persists after reload — showing fallback');
    } else {
      // Clear the reload guard for non-chunk errors so the next stale
      // chunk on a different deploy can trigger its own reload.
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
    }

    // Call optional error handler
    this.props.onError?.(error, errorInfo);

    // Log to console in development only
    if (import.meta.env.DEV) {
      logger.error('[ErrorBoundary] Caught error:', error);
      logger.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    }
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  handleRetry = (): void => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-red-500/20 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Something went wrong
            </h1>

            <p className="text-gray-600 dark:text-gray-400 mb-6">
              We're sorry, but an unexpected error occurred. Our team has been notified.
            </p>

            {/* Show error details in development */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-gray-100 dark:bg-gray-900 rounded text-left overflow-auto max-h-32">
                <p className="text-red-600 dark:text-red-400 text-sm font-mono">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Page-level error boundary with navigation awareness
 */
export class PageErrorBoundary extends ErrorBoundary {
  componentDidUpdate(prevProps: Props): void {
    // Reset error state when children change (e.g., navigation)
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  }
}

export default ErrorBoundary;
