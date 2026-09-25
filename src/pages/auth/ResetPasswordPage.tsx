// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025 PropXchain Ltd

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { Lock, Loader2, CheckCircle, Eye, EyeOff } from 'lucide-react';
import AuthShell from '../../components/auth/AuthShell';

const resetSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetFormData = z.infer<typeof resetSchema>;

const ResetPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type');

    async function verifyToken(): Promise<void> {
      try {
        if (tokenHash && type === 'recovery') {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });
          if (verifyError) {
            setError('Recovery link expired or invalid. Please request a new one.');
          }
        } else {
          // No token in the URL: only an existing session (the reset link was
          // already exchanged) can proceed. Tokens are never taken from the
          // URL itself (security scan M6).
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setError('No recovery token found. Please use the link from your email.');
          }
        }
      } catch {
        setError('Failed to verify recovery token.');
      } finally {
        setIsVerifying(false);
      }
    }

    verifyToken();
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: ResetFormData): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setIsSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch {
      setError('Failed to reset password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <AuthShell>
        <div className="flex flex-col items-center justify-center text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#5F8A68]" />
          <p className="mt-4 font-dm-sans text-sm text-[#6B7280]">
            Verifying your recovery link…
          </p>
        </div>
      </AuthShell>
    );
  }

  if (isSuccess) {
    return (
      <AuthShell>
        <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#DAE5DC]">
          <CheckCircle className="h-6 w-6 text-[#5F8A68]" />
        </div>
        <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
          Password updated.
        </h1>
        <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
          Redirecting you to sign in…
        </p>
      </AuthShell>
    );
  }

  const inputBase =
    'w-full rounded-md border bg-white px-4 py-3 pl-11 font-dm-sans text-base text-[#1A1A1A] focus:outline-none focus:ring-1';

  return (
    <AuthShell topLink={{ label: 'Sign in', to: '/login' }}>
      <h1 className="font-fraunces text-[2rem] font-semibold leading-tight tracking-tight text-[#1A1A1A] sm:text-[2.5rem]">
        Reset your password.
      </h1>
      <p className="mt-3 max-w-md font-dm-sans text-base text-[#6B7280]">
        Choose a new password to finish.
      </p>

      <div className="mt-10">
        {error && (
          <div className="mb-6 rounded-md border border-[#DC2626]/30 bg-[#FEF2F2] p-4 font-dm-sans text-sm text-[#DC2626]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label htmlFor="password" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
              New password
            </label>
            <div className="relative mt-2">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                id="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={`${inputBase} pr-12 ${
                  formErrors.password
                    ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                    : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#6B7280] transition-colors hover:text-[#1A1A1A]"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {formErrors.password && (
              <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">
                {formErrors.password.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block font-dm-sans text-sm font-medium text-[#1A1A1A]">
              Confirm password
            </label>
            <div className="relative mt-2">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
              <input
                {...register('confirmPassword')}
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={`${inputBase} ${
                  formErrors.confirmPassword
                    ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                    : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
                }`}
              />
            </div>
            {formErrors.confirmPassword && (
              <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">
                {formErrors.confirmPassword.message}
              </p>
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
                Updating password…
              </>
            ) : (
              'Update password'
            )}
          </button>
        </form>
      </div>
    </AuthShell>
  );
};

export default ResetPasswordPage;
