import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import {
  X,
  Upload,
  FileText,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Sparkles,
  FileCheck2,
  Trash2,
  Eye,
  Info,
} from 'lucide-react';
import { MessageSource, NewMessageInput } from '../types/message';

interface AddMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: NewMessageInput) => Promise<void>;
  onBatchImport: (inputs: NewMessageInput[]) => Promise<void>;
}

export const AddMessageModal: React.FC<AddMessageModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onBatchImport,
}) => {
  // Form fields
  const [source, setSource] = useState<MessageSource>('whatsapp');
  const [sender, setSender] = useState('');
  const [contact, setContact] = useState('');
  const [originalText, setOriginalText] = useState('');

  // Field validation error states
  const [fieldErrors, setFieldErrors] = useState<{
    sender?: string;
    originalText?: string;
  }>({});
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  // File import state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedFileSize, setUploadedFileSize] = useState<number | null>(null);
  const [uploadedFileType, setUploadedFileType] = useState<'txt' | 'csv' | null>(null);

  // Parsed CSV rows (if multiple messages are imported)
  const [csvParsedRows, setCsvParsedRows] = useState<NewMessageInput[]>([]);
  const [csvPreviewTab, setCsvPreviewTab] = useState<'table' | 'raw'>('table');
  const [rawCsvText, setRawCsvText] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isParsingFile, setIsParsingFile] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Clear modal state and close
  const handleClose = () => {
    setSender('');
    setContact('');
    setOriginalText('');
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setUploadedFileType(null);
    setCsvParsedRows([]);
    setRawCsvText('');
    setFieldErrors({});
    setFormErrorMessage(null);
    setIsSubmitting(false);
    setIsParsingFile(false);
    onClose();
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const errors: { sender?: string; originalText?: string } = {};

    if (csvParsedRows.length > 0) {
      // In batch CSV mode, validate that all parsed rows have content
      const invalidRows = csvParsedRows.filter(
        (row) => !row.sender.trim() || !row.originalText.trim()
      );
      if (invalidRows.length > 0) {
        setFormErrorMessage(
          `Some CSV rows are missing required sender or message text. Please check the imported list.`
        );
        return false;
      }
      return true;
    }

    // Single message validation
    if (!sender.trim()) {
      errors.sender = 'Sender name is required.';
    }

    if (!originalText.trim()) {
      errors.originalText = 'Original message text is required.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setFormErrorMessage('Please fill in all required fields marked in red.');
      return false;
    }

    setFormErrorMessage(null);
    return true;
  };

  // Form submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      setFormErrorMessage(null);

      if (csvParsedRows.length > 0) {
        // Batch import from CSV
        await onBatchImport(csvParsedRows);
      } else {
        // Single message submission
        await onSubmit({
          source,
          sender: sender.trim(),
          contact: contact.trim() || undefined,
          originalText: originalText.trim(),
        });
      }

      handleClose();
    } catch (err: unknown) {
      setFormErrorMessage(
        err instanceof Error ? err.message : 'An unexpected error occurred while saving.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    processFile(file);
    // Reset file input value so user can re-upload the same file if desired
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process selected TXT or CSV file
  const processFile = (file: File) => {
    setFormErrorMessage(null);
    setFieldErrors({});

    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension !== 'txt' && extension !== 'csv') {
      setFormErrorMessage(
        `Invalid file type ".${extension || 'unknown'}". Please select a .txt or .csv file.`
      );
      return;
    }

    setIsParsingFile(true);
    setUploadedFileName(file.name);
    setUploadedFileSize(file.size);
    setUploadedFileType(extension);

    if (extension === 'txt') {
      // Read TXT in browser using FileReader
      const reader = new FileReader();

      reader.onload = (event) => {
        setIsParsingFile(false);
        const textContent = (event.target?.result as string) || '';

        if (!textContent.trim()) {
          setFormErrorMessage('The selected .txt file is empty. Please select a valid file.');
          clearUploadedFile();
          return;
        }

        // Populate the original message text area so the user can review and edit it
        setOriginalText(textContent);
        setCsvParsedRows([]);
        setRawCsvText('');

        // Suggest sender from file name if not already entered
        if (!sender.trim()) {
          const suggestedSender = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setSender(suggestedSender.charAt(0).toUpperCase() + suggestedSender.slice(1));
        }

        // Clear error on message text
        setFieldErrors((prev) => ({ ...prev, originalText: undefined }));
      };

      reader.onerror = () => {
        setIsParsingFile(false);
        setFormErrorMessage('Failed to read the .txt file. Please check file permissions.');
        clearUploadedFile();
      };

      reader.readAsText(file);
    } else if (extension === 'csv') {
      // Parse CSV in browser using PapaParse
      const reader = new FileReader();

      reader.onload = (event) => {
        const rawContent = (event.target?.result as string) || '';
        setRawCsvText(rawContent);

        if (!rawContent.trim()) {
          setIsParsingFile(false);
          setFormErrorMessage('The selected CSV file is empty. Please provide a valid CSV file.');
          clearUploadedFile();
          return;
        }

        // Use PapaParse to parse CSV with strict error detection
        Papa.parse(rawContent, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            setIsParsingFile(false);

            // Check for critical parsing errors
            if (results.errors && results.errors.length > 0) {
              const firstErr = results.errors[0];
              const lineInfo = firstErr.row !== undefined ? ` at row ${firstErr.row + 1}` : '';
              setFormErrorMessage(
                `CSV formatting error${lineInfo}: ${firstErr.message}. Please check quote closures and commas.`
              );
              clearUploadedFile();
              return;
            }

            const rows = results.data as Record<string, string>[];
            const parsedMessages = mapCsvRowsToMessages(rows, rawContent);

            if (parsedMessages.length === 0) {
              setFormErrorMessage(
                'Invalid CSV structure: Could not find any valid message rows. Please ensure your CSV includes a "message" or "text" column, or non-empty message content.'
              );
              clearUploadedFile();
              return;
            }

            if (parsedMessages.length === 1) {
              // Single message in CSV: Prefill the form so user can review and edit directly
              const single = parsedMessages[0];
              setSource(single.source);
              setSender(single.sender);
              setContact(single.contact || '');
              setOriginalText(single.originalText);
              setCsvParsedRows([]);
              setFieldErrors({});
            } else {
              // Multiple messages in CSV: show batch review list
              setCsvParsedRows(parsedMessages);
              setOriginalText(
                `Imported ${parsedMessages.length} messages from "${file.name}". You can review each message in the preview list below before confirming.`
              );
            }
          },
          error: (error: Error) => {
            setIsParsingFile(false);
            setFormErrorMessage(`Failed to parse CSV: ${error.message}`);
            clearUploadedFile();
          },
        });
      };

      reader.onerror = () => {
        setIsParsingFile(false);
        setFormErrorMessage('Failed to read the .csv file.');
        clearUploadedFile();
      };

      reader.readAsText(file);
    }
  };

  // Helper to map CSV objects/rows into NewMessageInput objects
  const mapCsvRowsToMessages = (
    rows: Record<string, string>[],
    rawContent: string
  ): NewMessageInput[] => {
    const results: NewMessageInput[] = [];

    // Detect if header fields matched known patterns
    if (rows.length > 0 && typeof rows[0] === 'object') {
      const keys = Object.keys(rows[0]);

      // Normalize key finder
      const findKey = (patterns: string[]): string | undefined =>
        keys.find((k) => patterns.some((p) => k.toLowerCase().trim() === p.toLowerCase()));

      const messageKey = findKey([
        'message',
        'text',
        'originaltext',
        'content',
        'body',
        'order',
        'order text',
        'inquiry',
      ]);
      const senderKey = findKey(['sender', 'name', 'customer', 'customer name', 'client', 'from']);
      const sourceKey = findKey(['source', 'channel', 'platform']);
      const contactKey = findKey(['contact', 'phone', 'email', 'contact info', 'telephone']);

      if (messageKey) {
        // We have matched columns!
        rows.forEach((row, idx) => {
          const rawMsg = row[messageKey]?.trim();
          if (!rawMsg) return;

          const rawSender = senderKey && row[senderKey]?.trim() ? row[senderKey].trim() : `Customer #${idx + 1}`;
          const rawContact = contactKey && row[contactKey]?.trim() ? row[contactKey].trim() : undefined;

          let msgSource: MessageSource = 'whatsapp';
          if (sourceKey && row[sourceKey]) {
            const sVal = row[sourceKey].toLowerCase();
            if (sVal.includes('email') || sVal.includes('mail')) msgSource = 'email';
            else if (sVal.includes('manual') || sVal.includes('call') || sVal.includes('phone') || sVal.includes('walk-in'))
              msgSource = 'manual';
            else msgSource = 'whatsapp';
          }

          results.push({
            sender: rawSender,
            source: msgSource,
            contact: rawContact,
            originalText: rawMsg,
          });
        });

        if (results.length > 0) return results;
      }
    }

    // Fallback: Parse without headers (index-based)
    const rawParsed = Papa.parse(rawContent, { header: false, skipEmptyLines: true });
    const rawRows = (rawParsed.data as string[][]).filter((r) => r.some((c) => c && c.trim().length > 0));

    rawRows.forEach((cols, idx) => {
      if (cols.length === 0) return;

      // Skip possible header row if it contains the word "message" or "sender"
      if (
        idx === 0 &&
        cols.some((c) => c.toLowerCase() === 'message' || c.toLowerCase() === 'sender')
      ) {
        return;
      }

      let msgSender = `Customer #${idx + 1}`;
      let msgSource: MessageSource = 'whatsapp';
      let msgContact: string | undefined = undefined;
      let msgText = '';

      if (cols.length === 1) {
        msgText = cols[0].trim();
      } else if (cols.length === 2) {
        msgSender = cols[0].trim() || msgSender;
        msgText = cols[1].trim();
      } else if (cols.length === 3) {
        msgSender = cols[0].trim() || msgSender;
        const sVal = cols[1].toLowerCase();
        if (sVal.includes('email')) msgSource = 'email';
        else if (sVal.includes('manual') || sVal.includes('phone')) msgSource = 'manual';
        else msgSource = 'whatsapp';
        msgText = cols[2].trim();
      } else {
        msgSender = cols[0].trim() || msgSender;
        const sVal = cols[1].toLowerCase();
        if (sVal.includes('email')) msgSource = 'email';
        else if (sVal.includes('manual') || sVal.includes('phone')) msgSource = 'manual';
        else msgSource = 'whatsapp';
        msgContact = cols[2].trim() || undefined;
        msgText = cols.slice(3).join(', ').trim();
      }

      if (msgText) {
        results.push({
          sender: msgSender,
          source: msgSource,
          contact: msgContact,
          originalText: msgText,
        });
      }
    });

    return results;
  };

  // Clear uploaded file and reset to manual entry
  const clearUploadedFile = () => {
    setUploadedFileName(null);
    setUploadedFileSize(null);
    setUploadedFileType(null);
    setCsvParsedRows([]);
    setRawCsvText('');
    setFieldErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Sample quick load buttons for convenient testing
  const handleLoadSampleTxt = () => {
    clearUploadedFile();
    setUploadedFileName('sample_bakery_order.txt');
    setUploadedFileSize(248);
    setUploadedFileType('txt');
    setSource('whatsapp');
    setSender('Maya Lin (Downtown Cafe)');
    setContact('+1 (555) 765-4321');
    setOriginalText(
      'Hi Kopi Kita! Nak order 50 sachet kopi 3-in-1 dan 10 kotak kuih lapis. Hantar ke 25, Jalan SS2/10, Petaling Jaya pada 26 Oct sebelum 2pm. Terima kasih!'
    );
    setFieldErrors({});
    setFormErrorMessage(null);
  };

  const handleLoadSampleCsv = () => {
    clearUploadedFile();
    const sampleCsvContent = `sender,source,contact,message
Liam O'Connor,email,liam.oc@company.example,Subject: Weekly Office Bagels - Need 2 dozen assorted bagels with scallion cream cheese for Thursday 9 AM.
Zoe Martinez,whatsapp,+1 (555) 890-4411,Can I pick up 2 strawberry matcha lattes and 1 cinnamon roll around 2:00 PM today?
Front Desk Walk-in,manual,Counter Tablet #1,Customer pre-ordered 2 custom birthday cakes with vanilla buttercream and chocolate drip for Saturday.`;

    setUploadedFileName('sample_orders_batch.csv');
    setUploadedFileSize(412);
    setUploadedFileType('csv');
    setRawCsvText(sampleCsvContent);

    const parsed = Papa.parse(sampleCsvContent, { header: true, skipEmptyLines: true });
    const mapped = mapCsvRowsToMessages(parsed.data as Record<string, string>[], sampleCsvContent);

    setCsvParsedRows(mapped);
    setOriginalText(
      `Imported ${mapped.length} messages from "sample_orders_batch.csv". Review the parsed entries below before confirming submission.`
    );
    setFieldErrors({});
    setFormErrorMessage(null);
  };

  // Quick helper to remove a specific row from batch review
  const handleRemoveCsvRow = (indexToRemove: number) => {
    const updated = csvParsedRows.filter((_, idx) => idx !== indexToRemove);
    setCsvParsedRows(updated);
    if (updated.length === 0) {
      clearUploadedFile();
      setOriginalText('');
    } else if (updated.length === 1) {
      // If only 1 row left, populate form for single editing
      const single = updated[0];
      setSource(single.source);
      setSender(single.sender);
      setContact(single.contact || '');
      setOriginalText(single.originalText);
      setCsvParsedRows([]);
    }
  };

  // Load a specific CSV row into the main form for manual editing
  const handleEditRowInForm = (row: NewMessageInput) => {
    setSource(row.source);
    setSender(row.sender);
    setContact(row.contact || '');
    setOriginalText(row.originalText);
    setCsvParsedRows([]); // Switch to single message mode
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden transition-all flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Add Message to Inbox</span>
              {uploadedFileType && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                  .{uploadedFileType} Mode
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a source, enter sender and text, or import from a TXT or CSV file.
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Top Error Alert Banner */}
          {formErrorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1">
                <p className="font-semibold">Unable to submit message</p>
                <p className="mt-0.5">{formErrorMessage}</p>
              </div>
            </div>
          )}

          {/* 1. Source Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Message Source <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                  { id: 'email', label: 'Email', icon: '✉️' },
                  { id: 'manual', label: 'Manual Entry', icon: '📝' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSource(item.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                    source === item.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 2. File Upload Box (TXT or CSV) */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-blue-600" />
                <span>Import from File (TXT or CSV)</span>
              </label>

              {uploadedFileName && (
                <button
                  type="button"
                  onClick={clearUploadedFile}
                  className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear file</span>
                </button>
              )}
            </div>

            {/* Clickable Drag & Drop Zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition ${
                uploadedFileName
                  ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 bg-white dark:bg-slate-800/60'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,text/plain,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {isParsingFile ? (
                <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Reading and parsing file...</span>
                </div>
              ) : uploadedFileName ? (
                <div className="flex items-center justify-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
                  {uploadedFileType === 'csv' ? (
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <FileText className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className="font-semibold">{uploadedFileName}</span>
                  {uploadedFileSize && (
                    <span className="text-slate-400">({Math.round(uploadedFileSize / 1024 * 10) / 10} KB)</span>
                  )}
                  <span className="text-xs bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-800 dark:text-emerald-200">
                    Loaded
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <Upload className="w-4 h-4 text-slate-400" />
                  <span>
                    Click to browse <strong>.txt</strong> or <strong>.csv</strong> files
                  </span>
                </div>
              )}
            </div>

            {/* Quick Test Samples for Hackathon Judges */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                Quick test files:
              </span>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={handleLoadSampleTxt}
                  className="text-blue-600 hover:underline dark:text-blue-400 font-medium cursor-pointer"
                >
                  Load Sample .txt
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={handleLoadSampleCsv}
                  className="text-blue-600 hover:underline dark:text-blue-400 font-medium cursor-pointer"
                >
                  Load Sample .csv (3 Rows)
                </button>
              </div>
            </div>
          </div>

          {/* 3. Review Imported Text / Form Fields */}
          {csvParsedRows.length > 0 ? (
            /* BATCH CSV REVIEW PANEL */
            <div className="border border-blue-200 dark:border-blue-900/60 rounded-xl p-3.5 bg-blue-50/30 dark:bg-blue-950/20 space-y-3">
              <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-semibold text-slate-900 dark:text-white">
                    Review {csvParsedRows.length} Imported Messages
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setCsvPreviewTab('table')}
                    className={`px-2 py-0.5 rounded ${
                      csvPreviewTab === 'table'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Parsed Cards
                  </button>
                  <button
                    type="button"
                    onClick={() => setCsvPreviewTab('raw')}
                    className={`px-2 py-0.5 rounded ${
                      csvPreviewTab === 'raw'
                        ? 'bg-blue-600 text-white font-medium'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                    }`}
                  >
                    Raw CSV Text
                  </button>
                </div>
              </div>

              {csvPreviewTab === 'table' ? (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {csvParsedRows.map((row, idx) => (
                    <div
                      key={idx}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs space-y-1 shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {row.sender}
                          </span>
                          <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                            {row.source}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditRowInForm(row)}
                            className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline"
                            title="Edit this single message in form"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveCsvRow(idx)}
                            className="text-slate-400 hover:text-rose-600"
                            title="Remove this message"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-[11px] line-clamp-2 bg-slate-50 dark:bg-slate-800/40 p-1.5 rounded">
                        {row.originalText}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="text-[10px] font-mono bg-slate-900 text-slate-100 p-2.5 rounded-lg overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {rawCsvText}
                </pre>
              )}

              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>
                  All {csvParsedRows.length} messages will be assigned a temporary local ID with <strong>Not Analyzed</strong> status upon submission.
                </span>
              </p>
            </div>
          ) : (
            /* SINGLE MESSAGE REVIEW & EDIT FIELDS */
            <>
              {/* Review notice if loaded from TXT file */}
              {uploadedFileType === 'txt' && (
                <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      Loaded from <strong>{uploadedFileName}</strong>. Review and edit the text below before submitting.
                    </span>
                  </div>
                </div>
              )}

              {/* Sender & Contact Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sender Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={sender}
                    onChange={(e) => {
                      setSender(e.target.value);
                      if (fieldErrors.sender) {
                        setFieldErrors((prev) => ({ ...prev, sender: undefined }));
                      }
                    }}
                    placeholder="e.g. Sarah Jenkins"
                    className={`w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none focus:ring-2 text-slate-900 dark:text-slate-100 transition ${
                      fieldErrors.sender
                        ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20'
                        : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                    }`}
                  />
                  {fieldErrors.sender && (
                    <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 block">
                      {fieldErrors.sender}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Contact Info (Phone / Email)
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="e.g. +1 (555) 234-8901"
                    className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Original Message Text Area */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Original Message Text <span className="text-rose-500">*</span>
                  </label>
                  {originalText && (
                    <span className="text-[10px] text-slate-400">
                      {originalText.length} characters
                    </span>
                  )}
                </div>

                <textarea
                  rows={5}
                  value={originalText}
                  onChange={(e) => {
                    setOriginalText(e.target.value);
                    if (fieldErrors.originalText) {
                      setFieldErrors((prev) => ({ ...prev, originalText: undefined }));
                    }
                  }}
                  placeholder="Paste or review the customer order message (e.g. 'Can I order 2 sourdough loaves and 4 croissants for pickup tomorrow?')..."
                  className={`w-full px-3 py-2.5 text-xs font-normal bg-slate-50 dark:bg-slate-800 border rounded-lg focus:outline-none focus:ring-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 transition leading-relaxed ${
                    fieldErrors.originalText
                      ? 'border-rose-400 focus:ring-rose-400 bg-rose-50/20'
                      : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                  }`}
                />
                {fieldErrors.originalText && (
                  <span className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 block">
                    {fieldErrors.originalText}
                  </span>
                )}
              </div>
            </>
          )}

          {/* Submission Info Notice */}
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 text-[11px] flex items-center gap-2">
            <Info className="w-3.5 h-3.5 shrink-0 text-blue-500" />
            <span>
              Submitted messages receive a temporary local ID and start with{' '}
              <strong className="text-slate-800 dark:text-slate-200">Not Analyzed</strong> status.
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Adding to Inbox...</span>
                </>
              ) : csvParsedRows.length > 0 ? (
                <>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Import {csvParsedRows.length} Messages</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Add to Inbox</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
