import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { icpService } from '../../services/icp.service';
import AppTopBar from '@/components/navigation/AppTopBar';
import { logger } from '@/utils/logger';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '../../stores/authStore';

interface User {
  id?: string;
  principal?: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  createdAt: string;
  mobile?: string;
}

const ProfileSetup: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    mobile: '',
    name: '',
    phone: '',
    role: 'buyer',
    company: '',
    jobTitle: '',
    experience: '',
    specializations: [] as string[]
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [emailError, setEmailError] = useState('');
  const [mobileError, setMobileError] = useState('');
  // True when the canister returned an existing profile for this principal.
  // Drives copy changes (page title, subtitle, submit button) so the page
  // reads as "Edit profile" for returning users instead of "Set up profile"
  // for new ones. Bug #5: the sidebar's "Profile" item lands here for both
  // cohorts; this gives existing users the right framing.
  const [hasExistingProfile, setHasExistingProfile] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadProfile = async () => {
      const authState = useAuthStore.getState();
      const principalId = authState.principalId;

      if (!principalId || !authState.isAuthenticated) {
        navigate('/login');
        return;
      }

      // Set basic user from principal
      const basicUser: User = {
        principal: principalId,
        id: principalId,
        email: '',
        firstName: '',
        lastName: '',
        role: 'buyer',
        createdAt: new Date().toISOString()
      };

      // CRITICAL: Restore Internet Identity session before fetching profile
      try {
        logger.info('ProfileSetup: Restoring Internet Identity session...');
        const isAuthenticated = await icpService.initAuth();

        // Check if session was restored successfully
        if (!isAuthenticated) {
          logger.error('ProfileSetup: Session expired or invalid, redirecting to login');
          navigate('/login');
          return;
        }

        logger.info('ProfileSetup: Session restored successfully');
      } catch (error) {
        logger.error('ProfileSetup: Failed to restore session:', error);
        navigate('/login');
        return;
      }

      // Try to fetch existing profile from canister; fall back to the Supabase
      // OAuth/email metadata for brand-new users (social sign-ups arrive with a
      // name + email but no on-chain profile yet).
      const supaUser = authState.supabaseUser;
      const metaName =
        (supaUser?.user_metadata?.full_name as string | undefined) ||
        (supaUser?.user_metadata?.name as string | undefined) ||
        '';
      const metaEmail = supaUser?.email || '';

      try {
        const profile = await icpService.getMyProfile();
        if (profile) {
          basicUser.email = profile.email || '';
          basicUser.firstName = profile.name?.split(' ')[0] || '';
          basicUser.lastName = profile.name?.split(' ').slice(1).join(' ') || '';
          basicUser.role = profile.userType || 'buyer';
          basicUser.mobile = profile.mobile || '';

          setFormData({
            email: profile.email || metaEmail,
            mobile: profile.mobile || '',
            name: profile.name || metaName,
            phone: profile.mobile || '',
            role: profile.userType || 'buyer',
            company: '',
            jobTitle: '',
            experience: '',
            specializations: [],
          });

          setHasExistingProfile(true);
        } else {
          // No on-chain profile — prefill name/email from provider metadata.
          setFormData((prev) => ({ ...prev, name: metaName, email: metaEmail }));
        }
      } catch (error) {
        logger.info('No existing profile found, starting fresh');
        setFormData((prev) => ({ ...prev, name: metaName, email: metaEmail }));
      }

      setUser(basicUser);
    };

    loadProfile();
  }, [navigate]);

  // Email format validation
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  // Mobile number validation (UK format)
  const validateMobile = (mobile: string): boolean => {
    // Allow formats: +44 7700 900000, 07700900000, +447700900000
    const mobileRegex = /^(\+44\s?7\d{3}|\(?07\d{3}\)?)\s?\d{3}\s?\d{3}$/;
    return mobileRegex.test(mobile);
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Reset errors
    setEmailError('');
    setMobileError('');

    try {
      // Verify session is still valid before submitting
      const isAuthenticated = await icpService.initAuth();
      if (!isAuthenticated) {
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'Your session has expired. Please log in again.',
        });
        navigate('/login');
        return;
      }

      // Validate required fields
      if (!formData.mobile || !formData.email) {
        toast({
          variant: 'destructive',
          title: 'Missing Required Fields',
          description: 'Please fill in all required fields: Mobile number and Email.',
        });
        setIsLoading(false);
        return;
      }

      // Validate email format
      if (!validateEmail(formData.email)) {
        setEmailError('Please enter a valid email address (e.g., name@example.com)');
        setCurrentStep(1); // Go back to step 1 where email is
        setIsLoading(false);
        return;
      }

      // Validate mobile format
      if (!validateMobile(formData.mobile)) {
        setMobileError('Please enter a valid UK mobile number (e.g., +44 7700 900000 or 07700 900000)');
        setCurrentStep(1); // Go back to step 1 where mobile is
        setIsLoading(false);
        return;
      }

      // Map UI role → canister userType (matches authStore.mapRoleToUserType).
      const userType = (() => {
        switch ((formData.role || '').toLowerCase()) {
          case 'developer':
          case 'property_developer':
            return 'property_developer';
          case 'conveyancer':
          case 'solicitor':
          case 'solicitor_client_linked':
            return 'solicitor_client_linked';
          case 'estate_agent':
            return 'estate_agent';
          case 'mortgage_broker':
            return 'mortgage_broker';
          case 'seller':
            return 'seller';
          case 'buyer':
          default:
            return 'buyer';
        }
      })();

      // Save to ICP user_management canister
      const result = await icpService.registerUser({
        name: formData.name || 'User',
        email: formData.email,
        mobile: formData.mobile,
        userType,
      });

      if (!result.success) {
        throw new Error('Failed to save profile to blockchain');
      }

      // Profile saved to blockchain successfully
      // Do NOT store sensitive user data in localStorage
      // Authentication is already stored via principalId and isAuthenticated
      logger.info('Profile saved to blockchain successfully');

      // Remove userProfile from localStorage (no longer needed)
      localStorage.removeItem('userProfile');

      // Refresh authStore.userProfile so RequireProfile lets the user through
      // the next protected route.
      await useAuthStore.getState().fetchProfile();

      toast({
        title: 'Profile Saved',
        description: `Your profile has been saved to the blockchain. A verification email will be sent to ${formData.email}.`,
      });

      // Route based on selected role — developers go to builder, others to onboarding.
      // Honour the original target route (set by RequireProfile.state.from) when sensible.
      const authState = useAuthStore.getState();
      const supaMeta = authState.supabaseUser?.user_metadata;
      const isDeveloper =
        userType === 'property_developer' ||
        supaMeta?.role === 'developer' ||
        supaMeta?.propxchain_pending_developer_org != null;
      if (isDeveloper) {
        navigate('/builder');
      } else {
        localStorage.setItem('needsOnboarding', 'true');
        navigate('/onboarding/role');
      }
    } catch (err: any) {
      logger.error('Profile setup error:', err);

      // Check if it's a session/auth error
      if (err?.message?.includes('session') || err?.message?.includes('auth') || err?.message?.includes('identity')) {
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'Your session has expired. Please log in again.',
        });
        navigate('/login');
      } else {
        toast({
          variant: 'destructive',
          title: 'Failed to Save Profile',
          description: 'Please try again. If the problem persists, try logging out and logging back in.',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSpecializationChange = (specialization: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(specialization)
        ? prev.specializations.filter(s => s !== specialization)
        : [...prev.specializations, specialization]
    }));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-main)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-gray-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-900 dark:text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)]">
      <AppTopBar title="Profile" backTo="/dashboard" backLabel="Back to dashboard" />

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                {hasExistingProfile ? 'Edit Your Profile' : 'Complete Your Profile'}
              </h2>
              <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
                {hasExistingProfile
                  ? 'Your details are pre-filled below. Update anything that has changed and save.'
                  : 'Help us personalize your experience with PropXchain'}
              </p>
            </div>

            {hasExistingProfile && (() => {
              const missing: string[] = [];
              if (!formData.email) missing.push('Email Address');
              if (!formData.mobile) missing.push('Mobile Number');
              if (!formData.role) missing.push('Role');
              if (missing.length === 0) return null;
              return (
                <div className="mb-6 rounded-md border border-yellow-200 dark:border-yellow-700/50 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-200">
                  <strong className="font-medium">A few required details aren&apos;t set yet:</strong>{' '}
                  {missing.join(', ')}. Please add them below before saving.
                </div>
              );
            })()}

            {/* Progress Steps */}
            <div className="mb-8">
              <div className="flex items-center justify-center">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      step <= currentStep ? 'bg-gray-700 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {step}
                    </div>
                    {step < 3 && (
                      <div className={`w-16 h-1 mx-2 ${
                        step < currentStep ? 'bg-gray-300 dark:bg-gray-700' : 'bg-gray-300 dark:bg-gray-700'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-lg p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Required Information</h3>

              <div className="bg-gray-100 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-600 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Required fields</strong> - These details are needed to create transactions and are stored securely on the blockchain.
                </p>
              </div>


              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Full Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                  placeholder="John Smith"
                />
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Optional - for display purposes</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={`mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border ${emailError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500`}
                  placeholder="john.smith@example.com"
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-500">{emailError}</p>
                )}
              </div>

              <div>
                <label htmlFor="mobile" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  id="mobile"
                  name="mobile"
                  value={formData.mobile}
                  onChange={handleChange}
                  required
                  className={`mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border ${mobileError ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500`}
                  placeholder="+44 7700 900000"
                />
                {mobileError && (
                  <p className="mt-1 text-sm text-red-500">{mobileError}</p>
                )}
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="developer">Property developer</option>
                  <option value="conveyancer">Conveyancer / Solicitor</option>
                  <option value="estate_agent">Estate agent</option>
                  <option value="mortgage_broker">Mortgage broker</option>
                </select>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  This determines which dashboards and actions you can use. You can request a change later.
                </p>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Professional Details</h3>

              <div>
                <label htmlFor="experience" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Years of Experience
                </label>
                <select
                  id="experience"
                  name="experience"
                  value={formData.experience}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-gray-500 focus:border-gray-500"
                >
                  <option value="">Select experience level</option>
                  <option value="0-2">0-2 years</option>
                  <option value="3-5">3-5 years</option>
                  <option value="6-10">6-10 years</option>
                  <option value="10+">10+ years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Areas of Specialization
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    'Residential Property',
                    'Commercial Property',
                    'Leasehold',
                    'Freehold',
                    'New Build',
                    'Listed Buildings',
                    'Shared Ownership',
                    'Building Safety Act'
                  ].map((spec) => (
                    <label key={spec} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.specializations.includes(spec)}
                        onChange={() => handleSpecializationChange(spec)}
                        className="h-4 w-4 text-gray-700 focus:ring-gray-500 border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{spec}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Review & Complete</h3>

              <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-lg border border-gray-300 dark:border-gray-600">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">Profile Summary</h4>
                <div className="space-y-2 text-sm">
                  {formData.name && <p className="text-gray-700 dark:text-gray-300"><strong>Name:</strong> {formData.name}</p>}
                  <p className="text-gray-700 dark:text-gray-300"><strong>Email:</strong> {formData.email}</p>
                  <p className="text-gray-700 dark:text-gray-300"><strong>Mobile:</strong> {formData.mobile}</p>
                  {formData.company && <p className="text-gray-700 dark:text-gray-300"><strong>Company:</strong> {formData.company}</p>}
                  {formData.jobTitle && <p className="text-gray-700 dark:text-gray-300"><strong>Job Title:</strong> {formData.jobTitle}</p>}
                  {formData.experience && <p className="text-gray-700 dark:text-gray-300"><strong>Experience:</strong> {formData.experience}</p>}
                  {formData.specializations.length > 0 && (
                    <p className="text-gray-700 dark:text-gray-300"><strong>Specializations:</strong> {formData.specializations.join(', ')}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-100 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-600 p-4 rounded-lg">
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <strong>Welcome to PropXchain!</strong> You can update this information anytime in your profile settings.
                </p>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Previous
              </button>
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 ml-auto"
              >
                Next
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 ml-auto disabled:opacity-50"
              >
                {isLoading
                  ? (hasExistingProfile ? 'Saving...' : 'Completing...')
                  : (hasExistingProfile ? 'Save changes' : 'Complete Setup')}
              </button>
            )}
          </div>
        </form>
          </div>
        </main>
    </div>
  );
};

export default ProfileSetup;
