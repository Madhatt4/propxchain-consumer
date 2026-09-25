import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import { OscarChat } from './OscarChat';
import { authUtils } from '../../utils/auth';

interface OscarButtonProps {
  transactionId?: string;
}

export const OscarButton: React.FC<OscarButtonProps> = ({
  transactionId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = (): void => {
      setIsAuthenticated(authUtils.isAuthenticated());
    };

    checkAuth();

    const handleStorageChange = (): void => checkAuth();
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(checkAuth, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Don't render on /oscar page (already has full Oscar interface)
  if (location.pathname === '/oscar') {
    return null;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <>
      {isOpen && (
        <OscarChat
          transactionId={transactionId}
          onClose={() => setIsOpen(false)}
        />
      )}

      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed bottom-4 right-4 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 z-50 ${
          isOpen
            ? 'bg-stone-600 hover:bg-stone-700 rotate-0'
            : 'bg-gradient-to-br from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 shadow-teal-500/30 hover:scale-110'
        }`}
        title={isOpen ? 'Close Oscar' : 'Chat with Oscar'}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Sparkles className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  );
};
