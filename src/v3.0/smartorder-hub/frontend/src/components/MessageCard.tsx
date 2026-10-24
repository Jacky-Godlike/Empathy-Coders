import React from 'react';
import {
  Sparkles,
  Loader2,
  ExternalLink,
  Trash2,
  ShoppingBag,
  MoreVertical,
  Check,
  AlertCircle,
} from 'lucide-react';
import { OrderMessage, RecognitionStatus } from '../types/message';
import { SourceBadge } from './SourceBadge';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';

const typeClasses: Record<string, string> = {
  order:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  inquiry: 'bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  after_sales: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  ad: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  other: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  uncertain:
    'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
};

const typeKeys: Record<string, string> = {
  order: 'message.type.order',
  inquiry: 'message.type.inquiry',
  after_sales: 'message.type.afterSales',
  ad: 'message.type.ad',
  other: 'message.type.other',
  uncertain: 'message.type.uncertain',
};

interface MessageCardProps {
  message: OrderMessage;
  isProcessing: boolean;
  onAnalyze: (id: string) => void;
  onViewDetails: (message: OrderMessage) => void;
  onUpdateStatus: (id: string, status: RecognitionStatus) => void;
  onDelete: (id: string) => void;
  canDelete: boolean;
}

export const MessageCard: React.FC<MessageCardProps> = ({
  message,
  isProcessing,
  onAnalyze,
  onViewDetails,
  onUpdateStatus,
  onDelete,
  canDelete,
}) => {
  const { t, locale } = useI18n();
  const [showStatusMenu, setShowStatusMenu] = React.useState(false);

  // Friendly relative time calculation
  const getRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 1) return t('time.justNow');
      if (diffMinutes < 60) return t('time.minutesAgo', { count: diffMinutes });
      if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
      if (diffDays === 1) return t('time.yesterday');
      return t('time.daysAgo', { count: diffDays });
    } catch {
      return t('time.recently');
    }
  };

  const formattedDate = new Date(message.timestamp).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const parsedItems = message.parsedData?.items || [];
  const totalAmount = message.parsedData?.totalEstimate;
  const messageType = message.parsedData?.messageType;

  return (
    <div
      className={`group bg-white dark:bg-slate-900 border rounded-xl p-4 sm:p-5 transition-all shadow-xs hover:shadow-md ${
        isProcessing
          ? 'border-blue-400 dark:border-blue-700 ring-2 ring-blue-100 dark:ring-blue-950/60'
          : message.status === 'recognized_as_order'
          ? 'border-emerald-200/80 dark:border-emerald-900/60 hover:border-emerald-300'
          : message.status === 'needs_human_review'
          ? 'border-amber-200/80 dark:border-amber-900/60 hover:border-amber-300'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Header: Source, Sender, Timestamp, and Quick Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={message.source} size="sm" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {message.sender}
          </h3>
          <span
            className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60"
            title={t('message.idTitle', { id: message.id })}
          >
            {message.id.startsWith('local-temp-')
              ? t('message.localId', { id: message.id })
              : `#${message.id}`}
          </span>
          {message.orderId && (
            <span className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900">
              {message.orderId}
            </span>
          )}
          {messageType && typeClasses[messageType] && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeClasses[messageType]}`}
            >
              {t(typeKeys[messageType])}
            </span>
          )}
          {message.contact && (
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
              ({message.contact})
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs text-slate-400 dark:text-slate-500 font-mono"
            title={t('message.receivedOnTitle', { date: formattedDate })}
          >
            {getRelativeTime(message.timestamp)}
          </span>

          {/* Quick status change menu */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              type="button"
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              title={t('message.changeStatus')}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showStatusMenu && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowStatusMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-30 text-xs">
                  <div className="px-3 py-1 font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                    {t('message.setStatus')}
                  </div>
                  {(
                    [
                      'not_analyzed',
                      'recognized_as_order',
                      'needs_human_review',
                      'not_an_order',
                    ] as RecognitionStatus[]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        onUpdateStatus(message.id, s);
                        setShowStatusMenu(false);
                      }}
                      className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700/60 flex items-center justify-between text-slate-700 dark:text-slate-200"
                    >
                      <span>{t(`status.${s}`)}</span>
                      {message.status === s && (
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                      )}
                    </button>
                  ))}
                  {canDelete && (
                    <>
                      <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                      <button
                        onClick={() => {
                          onDelete(message.id);
                          setShowStatusMenu(false);
                        }}
                        className="w-full text-left px-3 py-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('message.delete')}</span>
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Message Body */}
      <div className="mb-4">
        <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed font-normal bg-slate-50/70 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
          {message.originalText}
        </p>
      </div>

      {/* Recognized Order Preview Chip (If order was detected) */}
      {message.status === 'recognized_as_order' && parsedItems.length > 0 && (
        <div className="mb-3.5 p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
            <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>{t('message.itemsParsed', { count: parsedItems.length })}</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-normal truncate max-w-xs">
              {parsedItems.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
            </span>
          </div>
          {totalAmount !== undefined && (
            <span className="font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded">
              {t('message.est', { amount: `RM ${totalAmount.toFixed(2)}` })}
            </span>
          )}
        </div>
      )}

      {/* Review note indicator if present */}
      {message.reviewNotes && (
        <div className="mb-3.5 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600" />
          <span>
            <strong>{t('message.staffNote')}</strong> {message.reviewNotes}
          </span>
        </div>
      )}

      {/* Footer: Status Badge and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2">
          <StatusBadge status={isProcessing ? 'processing' : message.status} />
          {message.parsedData?.confidenceScore && message.status !== 'not_analyzed' && (
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {t('message.confidence', { count: message.parsedData.confidenceScore })}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Analyze as Order Button */}
          <button
            onClick={() => onAnalyze(message.id)}
            disabled={isProcessing}
            type="button"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shadow-xs ${
              isProcessing
                ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                : message.status === 'not_analyzed'
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}
            title={t('message.analyzeTitle')}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t('message.analyzing')}</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {message.status === 'not_analyzed'
                    ? t('message.analyze')
                    : t('message.reanalyze')}
                </span>
              </>
            )}
          </button>

          {/* View Details Button */}
          <button
            onClick={() => onViewDetails(message)}
            type="button"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <span>{t('message.details')}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
