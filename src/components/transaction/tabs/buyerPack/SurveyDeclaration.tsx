// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd
import { useState } from 'react';
import { type BuyerPackDetail, type BuyerPackItem, declareBuyerPack } from '@/services/buyerPack.service';

interface Props {
  transactionId: string;
  detail: BuyerPackDetail;
  onUpdated: (items: BuyerPackItem[]) => void;
}

export function SurveyDeclaration({ transactionId, detail, onUpdated }: Props): JSX.Element {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const received = detail.survey_state === 'received';

  const toggle = async (next: boolean): Promise<void> => {
    setSaving(true);
    setError(null);
    try {
      onUpdated(await declareBuyerPack(transactionId, { surveyReceived: next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1 text-sm">
      {detail.survey_state === 'none' && (
        <p className="text-xs text-muted-foreground">Book a survey from the Property Survey stage and it will show here as booked.</p>
      )}
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={received} disabled={saving} onChange={(e) => void toggle(e.target.checked)} />
        I have received the survey report
      </label>
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  );
}
