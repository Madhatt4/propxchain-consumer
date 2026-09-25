// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 PropXchain Ltd

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowRight, ArrowLeft, Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginEmailFormProps {
  onSubmit: (email: string, password: string) => Promise<void>;
  /** True while THIS form's submission is in flight — not while a sibling
   *  method (Internet Identity) is connecting. */
  isSubmitting: boolean;
  /** Disabled while any sign-in attempt is running, including a sibling's. */
  disabled: boolean;
  onBack: () => void;
}

/**
 * Email + password half of the sign-in surface. Owns its own react-hook-form
 * instance so neither frame that renders it (the /login page, the landing
 * page's dialog) has to thread form state through itself.
 */
const LoginEmailForm: React.FC<LoginEmailFormProps> = ({
  onSubmit,
  isSubmitting,
  disabled,
  onBack,
}) => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const inputBase =
    'w-full rounded-md border bg-white px-4 py-3 pl-11 font-dm-sans text-base text-[#1A1A1A] focus:outline-none focus:ring-1';

  const submit = handleSubmit((data) => onSubmit(data.email, data.password));

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-1.5 font-dm-sans text-sm text-[#6B7280] transition-colors hover:text-[#0D9488]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Choose another method
      </button>

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label
            htmlFor="email"
            className="block font-dm-sans text-sm font-medium text-[#1A1A1A]"
          >
            Email
          </label>
          <div className="relative mt-2">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              {...register('email')}
              type="email"
              id="email"
              autoComplete="email"
              placeholder="name@example.com"
              className={`${inputBase} ${
                formErrors.email
                  ? 'border-[#DC2626] focus:border-[#DC2626] focus:ring-[#DC2626]'
                  : 'border-[#E5E7EB] focus:border-[#0D9488] focus:ring-[#0D9488]'
              }`}
            />
          </div>
          {formErrors.email && (
            <p className="mt-1.5 font-dm-sans text-xs text-[#DC2626]">
              {formErrors.email.message}
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor="password"
            className="block font-dm-sans text-sm font-medium text-[#1A1A1A]"
          >
            Password
          </label>
          <div className="relative mt-2">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="current-password"
              placeholder="Enter your password"
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

        <div className="flex justify-end">
          {/* Was grey #6B7280, text-sm, no underline, no minimum height — it
              read as a caption rather than a control, so users who needed it
              did not see it. Now sage + underlined + 44px (WCAG 2.5.5). */}
          <button
            type="button"
            onClick={() => navigate('/forgot-password')}
            className="inline-flex min-h-11 items-center font-dm-sans text-sm font-medium text-[#0D9488] underline underline-offset-2 transition-colors hover:text-[#0F766E] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0D9488]"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="submit"
          disabled={disabled}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0D9488] px-6 py-3 font-dm-sans text-base font-medium text-white transition-colors hover:bg-[#0F766E] disabled:cursor-not-allowed disabled:bg-[#9CA3AF]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-5 w-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default LoginEmailForm;
