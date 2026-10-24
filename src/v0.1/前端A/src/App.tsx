import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Inbox,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  FileQuestion,
  FilterX,
} from 'lucide-react';
import { MessageSource, NewMessageInput, OrderMessage, RecognitionStatus } from './types/message';
import * as messagesApi from './services/messagesApi';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HackathonDemoBanner } from './components/HackathonDemoBanner';
import { StatsOverview } from './components/StatsOverview';
import { FilterBar } from './components/FilterBar';
import { MessageCard } from './components/MessageCard';
import { MessageDetailModal } from './components/MessageDetailModal';
import { AddMessageModal } from './components/AddMessageModal';

export default function App() {
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<MessageSource | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<RecognitionStatus | 'all'>('all');

  // Currently processing message IDs for "Analyze as Order"
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  // Modals & Navigation
  const [selectedMessage, setSelectedMessage] = useState<OrderMessage | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Notification Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(
    null
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'info' | 'error' = 'info') => {
      setToast({ message, type });
      setTimeout(() => {
        setToast((current) => (current?.message === message ? null : current));
      }, 4000);
    },
    []
  );

  // Initial load
  const loadMessages = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      else setIsRefreshing(true);
      setErrorMessage(null);

      const data = await messagesApi.fetchMessages();
      setMessages(data);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to retrieve messages from order inbox.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Handle "Analyze as Order" simulation
  const handleAnalyzeMessage = async (id: string) => {
    // Add to processing set
    setProcessingIds((prev) => new Set(prev).add(id));

    try {
      const updated = await messagesApi.analyzeMessageAsOrder(id);

      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? updated : msg))
      );

      // Also update selected message in detail modal if open
      setSelectedMessage((current) => (current?.id === id ? updated : current));

      const statusLabels: Record<RecognitionStatus, string> = {
        not_analyzed: 'Not Analyzed',
        processing: 'Processing',
        recognized_as_order: 'Recognized as Order',
        not_an_order: 'Not an Order',
        needs_human_review: 'Needs Human Review',
      };

      showToast(
        `Mock analysis complete: Message categorized as "${statusLabels[updated.status]}".`,
        updated.status === 'recognized_as_order' ? 'success' : 'info'
      );
    } catch (err: unknown) {
      const errorText = err instanceof Error ? err.message : 'Error analyzing message';
      showToast(errorText, 'error');
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // Add new single message
  const handleAddMessage = async (input: NewMessageInput) => {
    const created = await messagesApi.createMessage(input);
    setMessages((prev) => [created, ...prev]);
    showToast(`Inbound message from "${created.sender}" added to inbox.`, 'success');
  };

  // Batch import messages (CSV or multi)
  const handleBatchImport = async (inputs: NewMessageInput[]) => {
    const createdList = await messagesApi.importMessagesBatch(inputs);
    setMessages((prev) => [...createdList, ...prev]);
    showToast(`Successfully imported ${createdList.length} messages from file.`, 'success');
  };

  // Manual status override
  const handleUpdateStatus = async (
    id: string,
    newStatus: RecognitionStatus,
    notes?: string
  ) => {
    const updated = await messagesApi.updateMessageStatus(id, newStatus, notes);
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? updated : msg))
    );
    setSelectedMessage((current) => (current?.id === id ? updated : current));
    showToast(`Status updated to "${newStatus.replace(/_/g, ' ')}".`, 'info');
  };

  // Delete message
  const handleDeleteMessage = async (id: string) => {
    if (confirm('Are you sure you want to delete this message?')) {
      await messagesApi.deleteMessage(id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedMessage?.id === id) {
        setSelectedMessage(null);
      }
      showToast('Message deleted.', 'info');
    }
  };

  // Reset to initial mock dataset
  const handleResetData = async () => {
    try {
      setIsResetting(true);
      const defaults = await messagesApi.resetMockData();
      setMessages(defaults);
      setSearchQuery('');
      setSourceFilter('all');
      setStatusFilter('all');
      showToast('Inbox reset to default hackathon mock dataset.', 'info');
    } finally {
      setIsResetting(false);
    }
  };

  // Filter messages based on search, source, and status
  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Source filter
      if (sourceFilter !== 'all' && msg.source !== sourceFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && msg.status !== statusFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesSender = msg.sender.toLowerCase().includes(query);
        const matchesText = msg.originalText.toLowerCase().includes(query);
        const matchesContact = msg.contact?.toLowerCase().includes(query) || false;
        const matchesId = msg.id.toLowerCase().includes(query);
        const matchesItems =
          msg.parsedData?.items.some((i) => i.name.toLowerCase().includes(query)) || false;

        return matchesSender || matchesText || matchesContact || matchesId || matchesItems;
      }

      return true;
    });
  }, [messages, sourceFilter, statusFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Toast Notification Banner */}
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

      {/* Main App Layout */}
      <div className="flex-1 flex flex-row w-full">
        {/* Sidebar */}
        <Sidebar
          messages={messages}
          selectedSource={sourceFilter}
          onSelectSource={setSourceFilter}
          selectedStatus={statusFilter}
          onSelectStatus={setStatusFilter}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onOpenAddModal={() => setIsAddModalOpen(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <Header
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
            onOpenAddModal={() => setIsAddModalOpen(true)}
            onRefresh={() => loadMessages(true)}
            isRefreshing={isRefreshing}
          />

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {/* Hackathon Demo Notice */}
            <HackathonDemoBanner
              onResetData={handleResetData}
              isResetting={isResetting}
            />

            {/* Error Message if fetch failed */}
            {errorMessage && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-sm flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold">Inbox Error</h4>
                    <p className="text-xs mt-0.5">{errorMessage}</p>
                  </div>
                </div>
                <button
                  onClick={() => loadMessages()}
                  className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Stats Overview Cards */}
            <StatsOverview
              messages={messages}
              currentStatusFilter={statusFilter}
              onSelectStatusFilter={setStatusFilter}
            />

            {/* Filter Bar (Search, Sources, Statuses) */}
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

            {/* Message List */}
            {isLoading ? (
              // Loading Skeleton State
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
              // Render Message Cards
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
                  />
                ))}
              </div>
            ) : (
              // Empty State
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                  <FilterX className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  No order messages found
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                  {searchQuery || sourceFilter !== 'all' || statusFilter !== 'all'
                    ? 'No messages matched your current search filters. Try clearing or relaxing your filters.'
                    : 'Your order inbox is currently empty. Use the "Add Message" button to log orders or import files.'}
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
                      Clear All Filters
                    </button>
                  ) : (
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
                    >
                      + Add Message
                    </button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Add Message Modal (with TXT and CSV upload) */}
      <AddMessageModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddMessage}
        onBatchImport={handleBatchImport}
      />

      {/* Message Detail Modal */}
      <MessageDetailModal
        message={selectedMessage}
        isOpen={selectedMessage !== null}
        onClose={() => setSelectedMessage(null)}
        onAnalyze={handleAnalyzeMessage}
        onUpdateStatus={handleUpdateStatus}
        isProcessing={selectedMessage ? processingIds.has(selectedMessage.id) : false}
      />
    </div>
  );
}
