import React from 'react';
import { Clock, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { RecognitionStatus } from '../types/message';

interface StatusBadgeProps {
  status: RecognitionStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const configs: Record<
    RecognitionStatus,
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      bg: string;
      text: string;
      border: string;
      iconColor: string;
      pulse?: boolean;
    }
  > = {
    not_analyzed: {
      label: 'Not Analyzed',
      icon: Clock,
      bg: 'bg-slate-100 dark:bg-slate-800',
      text: 'text-slate-700 dark:text-slate-300',
      border: 'border-slate-200 dark:border-slate-700',
      iconColor: 'text-slate-500 dark:text-slate-400',
    },
    processing: {
      label: 'Processing',
      icon: Loader2,
      bg: 'bg-blue-50 dark:bg-blue-950/50',
      text: 'text-blue-700 dark:text-blue-300',
      border: 'border-blue-200 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400 animate-spin',
      pulse: true,
    },
    recognized_as_order: {
      label: 'Recognized as Order',
      icon: CheckCircle2,
      bg: 'bg-emerald-50 dark:bg-emerald-950/50',
      text: 'text-emerald-800 dark:text-emerald-300',
      border: 'border-emerald-200 dark:border-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    not_an_order: {
      label: 'Not an Order',
      icon: XCircle,
      bg: 'bg-rose-50 dark:bg-rose-950/50',
      text: 'text-rose-700 dark:text-rose-300',
      border: 'border-rose-200 dark:border-rose-800',
      iconColor: 'text-rose-500 dark:text-rose-400',
    },
    needs_human_review: {
      label: 'Needs Human Review',
      icon: AlertTriangle,
      bg: 'bg-amber-50 dark:bg-amber-950/50',
      text: 'text-amber-800 dark:text-amber-300',
      border: 'border-amber-200 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  };

  const config = configs[status] || configs.not_analyzed;
  const Icon = config.icon;

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs font-medium gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium transition-all ${
        config.bg
      } ${config.text} ${config.border} ${sizeClasses} ${
        config.pulse ? 'ring-2 ring-blue-400/30' : ''
      }`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${config.iconColor}`} />
      <span className="whitespace-nowrap">{config.label}</span>
    </span>
  );
};
