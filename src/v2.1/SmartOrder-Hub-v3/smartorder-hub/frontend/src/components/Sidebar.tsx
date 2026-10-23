import React from 'react';
import {
  Inbox,
  MessageCircle,
  Mail,
  UserPen,
  Clock,
  AlertTriangle,
  Sparkles,
  Layers,
  X,
  Code2,
} from 'lucide-react';
import { MessageSource, OrderMessage, RecognitionStatus } from '../types/message';

interface SidebarProps {
  messages: OrderMessage[];
  selectedSource: MessageSource | 'all';
  onSelectSource: (source: MessageSource | 'all') => void;
  selectedStatus: RecognitionStatus | 'all';
  onSelectStatus: (status: RecognitionStatus | 'all') => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenAddModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  messages,
  selectedSource,
  onSelectSource,
  selectedStatus,
  onSelectStatus,
  isOpenMobile,
  onCloseMobile,
  onOpenAddModal,
}) => {
  const totalCount = messages.length;
  const whatsappCount = messages.filter((m) => m.source === 'whatsapp').length;
  const emailCount = messages.filter((m) => m.source === 'email').length;
  const manualCount = messages.filter((m) => m.source === 'manual').length;
  const pendingCount = messages.filter((m) => m.status === 'not_analyzed').length;
  const reviewCount = messages.filter((m) => m.status === 'needs_human_review').length;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          {/* Logo & Brand Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                    SmartOrder Hub
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded">
                    Demo
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Smart Order Approval
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick CTA */}
          <div className="mb-6">
            <button
              onClick={() => {
                onOpenAddModal();
                if (isOpenMobile) onCloseMobile();
              }}
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs hover:shadow transition cursor-pointer"
            >
              <span>+ Log Inbound Message</span>
            </button>
          </div>

          {/* Main Navigation Views */}
          <div className="space-y-6">
            <div>
              <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Main Views
              </div>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSource('all');
                    onSelectStatus('all');
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedSource === 'all' && selectedStatus === 'all'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Inbox className="w-4 h-4 text-slate-500" />
                    <span>Order Inbox</span>
                  </div>
                  <span className="text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
                    {totalCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectStatus('not_analyzed');
                    onSelectSource('all');
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedStatus === 'not_analyzed'
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <span>Pending Analysis</span>
                  </div>
                  {pendingCount > 0 && (
                    <span className="text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectStatus('needs_human_review');
                    onSelectSource('all');
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedStatus === 'needs_human_review'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span>Needs Human Review</span>
                  </div>
                  {reviewCount > 0 && (
                    <span className="text-[11px] font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      {reviewCount}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Channels / Sources */}
            <div>
              <div className="px-2 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Inbound Channels
              </div>
              <nav className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    onSelectSource('whatsapp');
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedSource === 'whatsapp'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    <span>WhatsApp</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{whatsappCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSource('email');
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedSource === 'email'
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-sky-600" />
                    <span>Email</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{emailCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSelectSource('manual');
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    selectedSource === 'manual'
                      ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <UserPen className="w-4 h-4 text-amber-600" />
                    <span>Manual Entry</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{manualCount}</span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: University Hackathon Note */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white mb-1">
              <Code2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Hackathon Prototype</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Frontend mock demonstration. Clean service layer isolated for future backend & AI APIs.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
