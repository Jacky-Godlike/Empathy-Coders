import {
  ActivityEvent,
  DecisionInput,
  DecisionResponse,
  IntakeProcessResult,
  IntakeSummary,
  Order,
  RiskReport,
} from '../types/order';
import { API_BASE, apiRequest } from './http';

export function createOrderFromMessage(messageId: string): Promise<Order> {
  return apiRequest<Order>(`/api/messages/${messageId}/order`, {
    method: 'POST',
  });
}

export function analyzeOrder(orderId: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${orderId}/analyze`, {
    method: 'POST',
  });
}

export function fetchOrders(): Promise<Order[]> {
  return apiRequest<Order[]>('/api/orders');
}

export function fetchOrder(orderId: string): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${orderId}`);
}

export function recordOrderOutcome(
  orderId: string,
  outcome: { actualDeliveredOnTime?: boolean; actualProfit?: number }
): Promise<Order> {
  return apiRequest<Order>(`/api/orders/${orderId}/outcome`, {
    method: 'PATCH',
    body: JSON.stringify(outcome),
  });
}

export function fetchRiskReport(
  period: 'week' | 'month'
): Promise<RiskReport> {
  return apiRequest<RiskReport>(`/api/reports/risk?period=${period}`);
}

export function decideOrder(
  orderId: string,
  input: DecisionInput
): Promise<DecisionResponse> {
  return apiRequest<DecisionResponse>(`/api/orders/${orderId}/decision`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchOrderActivity(orderId: string): Promise<ActivityEvent[]> {
  return apiRequest<ActivityEvent[]>(`/api/orders/${orderId}/activity`);
}

export function fetchActivity(): Promise<ActivityEvent[]> {
  return apiRequest<ActivityEvent[]>('/api/activity');
}

export function exportCsvUrl(): string {
  return `${API_BASE}/api/orders/export.csv`;
}

export function exportXlsxUrl(): string {
  return `${API_BASE}/api/orders/export.xlsx`;
}

export function fetchIntakeSummary(): Promise<IntakeSummary> {
  return apiRequest<IntakeSummary>('/api/intake/summary');
}

export function processIntake(): Promise<IntakeProcessResult> {
  return apiRequest<IntakeProcessResult>('/api/intake/process', {
    method: 'POST',
  });
}
