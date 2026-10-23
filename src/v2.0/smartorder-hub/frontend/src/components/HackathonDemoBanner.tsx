import React, { useState } from 'react';
import { Sparkles, Info, X, RotateCcw, Cable } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

interface HackathonDemoBannerProps {
  onResetData: () => void;
  onOpenChannels: () => void;
  isResetting: boolean;
}

export const HackathonDemoBanner: React.FC<HackathonDemoBannerProps> = ({
  onResetData,
  onOpenChannels,
  isResetting,
}) => {
  const { t } = useI18n();
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  return (
    <div className="bg-gradient-to-r from-amber-800 via-orange-900 to-slate-900 text-white rounded-2xl p-4 sm:p-5 mb-6 shadow-md relative overflow-hidden">
      <div className="absolute -right-12 -top-12 w-48 h-48 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-amber-300" />
              SDC Hackathon 2026 · Domain 2
            </span>
            <span className="text-xs text-amber-100/80">{t('banner.livePipeline')}</span>
          </div>

          <h3 className="text-sm sm:text-base font-semibold text-white">
            {t('banner.flow')}
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">{t('banner.body')}</p>

          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Info className="w-3 h-3" />
            {t('banner.notice')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={onOpenChannels}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 transition border border-emerald-300/20"
          >
            <Cable className="w-3.5 h-3.5" />
            <span>{t('banner.manageChannels')}</span>
          </button>

          <button
            onClick={onResetData}
            disabled={isResetting}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white transition border border-white/10"
            title={t('banner.resetTitle')}
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{t('banner.reset')}</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
            title={t('banner.dismiss')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
