// PropXchain - Open Source Blockchain Property Conveyancing Platform
// Copyright (C) 2025 PropXchain Contributors
// SPDX-License-Identifier: Proprietary

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../../hooks/useSubscription';
import {
  SubscriptionFeature,
  FEATURE_DESCRIPTIONS,
  TIER_METADATA,
  getMinimumTierForFeature,
  getUpgradeTiers
} from '../../constants/subscriptionFeatures';
import './UpgradePrompt.css';

/**
 * Props for UpgradePrompt component
 */
export interface UpgradePromptProps {
  /**
   * The feature that requires an upgrade
   */
  feature: SubscriptionFeature;

  /**
   * Optional custom title
   */
  title?: string;

  /**
   * Optional custom description
   */
  description?: string;

  /**
   * Whether to show as a modal (default: false)
   */
  modal?: boolean;

  /**
   * Callback when modal is closed
   */
  onClose?: () => void;

  /**
   * Show compact version (smaller UI)
   */
  compact?: boolean;
}

/**
 * UpgradePrompt Component
 *
 * Displays an upgrade prompt when a user tries to access a premium feature
 * they don't have access to. Shows their current tier, the required tier,
 * and provides upgrade options.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <UpgradePrompt feature="analytics" />
 *
 * // As a modal
 * <UpgradePrompt
 *   feature="advanced_documents"
 *   modal={true}
 *   onClose={() => setShowUpgrade(false)}
 * />
 *
 * // Compact version
 * <UpgradePrompt feature="bulk_transactions" compact={true} />
 * ```
 */
const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  title,
  description,
  modal = false,
  onClose,
  compact = false
}) => {
  const navigate = useNavigate();
  const { tier, tierDisplayName, tierColor } = useSubscription();
  const [isOpen, setIsOpen] = useState(true);

  const featureInfo = FEATURE_DESCRIPTIONS[feature];
  const requiredTier = getMinimumTierForFeature(feature);
  const requiredTierMeta = requiredTier ? TIER_METADATA[requiredTier] : null;
  const upgradeTiers = getUpgradeTiers(tier);

  const handleClose = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const [showComingSoon, setShowComingSoon] = useState(false);

  const handleUpgrade = (targetTier?: string) => {
    // Show "Coming Soon" message instead of navigating to payment
    // Payment integration coming soon
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 3000);

    // Still navigate to pricing page for information
    const path = targetTier
      ? `/pricing?tier=${targetTier}`
      : '/pricing';
    navigate(path);
  };

  const handleContactSales = () => {
    // Navigate to contact/sales page
    navigate('/contact');
  };

  if (!isOpen && modal) {
    return null;
  }

  const promptContent = (
    <div className={`upgrade-prompt ${compact ? 'compact' : ''}`}>
      {/* Icon and Title */}
      <div className="upgrade-prompt-header">
        <div className="upgrade-prompt-icon">
          {featureInfo?.icon || '🔒'}
        </div>
        <h3 className="upgrade-prompt-title">
          {title || `Upgrade to access ${featureInfo?.name || 'this feature'}`}
        </h3>
      </div>

      {/* Description */}
      <p className="upgrade-prompt-description">
        {description || featureInfo?.description || `This feature requires a premium subscription.`}
      </p>

      {/* Current vs Required Tier */}
      <div className="upgrade-prompt-tiers">
        <div className="tier-badge current">
          <span className="tier-label">Current Plan</span>
          <span className="tier-name" style={{ color: tierColor }}>
            {tierDisplayName}
          </span>
        </div>
        {requiredTierMeta && (
          <>
            <div className="tier-arrow">→</div>
            <div className="tier-badge required">
              <span className="tier-label">Required Plan</span>
              <span className="tier-name" style={{ color: requiredTierMeta.color }}>
                {requiredTierMeta.displayName}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Coming Soon Toast */}
      {showComingSoon && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(55, 65, 81, 0.4)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'slideIn 0.3s ease'
        }}>
          <span style={{ fontSize: '24px' }}>🚀</span>
          <div>
            <strong style={{ display: 'block', marginBottom: '4px' }}>Payment Coming Soon!</strong>
            <span style={{ fontSize: '14px', opacity: 0.9 }}>View pricing details on the next page</span>
          </div>
        </div>
      )}

      {/* Upgrade Options */}
      {!compact && (
        <div className="upgrade-options">
          {upgradeTiers.length > 0 && (
            <div className="upgrade-tiers-list">
              <p className="upgrade-options-title">Choose your plan:</p>
              {upgradeTiers.map((tierKey) => {
                const tierMeta = TIER_METADATA[tierKey];
                const isRecommended = tierKey === requiredTier;

                return (
                  <div
                    key={tierKey}
                    className={`upgrade-tier-option ${isRecommended ? 'recommended' : ''}`}
                    onClick={() => handleUpgrade(tierKey)}
                  >
                    <div className="upgrade-tier-info">
                      <h4 className="upgrade-tier-name">
                        {tierMeta.displayName}
                        {isRecommended && (
                          <span className="recommended-badge">Recommended</span>
                        )}
                      </h4>
                      <p className="upgrade-tier-desc">{tierMeta.description}</p>
                    </div>
                    <div className="upgrade-tier-price">
                      {tierMeta.name === 'starter' ? (
                        <span className="price-amount">FREE</span>
                      ) : tierMeta.monthlyPrice > 0 ? (
                        <>
                          <span className="price-amount">£{tierMeta.monthlyPrice}</span>
                          <span className="price-period">/transaction</span>
                        </>
                      ) : (
                        <span className="price-contact">Contact Us</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="upgrade-prompt-actions">
        {compact ? (
          <>
            <button
              className="btn-upgrade-primary"
              onClick={() => handleUpgrade(requiredTier || undefined)}
              style={{ position: 'relative' }}
            >
              View Pricing
              <span style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: '#F59E0B',
                color: '#000',
                fontSize: '9px',
                padding: '2px 6px',
                borderRadius: '8px',
                fontWeight: 700
              }}>SOON</span>
            </button>
            <button className="btn-upgrade-secondary" onClick={handleClose}>
              Maybe Later
            </button>
          </>
        ) : (
          <>
            <button
              className="btn-upgrade-primary"
              onClick={() => handleUpgrade()}
              style={{ position: 'relative' }}
            >
              View All Plans
              <span style={{
                marginLeft: '8px',
                background: '#F59E0B',
                color: '#000',
                fontSize: '10px',
                padding: '2px 8px',
                borderRadius: '8px',
                fontWeight: 700
              }}>Payment Coming Soon</span>
            </button>
            <button
              className="btn-upgrade-secondary"
              onClick={handleContactSales}
            >
              Contact Sales
            </button>
          </>
        )}
      </div>

      {/* Close button for modal */}
      {modal && (
        <button className="upgrade-prompt-close" onClick={handleClose}>
          ✕
        </button>
      )}
    </div>
  );

  // Render as modal or inline
  if (modal) {
    return (
      <div className="upgrade-prompt-modal-overlay" onClick={handleClose}>
        <div className="upgrade-prompt-modal-content" onClick={(e) => e.stopPropagation()}>
          {promptContent}
        </div>
      </div>
    );
  }

  return promptContent;
};

export default UpgradePrompt;
