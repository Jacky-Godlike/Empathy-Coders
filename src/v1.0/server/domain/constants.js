export const ROLES = {
  OWNER: 'owner',
  STAFF: 'staff',
};

export const ROLE_LABELS = {
  owner: 'Owner / Manager',
  staff: 'Staff / Reviewer',
};

export const CHANNELS = ['whatsapp', 'email', 'manual'];

export const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  manual: 'Manual entry',
};

export const ORDER_STATUS = {
  DRAFT: 'draft',
  NEEDS_INFO: 'needs_info',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
  SUPERSEDED: 'superseded',
};

export const ORDER_STATUS_LABELS = {
  draft: 'Awaiting approval',
  needs_info: 'Info requested',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  superseded: 'Superseded by change',
};

export const RECOMMENDATION = {
  READY: 'READY',
  PROCUREMENT: 'PROCUREMENT',
  REVIEW: 'REVIEW',
  NEEDS_INFO: 'NEEDS_INFO',
  HIGH_RISK: 'HIGH_RISK',
  CHANGE_REQUEST: 'CHANGE_REQUEST',
};

export const RECOMMENDATION_META = {
  READY: {
    label: 'Ready to accept',
    shortLabel: 'Ready',
    severity: 'success',
    description: 'Stock, margin and delivery date all pass the rules.',
  },
  PROCUREMENT: {
    label: 'Procurement needed',
    shortLabel: 'Procurement',
    severity: 'info',
    description: 'Part of the order is short in stock, but a supplier can restock before the delivery date.',
  },
  REVIEW: {
    label: 'Review recommended',
    shortLabel: 'Review',
    severity: 'warning',
    description: 'One or more commercial checks are close to the limit. A human should look before approving.',
  },
  NEEDS_INFO: {
    label: 'Customer info needed',
    shortLabel: 'Needs info',
    severity: 'warning',
    description: 'A required field is missing or a product could not be matched to the catalogue.',
  },
  HIGH_RISK: {
    label: 'High risk',
    shortLabel: 'High risk',
    severity: 'danger',
    description: 'The order cannot be fulfilled in time or would lose money. Approving it requires an explicit override note.',
  },
  CHANGE_REQUEST: {
    label: 'Change request',
    shortLabel: 'Change',
    severity: 'info',
    description: 'This is a change to an order that was already approved. It needs a fresh approval.',
  },
};

export const REQUIRED_FIELDS = [
  { key: 'customerName', label: 'Customer name' },
  { key: 'contact', label: 'Phone or email' },
  { key: 'items', label: 'At least one item' },
  { key: 'deliveryDate', label: 'Delivery date' },
  { key: 'address', label: 'Delivery address' },
];

export const REQUIRED_FIELD_KEYS = REQUIRED_FIELDS.map((field) => field.key);

export const ACTIVITY_ACTIONS = {
  MESSAGE_IMPORTED: 'message.imported',
  TRIAGE_STARTED: 'triage.started',
  TRIAGE_COMPLETED: 'triage.completed',
  TRIAGE_ERROR: 'triage.error',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_REANALYZED: 'order.reanalyzed',
  ORDER_APPROVED: 'order.approved',
  ORDER_REJECTED: 'order.rejected',
  ORDER_INFO_REQUESTED: 'order.info_requested',
  ORDER_EDITED: 'order.edited',
  ORDER_CANCELLED: 'order.cancelled',
  ORDER_SUPERSEDED: 'order.superseded',
  STOCK_RESERVED: 'stock.reserved',
  STOCK_RELEASED: 'stock.released',
  PURCHASE_DRAFT_CREATED: 'purchase_draft.created',
  PURCHASE_DRAFT_RECEIVED: 'purchase_draft.received',
  EXPORT_GENERATED: 'export.generated',
  DEMO_RESET: 'demo.reset',
  AI_FALLBACK: 'ai.fallback',
};

export const ACTOR_SYSTEM = {
  id: 'system',
  name: 'OrderPilot automation',
  role: 'system',
};
