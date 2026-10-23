import React from 'react';
import {
  Boxes,
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

interface HeaderProps {
  view: AppView;
  currentUser: CurrentUser;
  onChangeUser: (user: CurrentUser) => void;
  onOpenMobileMenu: () => void;
  onOpenAddModal: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

const viewMeta: Record<
  AppView,
  {
    title: string;
    subtitle: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  desk: {
    title: 'Order Desk',
    subtitle: 'AI-read orders, checked against stock, margin and delivery',
    Icon: ClipboardList,
  },
  inbox: {
    title: 'Inbox',
    subtitle: 'WhatsApp, email and manual messages waiting for triage',
    Icon: Inbox,
  },
  orders: {
    title: 'Orders & purchases',
    subtitle: 'Approved orders, purchase drafts and exports',
    Icon: Package,
  },
  activity: {
    title: 'Activity log',
    subtitle: 'Every import, analysis, approval and stock change',
    Icon: History,
  },
  catalog: {
    title: 'Catalog & stock',
    subtitle: 'Products, available stock, safety levels and supplier lead times',
    Icon: Boxes,
  },
  settings: {
    title: 'Settings',
    subtitle: 'Industry, AI connection, decision rules and demo controls',
    Icon: Settings,
  },
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
  const meta = viewMeta[view];
  const isOwner = currentUser.role === 'owner';

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3.5 transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            type="button"
            className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <meta.Icon className="w-4 h-4 text-amber-700 dark:text-amber-400 hidden sm:block" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white truncate">
                {meta.title}
              </h1>
              <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 px-2 py-1.5"
            title={
              isOwner
                ? 'Demo Owner — can approve orders'
                : 'Demo Staff — view only'
            }
          >
            <UserRound
              className={`w-3.5 h-3.5 ${
                isOwner
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-400'
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
              aria-label="Switch user identity"
              className="bg-transparent text-[11px] font-semibold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
            >
              {USER_OPTIONS.map((option) => (
                <option key={option.role} value={option.role}>
                  {option.role === 'owner' ? 'Owner' : 'Staff'}
                </option>
              ))}
            </select>
            <span
              className={`hidden sm:inline-block w-1.5 h-1.5 rounded-full ${
                isOwner ? 'bg-amber-500' : 'bg-slate-400'
              }`}
            />
          </div>

          {view === 'inbox' && (
            <>
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                type="button"
                className="p-2 sm:px-3 sm:py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition flex items-center gap-1.5"
                title="Refresh messages from the API"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-600' : ''}`}
                />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                onClick={onOpenAddModal}
                type="button"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Message</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
