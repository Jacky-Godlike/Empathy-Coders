import React from 'react';
import {
  Boxes,
  Cable,
  CheckCircle2,
  ClipboardList,
  History,
  Inbox,
  Layers,
  Package,
  Settings,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { AppView, Workspace } from '../types/order';
import { CurrentUser, USER_OPTIONS } from '../types/user';
import { useI18n } from '../i18n/I18nContext';

interface MainSidebarProps {
  workspace: Workspace | null;
  view: AppView;
  currentUser: CurrentUser;
  onChangeUser: (user: CurrentUser) => void;
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
  currentUser,
  onChangeUser,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
}) => {
  const { t } = useI18n();
  const stats = workspace?.stats;
  const navItems: NavItem[] = [
    {
      id: 'desk',
      label: t('nav.desk'),
      Icon: ClipboardList,
      count: stats?.awaitingConfirmation,
    },
    {
      id: 'inbox',
      label: t('nav.inbox'),
      Icon: Inbox,
      count: stats?.unprocessed,
    },
    {
      id: 'channels',
      label: t('nav.channels'),
      Icon: Cable,
    },
    {
      id: 'orders',
      label: t('nav.orders'),
      Icon: Package,
      count: stats?.approved,
    },
    { id: 'activity', label: t('nav.activity'), Icon: History },
    { id: 'catalog', label: t('nav.catalog'), Icon: Boxes },
    { id: 'settings', label: t('nav.settings'), Icon: Settings },
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
                    {t('brand.name')}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-400/10 text-amber-300 border border-amber-400/20 px-1.5 py-0.5 rounded">
                    {t('brand.mvp')}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400">{t('brand.tagline')}</p>
              </div>
            </div>
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white"
              aria-label={t('nav.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Current business / industry */}
          <div className="mb-5 rounded-xl border border-slate-800 bg-white/[0.03] p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {t('nav.workspace')}
            </p>
            <p className="text-xs font-semibold text-white mt-0.5 truncate">
              {workspace?.businessName || t('nav.loading')}
            </p>
            <span className="inline-block mt-1.5 text-[10px] font-medium text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
              {workspace?.industry.name || '—'}
            </span>
          </div>

          {/* Navigation */}
          <nav className="space-y-1" aria-label={t('nav.main')}>
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
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-800 bg-white/[0.03] px-2.5 py-2 md:hidden">
            <UserRound className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] uppercase tracking-wider text-slate-500">
                {t('header.switchUser')}
              </p>
              <select
                value={currentUser.role}
                onChange={(event) => {
                  const next = USER_OPTIONS.find(
                    (option) => option.role === event.target.value
                  );
                  if (next) onChangeUser(next);
                }}
                aria-label={t('header.switchUser')}
                className="mt-0.5 w-full bg-transparent text-[11px] font-semibold text-white outline-none"
              >
                {USER_OPTIONS.map((option) => (
                  <option key={option.role} value={option.role} className="text-slate-900">
                    {option.role === 'owner' ? t('header.owner') : t('header.staff')}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
                {ai?.configured ? t('sidebar.aiOn') : t('sidebar.rulesFallback')}
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
                : t('sidebar.connectAi')}
            </p>
            <p className="text-[10px] text-slate-500">
              {t('sidebar.intake', { mode: ai?.intakeMode || 'rules' })}
            </p>
          </button>
          <p className="text-[9px] text-slate-600 mt-2 text-center">
            {t('sidebar.synthetic')}
          </p>
        </div>
      </aside>
    </>
  );
};
