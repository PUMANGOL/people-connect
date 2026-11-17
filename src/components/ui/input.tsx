import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type ReactNode, type RefObject, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import {
  Select as SelectRoot, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border bg-white px-3.5 py-2 text-sm transition-[border-color,box-shadow] duration-200 ease-interaction',
          'placeholder:text-neutral-400',
          'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error ? 'border-error-600 focus-visible:ring-error-600 focus-visible:border-error-600' : 'border-input',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  autoResize?: boolean;
  maxLength?: number;
  showCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, autoResize, maxLength, showCount, value, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const textareaRef = (ref as RefObject<HTMLTextAreaElement>) || internalRef;

    useEffect(() => {
      if (autoResize && textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
    }, [value, autoResize, textareaRef]);

    const currentLength = typeof value === 'string' ? value.length : 0;

    return (
      <div className="relative">
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-md border bg-white px-3.5 py-2.5 text-sm transition-all duration-200 ease-interaction resize-y',
            'placeholder:text-neutral-400',
            'focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-focus',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-error-600 focus-visible:ring-error-600 focus-visible:border-error-600' : 'border-input',
            autoResize && 'resize-none overflow-hidden',
            className
          )}
          ref={textareaRef}
          maxLength={maxLength}
          value={value}
          {...props}
        />
        {showCount && maxLength && (
          <span className="absolute bottom-2 right-3 text-xs text-muted-foreground">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}

function FormField({ label, required, error, hint, children, className }: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label className="text-sm font-medium text-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-error-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-error-500">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  /** Texto quando não há valor. Também fica como primeira opção (escolhê-la limpa o valor). */
  placeholder?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
}

// O Select do shadcn não aceita string vazia como item: o placeholder usa este valor.
const SEM_VALOR = '__sem_valor__';

/** Select da aplicação, sobre o Select do shadcn/ui (base-ui). Valor vazio = placeholder. */
function Select({ className, options, placeholder, error, value, onChange, disabled, id, name, ...rest }: SelectProps) {
  const items = placeholder ? [{ value: SEM_VALOR, label: placeholder }, ...options] : options;
  const actual = value ? value : placeholder ? SEM_VALOR : null;

  return (
    <SelectRoot
      items={items}
      value={actual}
      onValueChange={(v) => onChange?.(v == null || v === SEM_VALOR ? '' : String(v))}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger
        id={id}
        aria-label={rest['aria-label']}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-10 w-full rounded-md bg-white px-3.5 text-sm',
          error ? 'border-error-500' : 'border-input',
          !value && 'text-muted-foreground',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

export { Input, Textarea, FormField, Select };
export type { InputProps, TextareaProps, FormFieldProps, SelectProps, SelectOption };
