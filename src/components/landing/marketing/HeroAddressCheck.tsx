// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

/**
 * The address box in the landing hero: house number and postcode, then
 * straight to /property-check with the report already running. The address
 * travels in router state rather than the URL so it never lands in an
 * analytics page path.
 */

import { useNavigate } from 'react-router-dom';

import { AddressCheckForm, type CheckedAddress } from '@/components/property/AddressCheckForm';
import { FREE_REPORT_PATH } from '@/config/registration';

export function HeroAddressCheck(): JSX.Element {
  const navigate = useNavigate();

  const handleCheck = (address: CheckedAddress): void => {
    navigate(FREE_REPORT_PATH, { state: { address } });
  };

  return (
    <div className="px-up w-full max-w-2xl" style={{ margin: '0 0 2rem', animationDelay: '650ms' }}>
      <p
        className="font-micro uppercase text-[0.7rem] tracking-[0.12em] mb-3"
        style={{ color: 'var(--fg-2)' }}
      >
        Free property check · flood, heritage, planning, sold prices
      </p>
      <AddressCheckForm appearance="landing" idPrefix="hero" onCheck={handleCheck} />
    </div>
  );
}
