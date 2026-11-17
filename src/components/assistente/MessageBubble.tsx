import type { ReactNode } from 'react';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  isLoading?: boolean;
  className?: string;
}

/** Bolha inspirada em Lweji — glass + avatar brand (Pumangol navy/gold). */
export function MessageBubble({ role, children, isLoading, className }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div className={cn('ml-auto max-w-[min(100%,36rem)]', className)}>
        <div className="rounded-[22px] rounded-br-md bg-navy-700 px-4 py-3 text-[15px] leading-[1.65] text-white shadow-[0_8px_24px_rgba(27,43,75,0.18)]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('w-full max-w-[min(100%,40rem)]', className)}>
      <div className="mb-2.5 ml-0.5 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full shadow-[0_2px_10px_rgba(23,184,95,0.35),inset_0_1px_1px_rgba(255,255,255,0.45)]"
          style={{
            background: 'linear-gradient(135deg, #3FCE7C 0%, #17B85F 45%, #1A5334 160%)',
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        >
          <Bot className="h-4 w-4 text-white drop-shadow-sm" />
        </div>
        <span className="text-[13px] font-semibold tracking-wide text-navy-800">Agente DPC</span>
      </div>

      <div
        className={cn(
          'rounded-2xl border border-white/60 bg-white/55 p-4 shadow-[0_8px_32px_rgba(27,43,75,0.06),inset_0_1px_1px_rgba(255,255,255,0.9)] backdrop-blur-2xl sm:p-5',
          'text-[15px] leading-[1.7] text-navy-800'
        )}
      >
        {children}
        {isLoading && (
          <span
            className="ml-0.5 inline-block h-[1.05em] w-[2px] animate-pulse bg-gold-500 align-text-bottom"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function ThinkingIndicator({ label = 'A pensar…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-0.5">
      <span className="agent-thinking-pulse" aria-hidden />
      <span className="agent-thinking-shimmer text-[14px]">{label}</span>
    </div>
  );
}
