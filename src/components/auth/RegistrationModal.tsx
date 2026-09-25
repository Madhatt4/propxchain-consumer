// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState } from 'react';
import { icpService } from '../../services/icp.service';
import { logger } from '@/utils/logger';

interface RegistrationModalProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

const RegistrationModal: React.FC<RegistrationModalProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    userType: 'diy_buyer', // Default role
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.name || !formData.email || !formData.mobile) {
        throw new Error('Please fill in all required fields');
      }

      // Register user with selected role
      const result = await icpService.registerUser({
        name: formData.name,
        email: formData.email,
        mobile: formData.mobile,
        userType: formData.userType,
      });

      logger.info('📝 Registration result:', result);

      if (result && result.success) {
        logger.info('✅ User registered successfully');

        // Wait for consensus (IC needs time to finalize the update)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify profile was created using update call (bypasses cache)
        const profile = await icpService.getMyProfile();
        if (profile) {
          logger.info('✅ Profile verified:', profile);
          onSuccess();
        } else {
          logger.error('❌ Registration succeeded but profile not found');
          throw new Error('Registration completed but profile verification failed. Please refresh the page and try logging in.');
        }
      } else {
        logger.error('❌ Registration failed, result:', result);
        throw new Error('Registration failed. The canister returned false. Please try again.');
      }
    } catch (err: any) {
      logger.error('❌ Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Complete Your Registration</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Please provide your details to continue using PropXchain.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="John Smith"
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="john@example.com"
            />
          </div>

          {/* Mobile */}
          <div>
            <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Mobile Phone <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              id="mobile"
              name="mobile"
              value={formData.mobile}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
              placeholder="+44 7700 900000"
            />
          </div>

          {/* User Role */}
          <div>
            <label htmlFor="userType" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              I am a... <span className="text-red-500">*</span>
            </label>
            <select
              id="userType"
              name="userType"
              value={formData.userType}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 dark:bg-slate-700 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              <optgroup label="Individual Buyers/Sellers">
                <option value="diy_buyer">DIY Buyer (no solicitor)</option>
                <option value="diy_seller">DIY Seller (no solicitor)</option>
                <option value="assisted_buyer">Buyer (with solicitor)</option>
                <option value="assisted_seller">Seller (with solicitor)</option>
              </optgroup>
              <optgroup label="Legal Professionals">
                <option value="solicitor_transparent">Solicitor (client has access)</option>
                <option value="solicitor_managed">Solicitor (managing for client)</option>
                <option value="conveyancer_transparent">Conveyancer (client has access)</option>
                <option value="conveyancer_managed">Conveyancer (managing for client)</option>
              </optgroup>
              <optgroup label="Other Professionals">
                <option value="estate_agent">Estate Agent</option>
                <option value="property_developer">Property Developer</option>
                <option value="mortgage_broker">Mortgage Broker</option>
              </optgroup>
            </select>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-3">
              <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-gray-800 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
            >
              {isLoading ? 'Registering...' : 'Complete Registration'}
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isLoading}
                className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegistrationModal;
