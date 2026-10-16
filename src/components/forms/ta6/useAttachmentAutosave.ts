// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

// An attached file is stored and anchored the moment it uploads, so the form
// that points at it is saved then too: on 16 Oct a seller attached an EICR,
// confirmed its facts and reloaded, and the attachment was gone because the
// section had never been saved. Confirming a fact on an upload also tells the
// caller, so answers that fact fills (11.3) appear straight away.

import { useEffect, useMemo, useRef } from 'react';

import type { TA6UploadFile } from './section-props';
import type { TA6PropertyInformation } from '../../../types/ta6.types';

export function useAttachmentAutosave(
  uploadFile: TA6UploadFile | undefined,
  form: TA6PropertyInformation,
  save: () => Promise<void>,
  onFactConfirmed: () => void,
): TA6UploadFile | undefined {
  // Set when an upload resolves; the slot then writes the id into the form,
  // and the next form change is the one to save.
  const pending = useRef(false);
  const latestSave = useRef(save);
  latestSave.current = save;

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    void latestSave.current();
  }, [form]);

  return useMemo<TA6UploadFile | undefined>(() => {
    if (!uploadFile) return undefined;
    return async (file, context) => {
      const upload = context ? await uploadFile(file, context) : await uploadFile(file);
      pending.current = true;
      const { decide } = upload;
      if (!decide) return upload;
      return {
        ...upload,
        decide: async (factId, decision) => {
          const result = await decide(factId, decision);
          if (result.decision === 'confirmed') onFactConfirmed();
          return result;
        },
      };
    };
  }, [uploadFile, onFactConfirmed]);
}
