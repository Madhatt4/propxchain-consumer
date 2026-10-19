// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import { createContext } from 'react';

/**
 * documentId -> what the document was read as, loaded once by the TA6 shell
 * (attachmentTypes.service) so every DocumentSlot can name its attachment
 * without threading a prop through the fifteen sections. Empty outside a form.
 */
export const AttachmentTypesContext = createContext<ReadonlyMap<string, string>>(new Map());
