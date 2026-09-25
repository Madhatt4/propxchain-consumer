// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd
//
// TA6 6th edition — Section 1: Property and seller details (ADR 0009 paraphrase
// bundle). §1 is factual — prompts are field labels, not yes/no questions.
// Refs use synthetic '1.<fieldPath>' keys mirroring Section1PropertyAndSeller
// in the on-chain schema (forms_types.mo). No verbatim form wording appears here.

import { TA6_OFFICIAL_FORM_URL } from './types';

import type { TA6PromptEntry } from './types';

export const SECTION_01_PROMPTS: TA6PromptEntry[] = [
  {
    ref: '1.propertyAddress',
    prompt: 'Full address of the property being sold',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.postcode',
    prompt: 'Postcode of the property',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.uprn',
    prompt: 'Unique Property Reference Number (UPRN), if you know it',
    helpText:
      'The UPRN is a national reference number for the property. Leave this blank if you do not have it — it can usually be looked up from the address.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.seller.fullName',
    prompt: 'Full name of each person selling the property',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.seller.role',
    prompt:
      'The capacity each person is selling in: owner, executor, administrator, attorney or trustee',
    helpText:
      'Most sellers are the owners. Choose executor or administrator if you are selling on behalf of someone who has died, attorney if you hold a power of attorney, or trustee if the property is held in trust.',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.seller.ownershipOrAuthorityDate',
    prompt:
      'The date each seller became an owner, or the date of the document giving them authority to sell (for example a grant of probate or a power of attorney)',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.company.companyName',
    prompt: 'Company name, if the seller is a company',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.company.companyNumber',
    prompt: 'Company registration number',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.company.director',
    prompt: 'Name of the company director dealing with the sale',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.company.countryOfIncorporation',
    prompt: 'Country where the company is incorporated',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.solicitor.firmName',
    prompt: 'Name of the firm handling your sale (your solicitor or conveyancer)',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.solicitor.address',
    prompt: 'Address of the firm handling your sale',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.solicitor.postcode',
    prompt: 'Postcode of the firm handling your sale',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.solicitor.contactName',
    prompt: 'Name of the person at the firm dealing with your file',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.solicitor.email',
    prompt: 'Email address for the person dealing with your file (optional)',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
  {
    ref: '1.solicitor.phone',
    prompt: 'Phone number for the person dealing with your file (optional)',
    lawSocietyAnchor: TA6_OFFICIAL_FORM_URL,
  },
];
