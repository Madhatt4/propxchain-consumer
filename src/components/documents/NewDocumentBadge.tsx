// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NewDocumentBadgeProps {
  /** Number of new documents to display */
  count: number;
  /** Optional: show as dot only (no number) */
  dotOnly?: boolean;
  /** Optional: additional CSS classes */
  className?: string;
  /** Optional: position style (default is absolute positioned) */
  position?: 'absolute' | 'inline';
}

/**
 * Badge component showing new document count
 *
 * Usage:
 * - Absolute position (default): Place inside a relative-positioned parent
 * - Inline position: Renders inline with text
 *
 * @example
 * ```tsx
 * <div className="relative">
 *   <DocumentIcon />
 *   <NewDocumentBadge count={3} />
 * </div>
 * ```
 *
 * @example
 * ```tsx
 * <span>Documents <NewDocumentBadge count={2} position="inline" /></span>
 * ```
 */
export const NewDocumentBadge: React.FC<NewDocumentBadgeProps> = ({
  count,
  dotOnly = false,
  className,
  position = 'absolute',
}) => {
  // Don't render if no new documents
  if (count <= 0) {
    return null;
  }

  const baseClasses = position === 'absolute'
    ? 'absolute -top-1 -right-1'
    : 'ml-1';

  if (dotOnly) {
    return (
      <Badge
        variant="destructive"
        className={cn(
          baseClasses,
          'h-2 w-2 p-0 rounded-full',
          className
        )}
      />
    );
  }

  return (
    <Badge
      variant="destructive"
      className={cn(
        baseClasses,
        'h-5 min-w-[1.25rem] p-0 flex items-center justify-center text-xs font-semibold',
        className
      )}
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
};

/**
 * Hook-friendly wrapper that computes badge from document arrays
 *
 * @example
 * ```tsx
 * const { count, isNew } = useNewDocumentBadge(transactionId, documentIds);
 * ```
 */
export { getNewDocumentCount, isNewDocument } from '@/utils/documentAcknowledgment';

export default NewDocumentBadge;
