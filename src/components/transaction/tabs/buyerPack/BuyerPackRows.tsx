// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** The ordered, numbered Buyer pack rows and each row's one action or controls. */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { BuyerPackItem } from '@/services/buyerPack.service';
import { PACK_ACTION_CLASS } from '../salesPackStages';
import { BuyerPackItemRow } from './BuyerPackItemRow';
import { PROOF_OF_FUNDS_SLOTS, itemLabel } from './buyerPackLabels';
import { ChainDeclaration } from './ChainDeclaration';
import { MortgageDeclaration } from './MortgageDeclaration';
import { SendToSlot } from './SendToSlot';
import { SurveyDeclaration } from './SurveyDeclaration';

/** The buyer flow's Property Survey stage (utils/stageConfig getBuyerStages). */
export const SURVEY_STAGE_ID = 'buyer-3';
/** The buyer flow's Conveyancer Enquiries stage, where the buyer requests and accepts estimates. */
export const CONVEYANCER_STAGE_ID = 'buyer-5';

interface BuyerPackRowsProps {
  items: BuyerPackItem[];
  transactionId: string;
  isBuyer: boolean;
  onUpdated: (items: BuyerPackItem[]) => void;
  onResync: () => void;
  onGoToStage?: (stageId: string) => void;
}

const ARROW = <span aria-hidden="true"> &rsaquo;</span>;

function rowAction(item: BuyerPackItem, props: BuyerPackRowsProps): ReactNode {
  if (item.item === 'id_aml' && item.status !== 'ready') {
    return <Link to={{ search: '?tab=aml' }} className={PACK_ACTION_CLASS}>Open ID & AML{ARROW}</Link>;
  }
  if (item.item === 'survey' && item.status !== 'ready' && props.onGoToStage) {
    const go = props.onGoToStage;
    return <button type="button" className={PACK_ACTION_CLASS} onClick={() => go(SURVEY_STAGE_ID)}>Choose a survey{ARROW}</button>;
  }
  if (item.item === 'conveyancer' && item.status !== 'ready' && props.onGoToStage) {
    const go = props.onGoToStage;
    // Once estimates are out, the next step is choosing one, not asking again.
    const hasEstimates = item.detail.estimate_state === 'requested' || item.detail.estimate_state === 'received';
    const label = hasEstimates ? 'View estimates' : 'Request estimates';
    return <button type="button" className={PACK_ACTION_CLASS} onClick={() => go(CONVEYANCER_STAGE_ID)}>{label}{ARROW}</button>;
  }
  return null;
}

function rowControls(item: BuyerPackItem, props: BuyerPackRowsProps): ReactNode {
  const { transactionId, onUpdated, onResync } = props;
  switch (item.item) {
    case 'proof_of_funds':
      return item.status !== 'ready' && <SendToSlot transactionId={transactionId} slots={PROOF_OF_FUNDS_SLOTS} onSent={onResync} />;
    case 'mortgage':
      return <MortgageDeclaration transactionId={transactionId} detail={item.detail} onUpdated={onUpdated} />;
    case 'chain':
      return <ChainDeclaration transactionId={transactionId} detail={item.detail} onUpdated={onUpdated} />;
    case 'survey':
      return <SurveyDeclaration transactionId={transactionId} detail={item.detail} onUpdated={onUpdated} />;
    default:
      return null;
  }
}

export function BuyerPackRows(props: BuyerPackRowsProps): JSX.Element {
  const { items, isBuyer } = props;
  const next = items.find((i) => i.status !== 'ready');
  return (
    <>
      {items.length > 0 && (
        <p className="mt-1.5 text-[13px] text-teal-800 dark:text-teal-300">
          {next ? `Next: ${itemLabel(next.item)}` : 'Pack complete'}
        </p>
      )}
      <ol aria-label="Buyer pack steps" className="mt-3 divide-y divide-gray-100 dark:divide-slate-700/40">
        {items.map((item, index) => (
          <BuyerPackItemRow
            key={item.item}
            item={item}
            number={index + 1}
            isNext={item === next}
            showHelp={isBuyer}
            action={isBuyer ? rowAction(item, props) : null}
          >
            {isBuyer ? rowControls(item, props) : null}
          </BuyerPackItemRow>
        ))}
      </ol>
    </>
  );
}
