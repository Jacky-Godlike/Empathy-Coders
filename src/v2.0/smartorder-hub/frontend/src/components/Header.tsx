import React from 'react';
import {
  Boxes,
  Cable,
  ClipboardList,
  History,
  Inbox,
  Menu,
  Package,
  Plus,
  RefreshCw,
  Settings,
  UserRound,
} from 'lucide-react';
import { AppView } from '../types/order';
import { CurrentUser, USER_OPTIONS } from '../types/user';
import { useI18n } from '../i18n/I18nContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface HeaderProps {
  view: AppView;
  currentUser: CurrentUser;
  onChangeUser: (user: CurrentUser) => void;
  onOpenMobileMenu: () => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const viewIcons: Record<AppView, React.ComponentType<{ className?: string }>> = {
  desk: ClipboardList,
  inbox: Inbox,
  channels: Cable,
  orders: Package,
  activity: History,
  catalog: Boxes,
  settings: Settings,
};

export const Header: React.FC<HeaderProps> = ({
  view,
  currentUser,
  onChangeUser,
  onOpenMobileMenu,
  onOpenAddModal,
  onRefresh,
  isRefreshing,
}) => {
  const { t } = useI18n();
  const meta = {
    title: t(`view.${view}.title`),
    subtitle: t(`view.${view}.subtitle`),
  };
  const ViewIcon = viewIcons[view];
  const isOwner = currentUser.role === 'owner';

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-3.5 transition-all">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition shrink-0"
            aria-label={t('header.openNav')}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ViewIcon className="w-4 h-4 text-amber-700 dark:text-amber-400 hidden sm:block shrink-0" />
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {meta.title}
              </h1>
              <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div
            className="hidden md:flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-1.5 sm:px-2 py-1.5"
            title={isOwner ? t('header.ownerHint') : t('header.staffHint')}
          >
            <UserRound
              className={`w-3.5 h-3.5 ${
                isOwner ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'
              }`}
            />
            <select
              value={currentUser.role}
              onChange={(event) => {
                const next = USER_OPTIONS.find(
                  (option) => option.role === event.target.value
                );
                if (next) onChangeUser(next);
              }}
              aria-label={t('header.switchUser')}
              className="bg-transparent text-[10px] sm:text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              {USER_OPTIONS.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.role === 'owner' ? t('header.owner') : t('header.staff')}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:block">
            <LanguageSwitcher />
          </div>
          <div className="sm:hidden">
            <LanguageSwitcher compact />
          </div>

          {view === 'inbox' && (
            <>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                type="button"
                className="hidden sm:flex p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition items-center gap-1.5"
                title={t('header.refreshTitle')}
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`}
                />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </button>

              <button
                onClick={onOpenAddModal}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('message.add')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
