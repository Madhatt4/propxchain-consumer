import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';

export default function MaintenanceNotice(): ReactElement {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <header className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
        <Link to="/" className="font-fraunces text-xl font-bold tracking-tight text-[#1A1A1A] dark:text-white">
          PropXchain
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-lg w-full">
          <div className="rounded-2xl border border-[#84A98C]/30 bg-[#F4F1EB] dark:bg-gray-800 px-8 py-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#84A98C]/20 mb-5">
              <span aria-hidden className="text-2xl">🛠️</span>
            </div>
            <h1 className="font-fraunces text-3xl font-bold text-[#1A1A1A] dark:text-white mb-3">
              Sign-ups open at launch
            </h1>
            <p className="font-dm-sans text-base text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              PropXchain is in private testing while we finalise the AGPL release.
              New account creation re-opens for everyone at general launch.
            </p>
            <p className="font-dm-sans text-sm text-gray-500 dark:text-gray-400 mb-8">
              Already have an account? Sign in below. Want to be told when sign-ups
              open? Email{' '}
              <a
                href="mailto:info@propxchain.com?subject=Notify%20me%20at%20launch"
                className="text-[#0D9488] dark:text-teal-400 hover:underline font-medium"
              >
                info@propxchain.com
              </a>
              .
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#1A1A1A] dark:bg-teal-600 text-white font-dm-sans text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Sign in
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-dm-sans text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Back to home
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
