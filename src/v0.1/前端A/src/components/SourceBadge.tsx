import React from 'react';
import { MessageCircle, Mail, UserPen } from 'lucide-react';
import { MessageSource } from '../types/message';

interface SourceBadgeProps {
  source: MessageSource;
  size?: 'sm' | 'md';
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, size = 'md' }) => {
  const configs = {
    whatsapp: {
      label: 'WhatsApp',
      icon: MessageCircle,
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    email: {
      label: 'Email',
      icon: Mail,
      bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
      iconColor: 'text-sky-600 dark:text-sky-400',
    },
    manual: {
      label: 'Manual Entry',
      icon: UserPen,
      bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  };

  const config = configs[source] || configs.manual;
  const Icon = config.icon;

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs font-medium gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium transition-colors ${config.bg} ${sizeClasses}`}
      title={`Source: ${config.label}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      <span>{config.label}</span>
    </span>
  );
};
