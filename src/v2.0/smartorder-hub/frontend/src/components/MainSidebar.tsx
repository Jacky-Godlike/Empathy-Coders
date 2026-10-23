import React from 'react';
import {
  Boxes,
  CheckCircle2,
  ClipboardList,
  History,
  Inbox,
  Layers,
  Package,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { AppView, Workspace } from '../types/order';

interface MainSidebarProps {
  workspace: Workspace | null;
  view: AppView;
  onNavigate: (view: AppView) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  id: AppView;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  count?: number;
}

export const MainSidebar: React.FC<MainSidebarProps> = ({
  workspace,
  view,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const stats = workspace?.stats;
  const navItems: NavItem[] = [
    {
      id: 'desk',
      label: 'Order Desk',
      Icon: ClipboardList,
      count: stats?.awaitingConfirmation,
    },
    {
      id: 'inbox',
      label: 'Inbox',
      Icon: Inbox,
      count: stats?.unprocessed,
    },
    {
      id: 'orders',
      label: 'Orders & purchases',
      Icon: Package,
      count: stats?.approved,
    },
    { id: 'activity', label: 'Activity log', Icon: History },
    { id: 'catalog', label: 'Catalog & stock', Icon: Boxes },
    { id: 'settings', label: 'Settings', Icon: Settings },
  ];

  const ai = workspace?.ai;

  const handleNavigate = (next: AppView) => {
    onNavigate(next);
    onCloseMobile();
  };

  return (
    <>
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-40 h-screen w-64 shrink-0 bg-slate-950 text-slate-300 border-r border-slate-800 flex flex-col justify-between transition-transform duration-300 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto">
          {/* Brand */}
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-800 flex items-center justify-center text-white shadow-lg shadow-amber-950/40">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-[15px] tracking-tight text-white whitespace-nowrap">
                    SmartOrder Hub
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    MVP
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">Smart order desk</p>
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current business / industry */}
          <div className="mb-5 rounded-xl border border-slate-800 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              Workspace
            </p>
            <p className="text-xs font-semibold text-white mt-0.5 truncate">
              {workspace?.businessName || 'Loading…'}
            </p>
            <span className="inline-block mt-1.5 text-[10px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              {workspace?.industry.name || '—'}
            </span>
          </div>

          {/* Navigation */}
          <nav className="space-y-1" aria-label="Main navigation">
            {navItems.map((item) => {
              const active = view === item.id;
              const showCount =
                Number.isFinite(Number(item.count)) && Number(item.count) > 0;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition ${
                    active
                      ? 'bg-amber-400/15 text-amber-100 ring-1 ring-amber-400/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
                  }`}
                >
                  <item.Icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {showCount && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        active
                          ? 'bg-amber-400/20 text-amber-100'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* AI status card */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={() => handleNavigate('settings')}
            className="w-full text-left rounded-xl border border-slate-800 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition"
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  ai?.configured ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              />
              <span className="text-[11px] font-semibold text-white">
                {ai?.configured ? 'AI extraction on' : 'Rules fallback'}
              </span>
              {ai?.configured ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-amber-400 ml-auto" />
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {ai?.configured
                ? `${ai.providerLabel || ai.provider} · ${ai.model}`
                : 'Connect an AI API in Settings'}
            </p>
            <p className="text-[10px] text-slate-500">
              Intake: {ai?.intakeMode || 'rules'}
            </p>
          </button>
          <p className="text-[9px] text-slate-600 mt-2 text-center">
            Synthetic data only · SDC Hackathon 2026
          </p>
        </div>
      </aside>
    </>
  );
};
