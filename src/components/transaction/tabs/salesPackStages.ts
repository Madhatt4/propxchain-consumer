// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/** Flow stages each Sales pack row's work lives in (useTransactionFlow / dealAccess). */
export const LIST_PROPERTY_STAGE_ID = 'seller-1'; // listing form (address, price, title number)
export const SEARCHES_STAGE_ID = 'seller-2';
export const FORMS_STAGE_ID = 'seller-3'; // TA6, TA10, TA7

/** The text-link style every row action uses. */
export const PACK_ACTION_CLASS =
  'shrink-0 whitespace-nowrap text-[13px] font-semibold text-teal-700 hover:underline dark:text-teal-300';
