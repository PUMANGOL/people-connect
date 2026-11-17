import { type ReactNode, type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from './button';

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { hoverable?: boolean }>(
  ({ className, hoverable, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-border bg-card text-card-foreground p-6 shadow-card transition-[box-shadow,border-color,transform] duration-200 ease-interaction',
        hoverable && 'cursor-pointer hover:shadow-hover hover:border-[var(--lift-border)] hover:-translate-y-px',
        className
      )}
      {...props}
    />
  )
);
Card.displayName = 'Card';

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-start justify-between gap-3 mb-5', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-base font-semibold text-neutral-900 tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

type TrendDirection = 'up' | 'down' | 'neutral';

interface StatCardProps {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  value: string | number;
  trend?: { value: string; direction: TrendDirection };
  className?: string;
  onClick?: () => void;
}

function StatCard({ icon, iconBg, title, value, trend, className, onClick }: StatCardProps) {
  // KPI corporativo: valor protagonista, ícone discreto no topo direito,
  // sem fundo colorido dominante. Enterprise-style (Linear/Notion/M365).
  return (
    <Card
      hoverable={Boolean(onClick)}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      className={cn(
        'flex flex-col justify-between p-6 min-h-[120px] text-left',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-500">
          {title}
        </p>
        <div className={cn(
          'flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center',
          iconBg ?? 'text-neutral-400 bg-neutral-50',
        )}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[2rem] leading-none font-bold text-neutral-900 tabular-nums tracking-tight">
          {value}
        </p>
        {trend && (
          <div className={cn(
            'flex items-center gap-1 mt-2 text-xs font-medium',
            trend.direction === 'up' && 'text-success-600',
            trend.direction === 'down' && 'text-brand-red-500',
            trend.direction === 'neutral' && 'text-neutral-500',
          )}>
            {trend.direction === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend.direction === 'down' && <TrendingDown className="w-3 h-3" />}
            {trend.direction === 'neutral' && <Minus className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
    </Card>
  );
}

interface ListCardProps {
  title: string;
  action?: ReactNode;
  items: { id: string; content: ReactNode }[];
  className?: string;
}

function ListCard({ title, action, items, className }: ListCardProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <div className="divide-y divide-border -mx-6">
        {items.map((item) => (
          <div key={item.id} className="px-6 py-3">
            {item.content}
          </div>
        ))}
      </div>
    </Card>
  );
}

interface ActionCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

function ActionCard({ icon, title, description, actionLabel, onAction, className }: ActionCardProps) {
  return (
    <Card hoverable className={cn('text-center flex flex-col items-center', className)}>
      <div className="w-12 h-12 rounded-xl bg-neutral-100 text-navy-700 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-neutral-900 mb-2">{title}</h3>
      <p className="text-sm text-neutral-500 mb-4">{description}</p>
      <Button variant="primary" size="sm" onClick={onAction}>{actionLabel}</Button>
    </Card>
  );
}

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-8 text-center rounded-xl border border-dashed border-neutral-200 bg-white', className)}>
      <div className="w-16 h-16 rounded-xl bg-neutral-100 text-neutral-400 flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-neutral-900 mb-1.5">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-md mb-6 leading-relaxed">{description}</p>
      {action && (
        <Button variant="primary" onClick={action.onClick}>{action.label}</Button>
      )}
    </div>
  );
}

export { Card, CardHeader, CardTitle, CardContent, StatCard, ListCard, ActionCard, EmptyState };
export type { StatCardProps, ListCardProps, ActionCardProps, EmptyStateProps };
