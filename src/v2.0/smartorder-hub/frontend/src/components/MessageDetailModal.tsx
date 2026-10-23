import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  MapPin,
  Calendar,
  ShoppingBag,
  FileEdit,
  Save,
} from 'lucide-react';
import { OrderMessage, RecognitionStatus } from '../types/message';
import { SourceBadge } from './SourceBadge';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';

interface MessageDetailModalProps {
  message: OrderMessage | null;
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (id: string) => Promise<void>;
  onReviewOrder: (message: OrderMessage) => Promise<void>;
  onUpdateStatus: (
    id: string,
    status: RecognitionStatus,
    notes?: string,
    extractionAccurate?: boolean
  ) => Promise<void>;
  isProcessing: boolean;
  isReviewing: boolean;
}

export const MessageDetailModal: React.FC<MessageDetailModalProps> = ({
  message,
  isOpen,
  onClose,
  onAnalyze,
  onReviewOrder,
  onUpdateStatus,
  isProcessing,
  isReviewing,
}) => {
  const { t, locale } = useI18n();
  const [reviewNotes, setReviewNotes] = useState(message?.reviewNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RecognitionStatus>(
    message?.status || 'not_analyzed'
  );
  const [extractionAccurate, setExtractionAccurate] = useState<boolean | undefined>(
    message?.extractionAccurate
  );

  React.useEffect(() => {
    if (message) {
      setReviewNotes(message.reviewNotes || '');
      setSelectedStatus(message.status);
      setExtractionAccurate(message.extractionAccurate);
    }
  }, [message]);

  if (!isOpen || !message) return null;

  const handleSaveReview = async () => {
    try {
      setIsSavingNotes(true);
      await onUpdateStatus(
        message.id,
        selectedStatus,
        reviewNotes,
        extractionAccurate
      );
    } finally {
      setIsSavingNotes(false);
    }
  };

  const parsed = message.parsedData;
  const items = parsed?.items || [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <SourceBadge source={message.source} />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {t('detail.messageHash', { id: message.id })}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('detail.from')}{' '}
                <strong className="text-slate-700 dark:text-slate-300">{message.sender}</strong>
                {message.contact && ` (${message.contact})`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Status & Analysis Action Bar */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t('detail.currentStatus')}
              </span>
              <StatusBadge status={isProcessing ? 'processing' : message.status} />
            </div>

            <button
              onClick={() => onAnalyze(message.id)}
              disabled={isProcessing}
              type="button"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs transition cursor-pointer ${
                isProcessing
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('detail.extracting')}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>
                    {message.status === 'not_analyzed'
                      ? t('detail.extract')
                      : t('detail.reextract')}
                  </span>
                </>
              )}
            </button>
          </div>

          {/* Original Message Text */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              {t('detail.original')}
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-normal">
              {message.originalText}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              {t('detail.receivedOn', {
                date: new Date(message.timestamp).toLocaleString(locale),
              })}
            </div>
          </div>

          {/* Parsed Order Details (if recognized or analyzed) */}
          {parsed && (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('detail.extractedReal')}
                  </h4>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {parsed.method === 'ai' ? t('orders.ai') : t('orders.rules')}
                  </span>
                </div>
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  {t('detail.confidence', { count: parsed.confidenceScore })}
                </span>
              </div>

              {/* Analysis Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {parsed.analysisSummary}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {t('detail.summaryOriginalNote')}
                </p>
              </div>

              {/* Items Breakdown Table */}
              {items.length > 0 ? (
                <div>
                  <h5 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {t('detail.lineItems')}
                  </h5>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2 px-3">{t('detail.itemDesc')}</th>
                          <th className="py-2 px-3 text-center">{t('detail.qty')}</th>
                          <th className="py-2 px-3 text-right">{t('detail.unitPrice')}</th>
                          <th className="py-2 px-3 text-right">{t('detail.subtotal')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 px-3 font-medium">{item.name}</td>
                            <td className="py-2 px-3 text-center font-semibold">{item.quantity}</td>
                            <td className="py-2 px-3 text-right">
                              {item.unitPrice ? `RM ${item.unitPrice.toFixed(2)}` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-medium">
                              {item.unitPrice
                                ? `RM ${(item.unitPrice * item.quantity).toFixed(2)}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {parsed.totalEstimate !== undefined && (
                        <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-semibold border-t border-slate-200 dark:border-slate-700">
                          <tr>
                            <td colSpan={3} className="py-2 px-3 text-right text-slate-900 dark:text-white">
                              {t('detail.estimatedTotal')}
                            </td>
                            <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                              RM {parsed.totalEstimate.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-2">
                  {t('detail.noItems')}
                </div>
              )}

              {/* Delivery & Time Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                {parsed.deliveryAddress && (
                  <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>{t('detail.address')}</strong> {parsed.deliveryAddress}
                    </span>
                  </div>
                )}
                {parsed.targetDateTime && (
                  <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-300">
                    <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                    <span>
                      <strong>{t('detail.time')}</strong> {parsed.targetDateTime}
                    </span>
                  </div>
                )}
              </div>

              {/* Create order / open approval */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onReviewOrder(message)}
                  disabled={isReviewing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition disabled:opacity-60"
                >
                  {isReviewing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShoppingBag className="w-3.5 h-3.5" />
                  )}
                  {message.orderId
                    ? t('detail.openOrder')
                    : t('detail.createOrder')}
                </button>
                {(parsed.missingFields?.length ?? 0) > 0 && (
                  <span className="text-[11px] text-amber-600 dark:text-amber-400">
                    {t('detail.missing')} {parsed.missingFields?.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Human Review & Status Override Section */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <FileEdit className="w-3.5 h-3.5 text-slate-500" />
              {t('detail.reviewTitle')}
            </h4>

            <div className="space-y-3">
              <div>
                {parsed && (
                  <fieldset>
                    <legend className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {t('detail.extractionAccuracy')}
                    </legend>
                    <div className="flex gap-2">
                      {[true, false].map((accurate) => (
                        <button
                          key={String(accurate)}
                          type="button"
                          onClick={() => setExtractionAccurate(accurate)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                            extractionAccurate === accurate
                              ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {accurate ? t('detail.accurate') : t('detail.inaccurate')}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('detail.adjustStatus')}
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      'recognized_as_order',
                      'needs_human_review',
                      'not_an_order',
                      'not_analyzed',
                    ] as RecognitionStatus[]
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setSelectedStatus(st)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                        selectedStatus === st
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600 font-semibold'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t(`status.${st}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                  {t('detail.staffNotes')}
                </label>
                <textarea
                  rows={2}
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={t('detail.staffNotesPlaceholder')}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100 placeholder-slate-400"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveReview}
                disabled={isSavingNotes}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold rounded-lg shadow-xs transition"
              >
                {isSavingNotes ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{t('detail.saveReview')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {t('detail.footerV2')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
