import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  // Base: transição uniforme 150ms, altura consistente, focus limpo (sem outline default do browser).
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-interaction focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:bg-navy-800 hover:shadow-hover hover:-translate-y-px active:bg-navy-900 active:translate-y-0 dark:hover:bg-gold-600 dark:active:bg-gold-700',
        secondary:
          'border border-input bg-white text-foreground hover:bg-muted hover:border-neutral-700 active:bg-neutral-150',
        ghost:
          'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
        destructive:
          'bg-error-600 text-white hover:bg-error-700',
        accent:
          'bg-gold-500 text-[#06120B] hover:bg-gold-600 active:bg-gold-700',
        link:
          'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // Altura consistente: 40px para md (padrão), 32 para sm, 48 para lg.
        sm: 'h-8 rounded-md px-3 text-xs',
        md: 'h-10 rounded-md px-4 text-sm',
        lg: 'h-12 rounded-md px-6 text-base',
        icon: 'h-10 w-10 rounded-md',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : leftIcon}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);
Button.displayName = 'Button';

function ButtonGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0 [&>button]:rounded-none [&>button:first-child]:rounded-l-lg [&>button:last-child]:rounded-r-lg [&>button:not(:first-child)]:border-l-0', className)}>
      {children}
    </div>
  );
}

export { Button, ButtonGroup, buttonVariants };
export type { ButtonProps };
