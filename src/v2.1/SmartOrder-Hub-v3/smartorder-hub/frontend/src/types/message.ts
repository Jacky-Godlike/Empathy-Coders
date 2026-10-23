export type MessageSource =
  | 'whatsapp'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'email'
  | 'tiktok'
  | 'manual';

export type RecognitionStatus =
  | 'not_analyzed'
  | 'processing'
  | 'recognized_as_order'
  | 'not_an_order'
  | 'needs_human_review';

export type MessageType =
  | 'order'
  | 'inquiry'
  | 'after_sales'
  | 'ad'
  | 'other'
  | 'uncertain';

export interface OrderItem {
  id: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  specialInstructions?: string;
}

export interface ParsedOrderData {
  items: OrderItem[];
  totalEstimate?: number;
  deliveryType?: 'pickup' | 'delivery' | 'dine-in' | 'unspecified';
  deliveryAddress?: string;
  targetDateTime?: string;
  customerNotes?: string;
  confidenceScore: number; // 0 to 100
  analysisSummary: string;
  method?: 'ai' | 'rules';
  messageType?: MessageType;
  industryFields?: Record<string, string>;
  customerName?: string;
  contact?: string;
  requestedDeliveryDate?: string;
  missingFields?: string[];
}

export interface OrderMessage {
  id: string;
  source: MessageSource;
  sender: string;
  contact?: string;
  channelId?: string;
  channelAccount?: string;
  externalId?: string;
  timestamp: string; // ISO string
  originalText: string;
  status: RecognitionStatus;
  parsedData?: ParsedOrderData;
  reviewNotes?: string;
  errorMessage?: string;
  orderId?: string;
}

export interface NewMessageInput {
  source: MessageSource;
  sender: string;
  contact?: string;
  channelAccount?: string;
  externalId?: string;
  originalText: string;
  timestamp?: string;
}
