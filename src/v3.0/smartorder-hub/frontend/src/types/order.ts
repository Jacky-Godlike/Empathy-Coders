export type Recommendation =
  | 'ACCEPT'
  | 'ACCEPT_WITH_PURCHASE'
  | 'REQUEST_INFO'
  | 'REJECT'
  | 'NEEDS_REVIEW';

export type OrderStatus =
  | 'draft'
  | 'analyzed'
  | 'approved'
  | 'rejected'
  | 'info_requested';

export type AppView =
  | 'desk'
  | 'inbox'
  | 'channels'
  | 'orders'
  | 'activity'
  | 'catalog'
  | 'settings';

export interface Check {
  code: string;
  level: 'pass' | 'warn' | 'fail';
  message: string;
}

export interface StockCheck {
  sku: string;
  name: string;
  required: number;
  available: number;
  shortfall: number;
  supplierId: string;
  supplierName: string;
  leadTimeDays: number;
  canReplenishInTime: boolean;
  suggestedPurchaseQty: number;
  unitCost: number;
  purchaseCost: number;
}

export type RiskBand = 'Low' | 'Medium' | 'High' | 'Critical';

export interface RiskFactor {
  key: string;
  label: string;
  score: number;
  weight: number;
  weighted: number;
  detail: string;
}

export interface Analysis {
  recommendation: Recommendation;
  reasons: string[];
  checks: Check[];
  stock: StockCheck[];
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  riskScore: number;
  rawRiskScore?: number;
  riskBand: RiskBand;
  riskFactors: RiskFactor[];
  daysUntilDelivery: number | null;
  missingFields: string[];
  confidence: number;
  analyzedAt: string;
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PurchaseDraftItem {
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseDraft {
  id: string;
  orderId: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseDraftItem[];
  totalCost: number;
  expectedDate: string;
  status: string;
  createdAt: string;
}

export interface Approval {
  decision: 'approve' | 'reject' | 'request_info';
  actor: string;
  role: string;
  note: string;
  override?: boolean;
  decidedAt: string;
}

export interface Order {
  id: string;
  messageId: string;
  source: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'email' | 'tiktok' | 'manual';
  industry: string;
  industryFields: Record<string, string>;
  extractionMethod?: 'ai' | 'rules';
  customerName: string;
  contact?: string;
  items: OrderItem[];
  deliveryType: 'pickup' | 'delivery' | 'dine-in' | 'unspecified';
  deliveryAddress: string;
  requestedDeliveryDate: string | null;
  notes: string;
  confidence: number;
  status: OrderStatus;
  analysis?: Analysis;
  approval?: Approval;
  purchaseDrafts: PurchaseDraft[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  id: string;
  ts: string;
  actor: string;
  role: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export interface DecisionInput {
  decision: 'approve' | 'reject' | 'request_info';
  actor: string;
  role: 'staff' | 'manager' | 'owner';
  note: string;
  override?: boolean;
}

export interface DecisionResponse {
  order: Order;
  suggestedReply?: string | null;
}

export interface IndustryFieldDef {
  key: string;
  label: string;
  table?: boolean;
  required?: boolean;
  pattern?: string;
}

export interface IndustryProfile {
  id: string;
  name: string;
  tagline: string;
  businessName: string;
  inventoryMode: 'stock' | 'capacity' | 'material';
  labels: {
    summary: string;
    date: string;
    stock: string;
    details: string;
  };
  fields: IndustryFieldDef[];
  requiredFields: string[];
  riskWeights: Record<string, number>;
}

export interface AIStatus {
  configured: boolean;
  provider: string;
  providerLabel?: string;
  model: string;
  intakeMode: string;
  keyEnv?: string;
  baseUrl?: string | null;
  keyUrl?: string;
  envLines?: string[];
  note?: string;
  docs?: string;
}

export interface AITestResult {
  ok: boolean;
  provider: string;
  providerLabel: string;
  model: string;
  latencyMs: number;
  jsonValid: boolean;
  sample: string;
  message: string;
}

export interface RiskTypeShare {
  key: string;
  label: string;
  share: number;
  points: number;
  averageScore: number;
  affectedOrders: number;
  examples?: string[];
}

export interface RiskInsight {
  orderCount: number;
  totalRiskPoints: number;
  topRisks: RiskTypeShare[];
  allRisks: RiskTypeShare[];
  summary: string;
  suggestions: string[];
  generatedBy: 'ai' | 'rules';
  providerLabel: string;
  model: string;
  language: string;
  aiConfigured: boolean;
  aiError?: string | null;
}

export interface Workspace {
  businessName: string;
  industry: IndustryProfile;
  industries: IndustryProfile[];
  ai: AIStatus;
  ownerPasswordRequired: boolean;
  rules: {
    minMargin: number;
    warnMargin: number;
    highValueThreshold: number;
    leadTimeBufferDays: number;
    minConfidence: number;
  };
  stats: IntakeSummary;
}

export interface IntakeSummary {
  industry?: string;
  totalMessages: number;
  processedMessages: number;
  unprocessed: number;
  byType: Record<string, number>;
  orders: number;
  awaitingConfirmation: number;
  approved: number;
  needsInfo: number;
  rejected: number;
}

export interface IntakeProcessResult {
  processed: number;
  ordersCreated: number;
  byType: Record<string, number>;
}
