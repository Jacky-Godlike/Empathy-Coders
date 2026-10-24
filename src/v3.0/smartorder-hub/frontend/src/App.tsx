import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FilterX,
  Inbox,
  Layers,
  Loader2,
  X,
} from 'lucide-react';
import {
  MessageSource,
  NewMessageInput,
  OrderMessage,
  RecognitionStatus,
} from './types/message';
import { AppView, Order, Workspace } from './types/order';
import { CurrentUser, loadStoredUser } from './types/user';
import * as messagesApi from './services/messagesApi';
import * as ordersApi from './services/ordersApi';
import { fetchWorkspace, ownerLogin } from './services/workspaceApi';
import { MainSidebar } from './components/MainSidebar';
import { Header } from './components/Header';
import { HackathonDemoBanner } from './components/HackathonDemoBanner';
import { StatsOverview } from './components/StatsOverview';
import { FilterBar } from './components/FilterBar';
import { MessageCard } from './components/MessageCard';
import { MessageDetailModal } from './components/MessageDetailModal';
import { AddMessageModal } from './components/AddMessageModal';
import { OrderReviewModal } from './components/OrderReviewModal';
import { OrdersView } from './components/OrdersView';
import { ActivityView } from './components/ActivityView';
import { CatalogView } from './components/CatalogView';
import { SettingsView } from './components/SettingsView';
import { ChannelHubView } from './components/ChannelHubView';
import { useI18n } from './i18n/I18nContext';

export default function App() {
  const { t, language } = useI18n();
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Workspace = current industry profile + AI status + rule thresholds + counts.
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<MessageSource | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RecognitionStatus | 'all'>('all');

  // Currently processing message IDs for extraction
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // Navigation & modals
  const [view, setView] = useState<AppView>('desk');
  const [currentUser, setCurrentUser] = useState<CurrentUser>(loadStoredUser);
  const [selectedMessage, setSelectedMessage] = useState<OrderMessage | null>(null);
  const [reviewOrder, setReviewOrder] = useState<Order | null>(null);
  const [ordersVersion, setOrdersVersion] = useState(0);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Notification toast
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      setToast({ message, type });
      window.setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, 4000);
    },
    []
  );

  useEffect(() => {
    document.title = t('meta.title');
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language === 'ms' ? 'ms' : 'en';
  }, [language, t]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        'smartorderhub.currentUser',
        JSON.stringify(currentUser)
      );
    } catch {
      // Persistence is a convenience; the switcher still works without it.
    }
  }, [currentUser]);

  const handleChangeUser = useCallback(
    async (user: CurrentUser) => {
      if (user.role === 'owner' && workspace?.ownerPasswordRequired) {
        const password = window.prompt(t('header.ownerPasswordPrompt'));
        if (!password) return;
        try {
          await ownerLogin(password);
          sessionStorage.setItem(
            'smartorderhub.ownerPassword',
            password
          );
        } catch {
          showToast(t('header.ownerPasswordInvalid'), 'error');
          return;
        }
      } else {
        try {
          sessionStorage.removeItem('smartorderhub.ownerPassword');
        } catch {
          // sessionStorage may be unavailable in embedded/private contexts.
        }
      }

      setCurrentUser(user);
      try {
        window.localStorage.setItem(
          'smartorderhub.currentUser',
          JSON.stringify(user)
        );
      } catch {
        // Persistence is a convenience; the switcher still works without it.
      }
      showToast(
        user.role === 'owner'
          ? t('header.signedInOwner', { name: user.name })
          : t('header.signedInStaff', { name: user.name }),
        user.role === 'owner' ? 'success' : 'info'
      );
    },
    [showToast, t, workspace?.ownerPasswordRequired]
  );

  useEffect(() => {
    if (!workspace?.ownerPasswordRequired || currentUser.role !== 'owner') {
      return;
    }
    let password: string | null = null;
    try {
      password = sessionStorage.getItem('smartorderhub.ownerPassword');
    } catch {
      // sessionStorage may be unavailable in embedded/private contexts.
    }
    if (!password) {
      setCurrentUser({ role: 'staff', name: 'Demo Staff' });
      showToast(t('header.ownerPasswordPrompt'), 'info');
    }
  }, [currentUser.role, showToast, t, workspace?.ownerPasswordRequired]);

  const loadMessages = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage(null);

      const data = await messagesApi.fetchMessages();
      setMessages(data);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : t('app.error.load')
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setIsWorkspaceLoading(true);
    setWorkspaceError(null);
    try {
      const data = await fetchWorkspace();
      setWorkspace(data);
    } catch (err: unknown) {
      setWorkspaceError(
        err instanceof Error ? err.message : t('app.workspaceLoadError')
      );
    } finally {
      setIsWorkspaceLoading(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async () => {
    try {
      const data = await fetchWorkspace();
      setWorkspace(data);
      setWorkspaceError(null);
    } catch {
      // Sidebar counters are non-critical; the page-level calls surface errors.
    }
  }, []);

  useEffect(() => {
    loadMessages();
    loadWorkspace();
  }, [loadMessages, loadWorkspace]);

  // Keep sidebar counters current, and refresh the raw inbox when it opens.
  useEffect(() => {
    if (view === 'inbox') {
      loadMessages(true);
    }
    refreshWorkspace();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [view, loadMessages, refreshWorkspace]);

  const handleAnalyzeMessage = async (id: string) => {
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const updated = await messagesApi.analyzeMessageAsOrder(id);
      setMessages((prev) => prev.map((msg) => (msg.id === id ? updated : msg)));
      setSelectedMessage((current) => (current?.id === id ? updated : current));

      showToast(
        t('app.extractionComplete', {
          status: t(`status.${updated.status}`),
          method: updated.parsedData?.method === 'ai' ? t('orders.ai') : t('orders.rules'),
        }),
        updated.status === 'recognized_as_order' ? 'success' : 'info'
      );
      refreshWorkspace();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('app.error.analyze'), 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleAddMessage = async (input: NewMessageInput) => {
    const created = await messagesApi.createMessage(input);
    setMessages((prev) => [created, ...prev]);
    showToast(t('app.toast.added', { sender: created.sender }), 'success');
    refreshWorkspace();
  };

  const handleBatchImport = async (inputs: NewMessageInput[]) => {
    const createdList = await messagesApi.importMessagesBatch(inputs);
    setMessages((prev) => [...createdList, ...prev]);
    showToast(t('app.toast.imported', { count: createdList.length }), 'success');
    refreshWorkspace();
  };

  const handleUpdateStatus = async (
    id: string,
    newStatus: RecognitionStatus,
    notes?: string
  ) => {
    try {
      const updated = await messagesApi.updateMessageStatus(id, newStatus, notes);
      setMessages((prev) => prev.map((msg) => (msg.id === id ? updated : msg)));
      setSelectedMessage((current) => (current?.id === id ? updated : current));
      showToast(
        t('app.toast.status', { status: t(`status.${newStatus}`) }),
        'info'
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : t('app.statusFailed'),
        'error'
      );
    }
  };

  const handleDeleteMessage = async (id: string) => {
    if (currentUser.role !== 'owner') {
      showToast(t('settings.ownerOnly'), 'error');
      return;
    }
    if (window.confirm(t('app.deleteConfirm'))) {
      try {
        await messagesApi.deleteMessage(id);
        setMessages((prev) => prev.filter((message) => message.id !== id));
        if (selectedMessage?.id === id) setSelectedMessage(null);
        showToast(t('app.toast.deleted'), 'info');
        refreshWorkspace();
      } catch (err: unknown) {
        showToast(err instanceof Error ? err.message : t('app.deleteFailed'), 'error');
      }
    }
  };

  const handleResetData = async () => {
    if (currentUser.role !== 'owner') {
      showToast(t('settings.ownerOnly'), 'error');
      return;
    }
    try {
      setIsResetting(true);
      const defaults = await messagesApi.resetMockData();
      setMessages(defaults);
      setSearchQuery('');
      setSourceFilter('all');
      setStatusFilter('all');
      setSelectedMessage(null);
      setReviewOrder(null);
      setView('desk');
      setOrdersVersion((value) => value + 1);
      await refreshWorkspace();
      showToast(t('app.toast.reset'), 'info');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('app.resetFailed'), 'error');
      throw err;
    } finally {
      setIsResetting(false);
    }
  };

  const handleWorkspaceChanged = useCallback(
    (next: Workspace) => {
      setWorkspace(next);
      setOrdersVersion((value) => value + 1);
      setSelectedMessage(null);
      setReviewOrder(null);
    },
    []
  );

  const handleReviewOrder = async (message: OrderMessage) => {
    setReviewingId(message.id);
    try {
      let order = message.orderId
        ? await ordersApi.fetchOrder(message.orderId)
        : await ordersApi.createOrderFromMessage(message.id);

      if (!order.analysis) {
        order = await ordersApi.analyzeOrder(order.id);
      }

      setMessages((prev) =>
        prev.map((item) =>
          item.id === message.id
            ? {
                ...item,
                orderId: order.id,
                status: 'recognized_as_order' as RecognitionStatus,
              }
            : item
        )
      );
      setSelectedMessage(null);
      setReviewOrder(order);
      setOrdersVersion((value) => value + 1);
      refreshWorkspace();
      showToast(t('app.orderReady', { id: order.id }), 'success');
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : t('app.createOrderError'),
        'error'
      );
    } finally {
      setReviewingId(null);
    }
  };

  const handleOpenOrder = async (order: Order) => {
    try {
      const full = order.analysis ? order : await ordersApi.analyzeOrder(order.id);
      setReviewOrder(full);
      setOrdersVersion((value) => value + 1);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : t('app.openOrderError'), 'error');
    }
  };

  const handleChannelMessages = useCallback(
    (incoming: OrderMessage[]) => {
      if (incoming.length === 0) return;
      setMessages((previous) => {
        const incomingIds = new Set(incoming.map((message) => message.id));
        return [...incoming, ...previous.filter((message) => !incomingIds.has(message.id))];
      });
      refreshWorkspace();
    },
    [refreshWorkspace]
  );

  const handleOrderUpdated = (updated: Order) => {
    setReviewOrder(updated);
    setOrdersVersion((value) => value + 1);
    refreshWorkspace();
  };

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      if (sourceFilter !== 'all' && msg.source !== sourceFilter) return false;
      if (statusFilter !== 'all' && msg.status !== statusFilter) return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesSender = msg.sender.toLowerCase().includes(query);
        const matchesText = msg.originalText.toLowerCase().includes(query);
        const matchesContact = msg.contact?.toLowerCase().includes(query) || false;
        const matchesId = msg.id.toLowerCase().includes(query);
        const matchesItems =
          msg.parsedData?.items.some((item) =>
            item.name.toLowerCase().includes(query)
          ) || false;

        return (
          matchesSender || matchesText || matchesContact || matchesId || matchesItems
        );
      }

      return true;
    });
  }, [messages, sourceFilter, statusFilter, searchQuery]);

  // Workspace is the shell's source of truth; wait for it before rendering
  // pages that depend on the industry profile.
  if (!workspace) {
    return (
      <div className="min-h-screen text-slate-800 flex items-center justify-center p-6">
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-700 flex items-center justify-center text-white mx-auto shadow-lg shadow-emerald-900/30">
            <Layers className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">{t('app.loadingTitle')}</h1>
          {workspaceError ? (
            <>
              <p className="text-xs text-rose-700 flex items-center justify-center gap-1.5">
                <AlertCircle className="w-4 h-4" />
                {workspaceError}
              </p>
              <button
                onClick={loadWorkspace}
                disabled={isWorkspaceLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-60"
              >
                {isWorkspaceLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : null}
                {t('app.retryConnection')}
              </button>
            </>
          ) : (
            <p className="text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('app.loadingWorkspace')}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 font-sans">
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-top-4 duration-300">
          <div
            className={`p-3.5 rounded-xl shadow-lg border flex items-center justify-between gap-3 text-xs font-medium ${
              toast.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              ) : (
                <Inbox className="w-4 h-4 text-blue-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded hover:opacity-75 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-h-screen w-full">
        <MainSidebar
          workspace={workspace}
          view={view}
          currentUser={currentUser}
          onChangeUser={handleChangeUser}
          onNavigate={setView}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            view={view}
            currentUser={currentUser}
            onChangeUser={handleChangeUser}
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onRefresh={() => loadMessages(true)}
            isRefreshing={isRefreshing}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full max-w-[1500px] mx-auto">
            {view === 'inbox' && (
              <>
                <HackathonDemoBanner
                  onResetData={handleResetData}
                  onOpenChannels={() => setView('channels')}
                  isResetting={isResetting}
                />

                {errorMessage && (
                  <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold">{t('app.inboxError')}</h4>
                        <p className="text-xs mt-0.5">{errorMessage}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => loadMessages()}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
                    >
                      {t('common.retry')}
                    </button>
                  </div>
                )}

                <StatsOverview
                  messages={messages}
                  currentStatusFilter={statusFilter}
                  onSelectStatusFilter={setStatusFilter}
                />

                <FilterBar
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sourceFilter={sourceFilter}
                  onSourceChange={setSourceFilter}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                  onResetFilters={() => {
                    setSearchQuery('');
                    setSourceFilter('all');
                    setStatusFilter('all');
                  }}
                  totalFiltered={filteredMessages.length}
                  totalCount={messages.length}
                />

                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 animate-pulse space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                            <div className="w-32 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                          </div>
                          <div className="w-14 h-4 bg-slate-100 dark:bg-slate-800 rounded" />
                        </div>
                        <div className="h-14 bg-slate-100 dark:bg-slate-800/60 rounded" />
                        <div className="flex items-center justify-between pt-2">
                          <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded-full" />
                          <div className="w-28 h-7 bg-slate-200 dark:bg-slate-800 rounded-lg" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredMessages.length > 0 ? (
                  <div className="space-y-3.5">
                    {filteredMessages.map((msg) => (
                      <MessageCard
                        key={msg.id}
                        message={msg}
                        isProcessing={processingIds.has(msg.id)}
                        onAnalyze={handleAnalyzeMessage}
                        onViewDetails={setSelectedMessage}
                        onUpdateStatus={handleUpdateStatus}
                        onDelete={handleDeleteMessage}
                        canDelete={currentUser.role === 'owner'}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                      <FilterX className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                      {t('app.empty.title')}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                      {searchQuery || sourceFilter !== 'all' || statusFilter !== 'all'
                        ? t('app.empty.filtered')
                        : t('app.empty.default')}
                    </p>
                    <div className="pt-2 flex justify-center gap-3">
                      {searchQuery || sourceFilter !== 'all' || statusFilter !== 'all' ? (
                        <button
                          onClick={() => {
                            setSearchQuery('');
                            setSourceFilter('all');
                            setStatusFilter('all');
                          }}
                          className="px-4 py-2 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/60 rounded-lg hover:bg-blue-100 transition"
                        >
                          {t('filter.clearAll')}
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsAddModalOpen(true)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                        >
                          + {t('message.add')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {view === 'channels' && (
              <ChannelHubView
                currentUser={currentUser}
                onMessagesIngested={handleChannelMessages}
                onOpenInbox={() => {
                  setSourceFilter('all');
                  setStatusFilter('all');
                  setView('inbox');
                }}
                onNotify={showToast}
              />
            )}

            {view === 'desk' && (
              <OrdersView
                mode="desk"
                industry={workspace.industry}
                currentUser={currentUser}
                onOpenOrder={handleOpenOrder}
                refreshKey={ordersVersion}
                onDataChanged={refreshWorkspace}
              />
            )}

            {view === 'orders' && (
              <OrdersView
                mode="records"
                industry={workspace.industry}
                currentUser={currentUser}
                onOpenOrder={handleOpenOrder}
                refreshKey={ordersVersion}
                onDataChanged={refreshWorkspace}
              />
            )}

            {view === 'activity' && <ActivityView />}

            {view === 'catalog' && (
              <CatalogView industry={workspace.industry} />
            )}

            {view === 'settings' && (
              <SettingsView
                workspace={workspace}
                onWorkspaceChanged={handleWorkspaceChanged}
                onReset={handleResetData}
                onNavigate={setView}
                canManage={currentUser.role === 'owner'}
              />
            )}
          </main>
        </div>
      </div>

      <AddMessageModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddMessage}
        onBatchImport={handleBatchImport}
      />

      <MessageDetailModal
        message={selectedMessage}
        isOpen={selectedMessage !== null}
        onClose={() => setSelectedMessage(null)}
        onAnalyze={handleAnalyzeMessage}
        onReviewOrder={handleReviewOrder}
        onUpdateStatus={handleUpdateStatus}
        isProcessing={selectedMessage ? processingIds.has(selectedMessage.id) : false}
        isReviewing={selectedMessage ? reviewingId === selectedMessage.id : false}
      />

      <OrderReviewModal
        order={reviewOrder}
        industry={workspace.industry}
        currentUser={currentUser}
        isOpen={reviewOrder !== null}
        onClose={() => setReviewOrder(null)}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
}
