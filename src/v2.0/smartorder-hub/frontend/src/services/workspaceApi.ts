import {
  AIStatus,
  AITestResult,
  IndustryProfile,
  Workspace,
} from '../types/order';
import { apiRequest } from './http';

export function fetchWorkspace(): Promise<Workspace> {
  return apiRequest<Workspace>('/api/workspace');
}

export function fetchIndustries(): Promise<{ industries: IndustryProfile[] }> {
  return apiRequest<{ industries: IndustryProfile[] }>('/api/industries');
}

export function switchIndustry(
  industry: string
): Promise<{ status: string; workspace: Workspace }> {
  return apiRequest<{ status: string; workspace: Workspace }>('/api/industry', {
    method: 'POST',
    body: JSON.stringify({ industry }),
  });
}

export function fetchAiStatus(): Promise<AIStatus> {
  return apiRequest<AIStatus>('/api/ai/status');
}

export function testAiConnection(): Promise<AITestResult> {
  return apiRequest<AITestResult>('/api/ai/test', { method: 'POST' });
}

export interface CatalogProduct {
  sku: string;
  name: string;
  aliases: string[];
  unit: string;
  sellPrice: number;
  unitCost: number;
  stock: number;
  safetyStock: number;
  supplierId: string;
  capacityKg?: number;
}

export interface CatalogSupplier {
  id: string;
  name: string;
  leadTimeDays: number;
  moq: number;
  contact: string;
}

export interface CatalogResponse {
  products: CatalogProduct[];
  suppliers: CatalogSupplier[];
  industry: IndustryProfile;
  source?: string;
}

export function fetchCatalog(): Promise<CatalogResponse> {
  return apiRequest<CatalogResponse>('/api/catalog');
}
