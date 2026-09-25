// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import { consumePendingInviteUrl } from '@/utils/pendingInviteUrl';
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore, useIdentityError } from '../../stores/authStore';
import {
  ArrowRight, ArrowLeft, Loader2, Mail, Lock, User, Eye, EyeOff,
  CheckCircle, Fingerprint,
} from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';
import OAuthButtons from '../../components/auth/OAuthButtons';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['seller', 'buyer', 'solicitor'], {
    required_error: 'Please select a role',
  }),
});

type RegisterFormData = z.infer<typeof registerSchema>;
type RegMethod = 'select' | 'email' | 'ii-role';

/** The join page stored the full invite URL (role/side/inviter) before sending
 *  the user here; prefer it so nothing from the agent's link is lost. */
function joinRouteFor(inviteCode: string): string {
  return consumePendingInviteUrl() ?? `/join/${inviteCode}`;
}

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [regMethod, setRegMethod] = useState<RegMethod>('select');
  const [iiLoading, setIiLoading] = useState(false);
  const [iiRole, setIiRole] = useState<string>('seller');
  const inviteCode = searchParams.get('invite');

  const {
    registerWithEmail, isLoading, error, clearError, isAuthenticated,
  } = useAuthStore();
  const identityError = useIdentityError();

  useEffect(() => {
    if (isAuthenticated && !isRegistered && regMethod !== 'ii-role') {
      navigate(inviteCode ? joinRouteFor(inviteCode) : '/dashboard');
    }
  }, [isAuthenticated, navigate, inviteCode, isRegistered, regMethod]);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: {
      role: (['seller', 'buyer', 'solicitor'] as const).includes(
        searchParams.get('role') as 'seller' | 'buyer' | 'solicitor',
      )
        ? (searchParams.get('role') as 'seller' | 'buyer' | 'solicitor')
        : 'seller',
    },
  });

  const onSubmit = async (data: RegisterFormData): Promise<void> => {
    clearError();
    const success = await registerWithEmail(data.email, data.password, data.name, data.role);
    if (success) {
      setIsRegistered(true);
    }
  };

  const handleIIRegister = async (): Promise<void> => {
    clearError();
    setIiLoading(true);
    try {
      const { loginWithII: iiLogin } = useAuthStore.getState();
      const success = await iiLogin();
      if (success) {
        setRegMethod('ii-role');
      }
    } finally {
      setIiLoading(false);
    }
  };

  const handleIIRoleComplete = (): void => {
    localStorage.setItem('userType', iiRole);
    navigate(inviteCode ? joinRouteFor(inviteCode) : '/dashboard');
  };

  const handleBackToMethods = (): void => {
    clearError();
    setRegMethod('select');
  };

  if (isRegistered) {
    return (
      <AuthShell topLink={{ label: 'Sign in', to: '/login' }}>
        <CheckEmailView email={null} onBack={() => navigate('/login')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell topLink={{ label: 'Sign in', to: '/login' }}>
      {regMethod === 'select' && (
        <MethodSelectionView
          inviteCode={inviteCode}
          iiLoading={iiLoading}
          error={error}
          identityError={identityError}
          onSelectEmail={() => { clearError(); setRegMethod('email'); }}
          onSelectII={handleIIRegister}
        />
      )}

      {regMethod === 'email' && (
        <EmailFormView
          inviteCode={inviteCode}
          error={error}
          isLoading={isLoading}
          formErrors={formErrors}
          showPassword={showPassword}
          register={register}
          handleSubmit={handleSubmit}
          onSubmit={onSubmit}
          onTogglePassword={() => setShowPassword(!showPassword)}
          onBack={handleBackToMethods}
        />
      )}

      {regMethod === 'ii-role' && (
        <IIRoleSelectionView
          iiRole={iiRole}
          onRoleChange={setIiRole}
          onComplete={handleIIRoleComplete}
        />
      )}
    </AuthShell>
  );
};

/* ------------------------------------------------------------------ */
/*  Notice                                                             */
/* ------------------------------------------------------------------ */

const Notice: React.FC<{ tone: 'error' | 'info'; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const styles =
    tone === 'error'
      ? 'border-[#DC2626]/30 bg-[#FEF2F2] text-[#DC2626]'
      : 'border-[#0D9488]/30 bg-[#CCFBF1]/30 text-[#0F766E]';
  return (
    <div className={`mb-6 rounded-md border p-4 font-dm-sans text-sm ${styles}`}>
      {children}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Method Selection                                                   */
/* ------------------------------------------------------------------ */

interface MethodSelectionProps {
  inviteCode: string | null;
  iiLoading: boolean;
  error: string | null;
  identityError: string | null;
  onSelectEmail: () => void;
  onSelectII: () => void;
}

const MethodSelectionView: React.FC<MethodSelectionProps> = ({
  inviteCode, iiLoading, error, identityError, onSelectEmail, onSelectII,
}) => (
  <>
    <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
      Create your account.
    </h1>
    <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
      {inviteCode
        ? 'Choose how to register and join the transaction.'
        : 'Choose how you want to register.'}
    </p>

    <div className="mt-10">
      {(error || identityError) && <Notice tone="error">{error || identityError}</Notice>}
      {inviteCode && (
        <Notice tone="info">
          You&apos;ve been invited to a transaction. Create an account to join.
        </Notice>
      )}

      <div className="space-y-3">
        <OAuthButtons disabled={iiLoading} intent="sign-up" />

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-[#E5E7EB]" />
          <span className="font-dm-sans text-xs uppercase tracking-wide text-[#9CA3AF]">or</span>
          <span className="h-px flex-1 bg-[#E5E7EB]" />
        </div>

        <MethodCard
          icon={<Mail className="h-5 w-5 text-[#5F8A68]" />}
          title="Register with email"
          subtitle="Create an account with your email and password."
          onClick={onSelectEmail}
          disabled={iiLoading}
        />
        {/*
          II *registration* stays gated, independent of II *login* (which is
          always on — see LoginPage). Registration is closed/waitlisted for
          now; flip VITE_ENABLE_II_REGISTRATION=true to reopen II sign-up.
        */}
        {import.meta.env.VITE_ENABLE_II_REGISTRATION === 'true' && (
          <MethodCard
            icon={
              iiLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#5F8A68]" />
              ) : (
                <Fingerprint className="h-5 w-5 text-[#5F8A68]" />
              )
            }
            title={iiLoading ? 'Connecting…' : 'Register with Internet Identity'}
            subtitle="Passkey-based decentralised sign-in."
            onClick={onSelectII}
            disabled={iiLoading}
          />
        )}
      </div>
    </div>

    <p className="mt-10 font-dm-sans text-sm text-[#6B7280]">
      Already have an account?{' '}
      <Link to="/login" className="font-medium text-[#0D9488] hover:underline">
        Sign in
      </Link>
    </p>
  </>
);

interface MethodCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  disabled?: boolean;
}

const MethodCard: React.FC<MethodCardProps> = ({ icon, title, subtitle, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="group flex w-full items-start gap-4 rounded-md border border-[#E5E7EB] bg-white px-4 py-4 text-left transition-colors hover:border-[#84A98C] hover:bg-[#F0F5F0] disabled:cursor-not-allowed disabled:opacity-60"
  >
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#DAE5DC]/60 group-hover:bg-[#DAE5DC]">
      {icon}
    </span>
    <span>
      <span className="block font-dm-sans text-sm font-semibold text-[#1A1A1A]">{title}</span>
      <span className="mt-0.5 block font-dm-sans text-sm text-[#6B7280]">{subtitle}</span>
    </span>
  </button>
);

/* ------------------------------------------------------------------ */
/*  Email Registration                                                 */
/* ------------------------------------------------------------------ */

interface EmailFormProps {
  inviteCode: string | null;
  error: string | null;
  isLoading: boolean;
  formErrors: Record<string, { message?: string }>;
  showPassword: boolean;
  register: ReturnType<typeof useForm<RegisterFormData>>['register'];
  handleSubmit: ReturnType<typeof useForm<RegisterFormData>>['handleSubmit'];
  onSubmit: (data: RegisterFormData) => Promise<void>;
  onTogglePassword: () => void;
  onBack: () => void;
}

const EmailFormView: React.FC<EmailFormProps> = ({
  inviteCode, error, isLoading, formErrors, showPassword,
  register: formRegister, handleSubmit, onSubmit,
  onTogglePassword, onBack,
}) => {
  const inputBase =
    'w-full rounded-md border bg-white px-4 py-3 font-dm-sans text-base text-[#1A1A1A] focus:outline-none focus:ring-1';
  const inputWithIcon = `${inputBase} pl-11`;

  return (
    <>
      <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Create your account.
      </h1>
      <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
        {inviteCode
          ? 'Register to join the property transaction.'
          : 'Join PropXchain for secure property transactions.'}
      </p>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 inline-flex items-center gap-1.5 font-dm-sans text-sm text-[#6B7280] transition-colors hover:text-[#0D9488]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Choose another method
      </button>

      <div className="mt-8">
        {error && <Notice tone="error">{error}</Notice>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="name" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
              Full name
            </label>
            <div className="relative mt-2">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                {...formRegister('name')}
                type="text"
                id="name"
                autoComplete="name"
                placeholder="John Smith"
                className={`${inputWithIcon} ${
                  formErrors.name
                    ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                    : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
                }`}
              />
            </div>
            {formErrors.name && (
              <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">{formErrors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
              Email
            </label>
            <div className="relative mt-2">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                {...formRegister('email')}
                type="email"
                id="email"
                autoComplete="email"
                placeholder="name@example.com"
                className={`${inputWithIcon} ${
                  formErrors.email
                    ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                    : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
                }`}
              />
            </div>
            {formErrors.email && (
              <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">{formErrors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
              Password
            </label>
            <div className="relative mt-2">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                {...formRegister('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={`${inputWithIcon} pr-12 ${
                  formErrors.password
                    ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                    : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
                }`}
              />
              <button
                type="button"
                onClick={onTogglePassword}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] transition-colors hover:text-[#1A1A1A]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formErrors.password && (
              <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">{formErrors.password.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
              I am a…
            </label>
            <select
              {...formRegister('role')}
              id="role"
              className={`mt-2 ${inputBase} ${
                formErrors.role
                  ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                  : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
              }`}
            >
              <option value="seller">Property seller</option>
              <option value="buyer">Property buyer</option>
              <option value="solicitor">Conveyancer / solicitor</option>
            </select>
            {formErrors.role && (
              <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">{formErrors.role.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0D9488] px-6 py-3 font-dm-sans text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating account…
              </>
            ) : (
              <>
                Create account
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 font-dm-sans text-sm text-[#6B7280]">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[#0D9488] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  II Role Selection (post-II auth)                                  */
/* ------------------------------------------------------------------ */

interface IIRoleProps {
  iiRole: string;
  onRoleChange: (role: string) => void;
  onComplete: () => void;
}

const IIRoleSelectionView: React.FC<IIRoleProps> = ({
  iiRole, onRoleChange, onComplete,
}) => (
  <>
    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#DAE5DC]">
      <CheckCircle className="h-6 w-6 text-[#5F8A68]" />
    </div>
    <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
      Almost there.
    </h1>
    <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
      Identity verified. Pick your role to finish setup.
    </p>

    <div className="mt-10 space-y-5">
      <div>
        <label htmlFor="ii-role" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
          I am a…
        </label>
        <select
          id="ii-role"
          value={iiRole}
          onChange={(e) => onRoleChange(e.target.value)}
          className="mt-2 w-full rounded-md border border-[#E5E7EB] bg-white px-4 py-3 font-dm-sans text-base text-[#1A1A1A] focus:border-[#0D9488] focus:outline-none focus:ring-1 focus:ring-[#0D9488]"
        >
          <option value="seller">Property seller</option>
          <option value="buyer">Property buyer</option>
          <option value="solicitor">Conveyancer / solicitor</option>
        </select>
      </div>

      <button
        onClick={onComplete}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0D9488] px-6 py-3 font-dm-sans text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
      >
        Complete registration
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  </>
);

/* ------------------------------------------------------------------ */
/*  Check Email (post email signup)                                   */
/* ------------------------------------------------------------------ */

const CheckEmailView: React.FC<{ email: string | null; onBack: () => void }> = ({ onBack }) => (
  <>
    <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#DAE5DC]">
      <Mail className="h-6 w-6 text-[#5F8A68]" />
    </div>
    <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
      Check your email.
    </h1>
    <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
      We&apos;ve sent a verification link. Click it to activate your account, then sign in to get started.
    </p>
    <button
      type="button"
      onClick={onBack}
      className="mt-10 inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#0D9488] px-6 py-3 font-dm-sans text-base font-medium text-white transition-colors hover:bg-[#0F766E]"
    >
      Go to sign in
      <ArrowRight className="h-5 w-5" />
    </button>
  </>
);

export default RegisterPage;
