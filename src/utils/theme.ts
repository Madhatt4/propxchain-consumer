// Theme utility functions
export type Theme = 'dark' | 'light';

export const getTheme = (): Theme => {
  // Migrate legacy 'theme' key used by old SettingsPage
  const legacyTheme = localStorage.getItem('theme');
  if (legacyTheme === 'dark' || legacyTheme === 'light') {
    const settings = JSON.parse(localStorage.getItem('settings') || '{}');
    settings.theme = legacyTheme;
    localStorage.setItem('settings', JSON.stringify(settings));
    localStorage.removeItem('theme');
    return legacyTheme;
  }

  const settings = localStorage.getItem('settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      return parsed.theme || 'light';
    } catch {
      return 'light';
    }
  }
  return 'light';
};

export const setTheme = (theme: Theme) => {
  const settings = JSON.parse(localStorage.getItem('settings') || '{}');
  settings.theme = theme;
  localStorage.setItem('settings', JSON.stringify(settings));

  // Update document class for global theme
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

export const getThemeClasses = (theme: Theme = getTheme()) => {
  if (theme === 'light') {
    return {
      // Page backgrounds
      pageBg: 'bg-gray-50',

      // Headers
      headerBg: 'bg-white shadow-lg border-b border-gray-200',
      headerText: 'text-black',
      headerSubtext: 'text-black',

      // Cards
      cardBg: 'bg-white border border-gray-200',
      cardSecondary: 'bg-gray-50 border border-gray-200',
      cardTertiary: 'bg-gray-100',

      // Text
      textPrimary: 'text-black',
      textSecondary: 'text-black',
      textTertiary: 'text-black',

      // Borders
      border: 'border-gray-200',
      borderHover: 'border-gray-300',

      // Buttons
      btnSecondary: 'border border-gray-300 text-black hover:bg-gray-50',

      // Navigation
      navText: 'text-black hover:text-black',
      navActive: 'bg-gray-800 text-white',

      // Status colors (kept consistent)
      success: 'bg-green-50 border-green-200 text-green-800',
      error: 'bg-red-50 border-red-200 text-red-800',
      warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      info: 'bg-gray-50 border-gray-200 text-gray-800',

      // Loading spinner
      spinner: 'border-gray-600',

      // Progress bar
      progressBarTrack: 'bg-gray-200',
    };
  }

  // Dark theme (default)
  return {
    // Page backgrounds
    pageBg: 'bg-gray-900',

    // Headers
    headerBg: 'bg-gray-800 shadow-lg border-b border-gray-700',
    headerText: 'text-white',
    headerSubtext: 'text-gray-400',

    // Cards
    cardBg: 'bg-gray-800 border border-gray-700',
    cardSecondary: 'bg-gray-700 border border-gray-600',
    cardTertiary: 'bg-gray-600',

    // Text
    textPrimary: 'text-white',
    textSecondary: 'text-gray-400',
    textTertiary: 'text-gray-500',

    // Borders
    border: 'border-gray-700',
    borderHover: 'border-gray-600',

    // Buttons
    btnSecondary: 'border border-gray-600 text-gray-300 hover:bg-gray-700',

    // Navigation
    navText: 'text-gray-300 hover:text-white',
    navActive: 'bg-gray-700 text-white',

    // Status colors
    success: 'bg-green-900 bg-opacity-20 border-green-700 text-green-300',
    error: 'bg-red-900 bg-opacity-20 border-red-700 text-red-300',
    warning: 'bg-yellow-900 bg-opacity-20 border-yellow-700 text-yellow-300',
    info: 'bg-gray-800 bg-opacity-20 border-gray-600 text-gray-300',

    // Loading spinner
    spinner: 'border-gray-500',

    // Progress bar
    progressBarTrack: 'bg-gray-700',
  };
};

// Initialize theme on load
export const initTheme = () => {
  const theme = getTheme();
  setTheme(theme);
};
