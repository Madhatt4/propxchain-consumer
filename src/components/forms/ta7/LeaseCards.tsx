// Field-group cards for the TA7 form: lease term, and ground rent + service
// charge. Pure presentation over the parent's formData/handlers; anomaly
// flags stay anchored to their sections.

import React from 'react';

import { AnomalyFlag } from '../AnomalyFlag';
import { CARD, INPUT, LABEL, SECTION_TITLE } from './ta7Ui';
import type { CrossReferenceResult } from '../../../services/formCrossReferenceService';
import type { TA7LeaseholdInformation } from '../../../types/ta7.types';

export interface TA7CardProps {
  formData: TA7LeaseholdInformation;
  readOnly: boolean;
  onField: (field: keyof TA7LeaseholdInformation, value: unknown) => void;
  onBlur: () => void;
  anomalies: CrossReferenceResult[];
}

export const LeaseTermCard: React.FC<TA7CardProps> = ({ formData, readOnly, onField, onBlur, anomalies }) => (
  <div className={`${CARD} space-y-4`}>
    <h3 className={SECTION_TITLE}>Lease term</h3>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div>
        <label htmlFor="ta7-term" className={LABEL}>Original lease term (years)</label>
        <input
          id="ta7-term"
          type="number"
          value={formData.leaseTermYears || ''}
          onChange={(e) => onField('leaseTermYears', parseInt(e.target.value, 10) || 0)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
          placeholder="e.g. 99, 125, 999"
        />
      </div>
      <div>
        <label htmlFor="ta7-start" className={LABEL}>Lease start date</label>
        <input
          id="ta7-start"
          type="date"
          value={formData.leaseStartDate}
          onChange={(e) => onField('leaseStartDate', e.target.value)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="ta7-expiry" className={LABEL}>Lease expiry date</label>
        <input
          id="ta7-expiry"
          type="date"
          value={formData.leaseExpiryDate}
          onChange={(e) => onField('leaseExpiryDate', e.target.value)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
          Worked out automatically from the term and start date; adjust if your lease says otherwise.
        </p>
      </div>
    </div>
    {anomalies
      .filter((a) => a.formSection === 'TA7 Lease Term')
      .map((a, i) => (
        <AnomalyFlag key={`lease-${i}`} result={a} />
      ))}
  </div>
);

export const ChargesCard: React.FC<TA7CardProps> = ({ formData, readOnly, onField, onBlur, anomalies }) => (
  <div className={`${CARD} space-y-4`}>
    <h3 className={SECTION_TITLE}>Ground rent and service charge</h3>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label htmlFor="ta7-gr-amount" className={LABEL}>Ground rent (£)</label>
        <input
          id="ta7-gr-amount"
          type="number"
          value={formData.groundRentAmount || ''}
          onChange={(e) => onField('groundRentAmount', parseFloat(e.target.value) || 0)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
          placeholder="0"
        />
      </div>
      <div>
        <label htmlFor="ta7-gr-freq" className={LABEL}>Ground rent frequency</label>
        <select
          id="ta7-gr-freq"
          value={formData.groundRentPaymentFrequency}
          onChange={(e) => onField('groundRentPaymentFrequency', e.target.value)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
        >
          <option value="">Select frequency...</option>
          <option value="annual">Annual</option>
          <option value="quarterly">Quarterly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div>
        <label htmlFor="ta7-sc-amount" className={LABEL}>Service charge (£)</label>
        <input
          id="ta7-sc-amount"
          type="number"
          value={formData.serviceChargeAmount || ''}
          onChange={(e) => onField('serviceChargeAmount', parseFloat(e.target.value) || 0)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
          placeholder="0"
        />
      </div>
      <div>
        <label htmlFor="ta7-sc-freq" className={LABEL}>Service charge frequency</label>
        <select
          id="ta7-sc-freq"
          value={formData.serviceChargePaymentFrequency}
          onChange={(e) => onField('serviceChargePaymentFrequency', e.target.value)}
          onBlur={onBlur}
          disabled={readOnly}
          className={INPUT}
        >
          <option value="">Select frequency...</option>
          <option value="annual">Annual</option>
          <option value="quarterly">Quarterly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
    </div>
    {anomalies
      .filter((a) => a.formSection === 'TA7 Ground Rent')
      .map((a, i) => (
        <AnomalyFlag key={`gr-${i}`} result={a} />
      ))}
  </div>
);

export const ManagementCard: React.FC<TA7CardProps> = ({ formData, readOnly, onField, onBlur }) => (
  <div className={`${CARD} space-y-4`}>
        <h3 className={SECTION_TITLE}>Freeholder and management</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="ta7-freeholder" className={LABEL}>Freeholder name</label>
            <input
              id="ta7-freeholder"
              type="text"
              value={formData.freeholder}
              onChange={(e) => onField('freeholder', e.target.value)}
              onBlur={onBlur}
              disabled={readOnly}
              className={INPUT}
              placeholder="Name of freeholder or company"
            />
          </div>
          <div>
            <label htmlFor="ta7-agent" className={LABEL}>Managing agent (if any)</label>
            <input
              id="ta7-agent"
              type="text"
              value={formData.managingAgent ?? ''}
              onChange={(e) => onField('managingAgent', e.target.value || null)}
              onBlur={onBlur}
              disabled={readOnly}
              className={INPUT}
              placeholder="Managing agent name"
            />
          </div>
        </div>
      </div>
);
