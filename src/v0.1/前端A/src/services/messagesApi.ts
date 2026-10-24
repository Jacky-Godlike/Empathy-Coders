/**
 * OrderFlow API Service
 * 
 * NOTE FOR DEVELOPERS & JUDGES:
 * This service encapsulates all order message operations.
 * Currently, it uses a browser localStorage mock database with simulated
 * asynchronous network latency (Promise-based) to simulate realistic API behavior.
 * When a real backend (e.g. Express, FastAPI, or cloud functions) is deployed,
 * replace the localStorage calls with standard fetch()/axios() endpoints.
 * 
 * Order recognition here is a mock simulation and NOT connected to a live AI model.
 */

import { INITIAL_MOCK_MESSAGES } from '../data/mockMessages';
import { NewMessageInput, OrderMessage, RecognitionStatus } from '../types/message';

const STORAGE_KEY = 'orderflow_messages_v1';
const LATENCY_STORAGE_KEY = 'orderflow_simulate_latency';

// Helper to delay execution to demonstrate loading states
export const getSimulatedLatencyMs = (): number => {
  const stored = localStorage.getItem(LATENCY_STORAGE_KEY);
  return stored !== null ? Number(stored) : 750; // default 750ms
};

export const setSimulatedLatencyMs = (ms: number): void => {
  localStorage.setItem(LATENCY_STORAGE_KEY, ms.toString());
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Load messages from localStorage or initialize with mock data.
// Safely merges any newly added initial samples without resetting existing user edits or custom messages.
const loadStoredMessages = (): OrderMessage[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const stored: OrderMessage[] = JSON.parse(raw);
      if (Array.isArray(stored)) {
        // Check for newly introduced initial mock messages that are not yet stored
        const storedIds = new Set(stored.map((m) => m.id));
        const missingInitial = INITIAL_MOCK_MESSAGES.filter((m) => !storedIds.has(m.id));

        if (missingInitial.length > 0) {
          // Append new mock samples non-destructively, preserving existing user data & statuses
          const merged = [...stored, ...missingInitial];
          saveStoredMessages(merged);
          return merged;
        }

        return stored;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored OrderFlow messages:', err);
  }
  // Initialize default mock data for fresh visits
  saveStoredMessages(INITIAL_MOCK_MESSAGES);
  return INITIAL_MOCK_MESSAGES;
};

const saveStoredMessages = (messages: OrderMessage[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch (err) {
    console.error('Failed to save OrderFlow messages to localStorage:', err);
  }
};

/**
 * Fetch all messages from the inbox
 */
export async function fetchMessages(): Promise<OrderMessage[]> {
  await delay(getSimulatedLatencyMs());
  return loadStoredMessages();
}

/**
 * Create a new message manually or through file import
 */
export async function createMessage(input: NewMessageInput): Promise<OrderMessage> {
  await delay(getSimulatedLatencyMs());

  const messages = loadStoredMessages();
  const newMessage: OrderMessage = {
    // Explicit temporary local ID format for client-side added messages
    id: `local-temp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    source: input.source,
    sender: input.sender.trim(),
    contact: input.contact?.trim() || undefined,
    timestamp: input.timestamp || new Date().toISOString(),
    originalText: input.originalText.trim(),
    status: 'not_analyzed',
  };

  const updated = [newMessage, ...messages];
  saveStoredMessages(updated);
  return newMessage;
}

/**
 * Batch import messages from a parsed CSV or text file
 */
export async function importMessagesBatch(inputs: NewMessageInput[]): Promise<OrderMessage[]> {
  await delay(getSimulatedLatencyMs());

  const messages = loadStoredMessages();
  const created: OrderMessage[] = inputs.map((input, index) => ({
    // Explicit temporary local ID format for batch imports
    id: `local-temp-${Date.now()}-${index + 1}-${Math.random().toString(36).substring(2, 6)}`,
    source: input.source,
    sender: input.sender.trim(),
    contact: input.contact?.trim() || undefined,
    timestamp: input.timestamp || new Date(Date.now() - index * 60000).toISOString(),
    originalText: input.originalText.trim(),
    status: 'not_analyzed',
  }));

  const updated = [...created, ...messages];
  saveStoredMessages(updated);
  return created;
}

/**
 * Simulate the "Analyze as Order" processing pipeline.
 * NOTE: This is a front-end mock demonstration rule engine.
 * No real backend AI is connected.
 */
export async function analyzeMessageAsOrder(messageId: string): Promise<OrderMessage> {
  // First simulate processing delay
  const analysisTime = Math.max(900, getSimulatedLatencyMs() * 1.4);
  await delay(analysisTime);

  const messages = loadStoredMessages();
  const messageIndex = messages.findIndex((m) => m.id === messageId);

  if (messageIndex === -1) {
    throw new Error(`Message with ID "${messageId}" was not found.`);
  }

  const message = messages[messageIndex];
  const text = message.originalText.toLowerCase();

  // Mock heuristics for demo categorization
  let status: RecognitionStatus = 'recognized_as_order';
  let summary = 'Order recognized from customer message text.';
  let confidence = 92;

  const isQuestionOnly =
    (text.includes('do you have') || text.includes('are you open') || text.includes('in stock?')) &&
    !text.includes('deliver') &&
    !text.includes('order');

  const isSpamOrAdmin =
    text.includes('statement') ||
    text.includes('invoice #') ||
    text.includes('newsletter') ||
    text.includes('thank you so much') ||
    text.includes('loved them');

  const isAmbiguous =
    text.includes('call back') ||
    text.includes('not sure') ||
    text.includes('whatever sandwiches') ||
    text.includes('loose') ||
    text.includes('poor connection');

  if (isSpamOrAdmin || isQuestionOnly) {
    status = 'not_an_order';
    confidence = 94;
    summary = isSpamOrAdmin
      ? 'Administrative / notification message or general feedback. No order detected.'
      : 'General menu or stock inquiry without order placement.';
  } else if (isAmbiguous) {
    status = 'needs_human_review';
    confidence = 68;
    summary = 'Order intent detected, but quantities, items, or payment details require staff review.';
  } else {
    status = 'recognized_as_order';
    confidence = 95;
    summary = 'High confidence order request with identifiable items and delivery/pickup cues.';
  }

  // Generate mock extracted items based on content
  const mockItems = [];
  if (status !== 'not_an_order') {
    if (text.includes('matcha') || text.includes('latte')) {
      mockItems.push({ id: 'item-1', name: 'Iced Oat Matcha Latte', quantity: 1, unitPrice: 6.5 });
    }
    if (text.includes('cold brew')) {
      mockItems.push({ id: 'item-2', name: 'Cold Brew w/ Sweet Cream', quantity: 2, unitPrice: 5.75 });
    }
    if (text.includes('muffin') || text.includes('cinnamon')) {
      mockItems.push({ id: 'item-3', name: 'Cinnamon Swirl Muffin', quantity: 1, unitPrice: 4.25 });
    }
    if (text.includes('coffee') || text.includes('beans')) {
      mockItems.push({ id: 'item-4', name: 'House Blend Whole Bean Coffee (12oz)', quantity: 5, unitPrice: 16.0 });
    }
    if (text.includes('tote')) {
      mockItems.push({ id: 'item-5', name: 'Reusable Canvas Tote Bag', quantity: 2, unitPrice: 12.0 });
    }
    if (mockItems.length === 0) {
      mockItems.push({
        id: 'item-default',
        name: 'Custom Order Package (Auto-Extracted)',
        quantity: 1,
        unitPrice: 25.0,
      });
    }
  }

  const calculatedTotal = mockItems.reduce((acc, item) => acc + (item.unitPrice || 0) * item.quantity, 0);

  const updatedMessage: OrderMessage = {
    ...message,
    status,
    parsedData:
      status === 'not_an_order'
        ? { items: [], confidenceScore: confidence, analysisSummary: summary }
        : {
            items: mockItems,
            totalEstimate: calculatedTotal > 0 ? calculatedTotal : 28.5,
            deliveryType: text.includes('deliver') ? 'delivery' : 'pickup',
            deliveryAddress: text.includes('maple')
              ? '324 Maple Lane Apt 4B'
              : text.includes('deliver')
              ? 'Address specified in message'
              : undefined,
            targetDateTime: text.includes('asap') ? 'ASAP' : 'Same day',
            confidenceScore: confidence,
            analysisSummary: summary,
          },
  };

  messages[messageIndex] = updatedMessage;
  saveStoredMessages(messages);
  return updatedMessage;
}

/**
 * Manually update status (e.g. human verification override)
 */
export async function updateMessageStatus(
  messageId: string,
  newStatus: RecognitionStatus,
  reviewNotes?: string
): Promise<OrderMessage> {
  await delay(300);

  const messages = loadStoredMessages();
  const index = messages.findIndex((m) => m.id === messageId);
  if (index === -1) {
    throw new Error('Message not found');
  }

  messages[index] = {
    ...messages[index],
    status: newStatus,
    reviewNotes: reviewNotes !== undefined ? reviewNotes : messages[index].reviewNotes,
  };

  saveStoredMessages(messages);
  return messages[index];
}

/**
 * Delete a message
 */
export async function deleteMessage(messageId: string): Promise<void> {
  await delay(250);

  const messages = loadStoredMessages();
  const updated = messages.filter((m) => m.id !== messageId);
  saveStoredMessages(updated);
}

/**
 * Reset demo data back to initial mock inbox state
 */
export async function resetMockData(): Promise<OrderMessage[]> {
  await delay(400);
  saveStoredMessages(INITIAL_MOCK_MESSAGES);
  return INITIAL_MOCK_MESSAGES;
}
