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
  scoreThresholds?: { medium: number; high: number; critical: number };
  assessmentLayer?: 'information_missing' | 'hard_block' | 'weighted_review' | 'low_risk_precheck';
  riskFactors: RiskFactor[];
  riskTriggers?: Array<{ code: string; category: string; detail: string }>;
  responseActions?: Array<{
    strategy: 'avoid' | 'transfer' | 'mitigate' | 'accept' | 'escalate';
    action: string;
    suggestedReply?: string;
    earliestCommitDate?: string;
  }>;
  complianceBlocked?: boolean;
  informationMissing?: boolean;
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
  specialReason?: 'strategic_customer' | 'clear_inventory' | 'new_process' | 'other';
  decidedAt: string;
}

export interface ActualOutcome {
  actualDeliveredOnTime?: boolean;
  actualProfit?: number;
  updatedAt?: string;
}

export interface Order {
  id: string;
  messageId: string;
  source: 'whatsapp' | 'facebook' | 'instagram' | 'telegram' | 'email' | 'tiktok' | 'manual';
  industry: string;
  industryFields: Record<string, string | null>;
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
  actualOutcome?: ActualOutcome;
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
  specialReason?: 'strategic_customer' | 'clear_inventory' | 'new_process' | 'other';
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

export interface Workspace {
  businessName: string;
  industry: IndustryProfile;
  industries: IndustryProfile[];
  ai: AIStatus;
  rules: {
    minMargin: number;
    warnMargin: number;
    highValueThreshold: number;
    leadTimeBufferDays: number;
    minConfidence: number;
    riskMediumThreshold: number;
    riskHighThreshold: number;
    riskCriticalThreshold: number;
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

export interface RiskReport {
  period: 'week' | 'month';
  generatedAt: string;
  ordersReviewed: number;
  riskTriggerTop5: Array<{
    category: string;
    count: number;
    examples: string[];
  }>;
  specialApprovals: Array<{
    orderId: string;
    reason?: string;
    expectedProfit?: number;
    actualProfit?: number;
    actualDeliveredOnTime?: boolean;
  }>;
  specialApprovalExpectedProfit: number;
  specialApprovalActualProfit: number;
  extractionAccuracy: {
    reviewed: number;
    accurate: number;
    rate: number | null;
  };
  extractionAccuracyTrend: Array<{
    label: string;
    reviewed: number;
    accurate: number;
    rate: number | null;
  }>;
}
