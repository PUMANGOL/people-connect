import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { getInitials } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-sm font-medium transition-colors duration-200',
  {
    variants: {
      variant: {
        success: 'bg-success-50 text-success-700 border border-success-100',
        warning: 'bg-warning-50 text-warning-600 border border-warning-100',
        error: 'bg-error-50 text-error-600 border border-error-100',
        info: 'bg-info-50 text-info-600 border border-info-100',
        neutral: 'bg-primary-tint-8 text-primary border border-primary/10',
        accent: 'bg-gold-50 text-gold-800 border border-gold-200',
      },
      size: {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'neutral',
      size: 'md',
    },
  }
);

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  dot?: boolean;
  children?: ReactNode;
  className?: string;
}

function Badge({ className, variant, size, dot, children }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)}>
      {dot && (
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          variant === 'success' && 'bg-success-500',
          variant === 'warning' && 'bg-warning-500',
          variant === 'error' && 'bg-error-500',
          variant === 'info' && 'bg-info-500',
          variant === 'neutral' && 'bg-navy-400',
          variant === 'accent' && 'bg-gold-500',
        )} />
      )}
      {children}
    </span>
  );
}

interface StatusDotProps {
  color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  label: string;
  className?: string;
}

function StatusDot({ color, label, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm', className)}>
      <span className={cn(
        'w-2 h-2 rounded-full flex-shrink-0',
        color === 'success' && 'bg-success-500',
        color === 'warning' && 'bg-warning-500',
        color === 'error' && 'bg-error-500',
        color === 'info' && 'bg-info-500',
        color === 'neutral' && 'bg-navy-300',
      )} />
      {label}
    </span>
  );
}

interface ProgressBarProps {
  value: number;
  max?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function ProgressBar({ value, max = 100, showLabel, size = 'md', className }: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const color = pct >= 75 ? 'bg-success-500' : pct >= 40 ? 'bg-gold-500' : 'bg-error-500';
  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn('flex-1 rounded-full bg-navy-100 overflow-hidden', heights[size])}>
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-sm font-medium text-foreground tabular-nums w-10 text-right">{Math.round(pct)}%</span>}
    </div>
  );
}

interface ProgressRingProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function ProgressRing({ value, max = 100, size = 48, strokeWidth = 4, className }: ProgressRingProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 75 ? 'stroke-success-500' : pct >= 40 ? 'stroke-gold-500' : 'stroke-error-500';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" className="stroke-navy-100" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none"
          className={cn(color, 'transition-all duration-500 ease-out')}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-semibold text-foreground">{Math.round(pct)}%</span>
    </div>
  );
}

interface TagProps {
  label: string;
  onRemove?: () => void;
  className?: string;
}

function Tag({ label, onRemove, className }: TagProps) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-sm bg-primary-tint-8 text-primary px-2 py-1 text-xs font-medium', className)}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="hover:text-navy-900 transition-colors">
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline';
  className?: string;
}

function Avatar({ src, name, size = 'md', status, className }: AvatarProps) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  const statusSizes = { sm: 'w-2 h-2', md: 'w-2.5 h-2.5', lg: 'w-3 h-3' };

  return (
    <div className={cn('relative inline-flex', className)}>
      {src ? (
        <img src={src} alt={name} className={cn('rounded-full object-cover', sizes[size])} />
      ) : (
        <div className={cn('avatar-iniciais rounded-full bg-navy-100 text-navy-700 flex items-center justify-center font-semibold', sizes[size])}>
          {getInitials(name)}
        </div>
      )}
      {status && (
        <span className={cn(
          'absolute bottom-0 right-0 rounded-full border-2 border-white',
          statusSizes[size],
          status === 'online' ? 'bg-success-500' : 'bg-navy-300',
        )} />
      )}
    </div>
  );
}

interface AvatarGroupProps {
  avatars: { name: string; src?: string | null }[];
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function AvatarGroup({ avatars, max = 4, size = 'md', className }: AvatarGroupProps) {
  const visible = avatars.slice(0, max);
  const overflow = avatars.length - max;
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visible.map((a, i) => (
        <span key={i}><Avatar name={a.name} src={a.src} size={size} className="ring-2 ring-white" /></span>
      ))}
      {overflow > 0 && (
        <div className={cn('avatar-iniciais rounded-full bg-navy-200 text-navy-700 flex items-center justify-center font-semibold ring-2 ring-white', sizes[size])}>
          +{overflow}
        </div>
      )}
    </div>
  );
}

export { Badge, StatusDot, ProgressBar, ProgressRing, Tag, Avatar, AvatarGroup, badgeVariants };
export type { BadgeProps, StatusDotProps, ProgressBarProps, ProgressRingProps, TagProps, AvatarProps, AvatarGroupProps };
