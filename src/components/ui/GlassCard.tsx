import type { ReactNode } from 'react';

type GlassVariant = 'default' | 'teal' | 'green' | 'amber' | 'purple';

interface GlassCardProps {
  variant?: GlassVariant;
  glow?: boolean;
  className?: string;
  children: ReactNode;
}

const variantClasses: Record<GlassVariant, string> = {
  default: 'glass',
  teal: 'glass-teal',
  green: 'glass-green',
  amber: 'glass-amber',
  purple: 'glass-purple',
};

const glowClasses: Record<GlassVariant, string> = {
  default: '',
  teal: 'glow-teal',
  green: 'glow-green',
  amber: '',
  purple: '',
};

export function GlassCard({ variant = 'default', glow = false, className = '', children }: GlassCardProps): ReactNode {
  const base = variantClasses[variant];
  const glowClass = glow ? glowClasses[variant] : '';
  return (
    <div className={`rounded-2xl ${base} ${glowClass} ${className}`}>
      {children}
    </div>
  );
}
