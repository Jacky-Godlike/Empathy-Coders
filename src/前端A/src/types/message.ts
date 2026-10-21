export type MessageSource = 'whatsapp' | 'email' | 'manual';

export type RecognitionStatus =
  | 'not_analyzed'
  | 'processing'
  | 'recognized_as_order'
  | 'not_an_order'
  | 'needs_human_review';

export interface OrderItem {
  id: string;
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
}

export interface OrderMessage {
  id: string;
  source: MessageSource;
  sender: string;
  contact?: string;
  timestamp: string; // ISO string
  originalText: string;
  status: RecognitionStatus;
  parsedData?: ParsedOrderData;
  reviewNotes?: string;
  errorMessage?: string;
}

export interface NewMessageInput {
  source: MessageSource;
  sender: string;
  contact?: string;
  originalText: string;
  timestamp?: string;
}
