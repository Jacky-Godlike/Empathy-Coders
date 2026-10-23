import React from 'react';
import { Facebook, Instagram, Mail, MessageCircle, Music2, Send, UserPen } from 'lucide-react';
import { MessageSource } from '../types/message';
import { useI18n } from '../i18n/I18nContext';

interface SourceBadgeProps {
  source: MessageSource;
  size?: 'sm' | 'md';
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({ source, size = 'md' }) => {
  const { t } = useI18n();

  const configs = {
    whatsapp: {
      label: t('source.whatsapp'),
      icon: MessageCircle,
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
    },
    facebook: {
      label: t('source.facebook'),
      icon: Facebook,
      bg: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    instagram: {
      label: t('source.instagram'),
      icon: Instagram,
      bg: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800',
      iconColor: 'text-fuchsia-600 dark:text-fuchsia-400',
    },
    telegram: {
      label: t('source.telegram'),
      icon: Send,
      bg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
      iconColor: 'text-cyan-600 dark:text-cyan-400',
    },
    email: {
      label: t('source.email'),
      icon: Mail,
      bg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800',
      iconColor: 'text-sky-600 dark:text-sky-400',
    },
    tiktok: {
      label: t('source.tiktok'),
      icon: Music2,
      bg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
      iconColor: 'text-rose-600 dark:text-rose-400',
    },
    manual: {
      label: t('source.manual'),
      icon: UserPen,
      bg: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      iconColor: 'text-amber-600 dark:text-amber-400',
    },
  };

  const config = configs[source] || configs.manual;
  const Icon = config.icon;

  const sizeClasses =
    size === 'sm' ? 'px-2 py-0.5 text-xs gap-1' : 'px-2.5 py-1 text-xs font-medium gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium transition-colors ${config.bg} ${sizeClasses}`}
      title={`${t('channels.channel')}: ${config.label}`}
    >
      <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
      <span>{config.label}</span>
    </span>
  );
};
