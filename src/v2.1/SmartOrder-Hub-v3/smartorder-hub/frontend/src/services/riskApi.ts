import { RiskInsight } from '../types/order';
import { apiRequest } from './http';

export function fetchRiskInsight(language: string): Promise<RiskInsight> {
  return apiRequest<RiskInsight>(
    `/api/risk/insights?language=${encodeURIComponent(language)}`
  );
}
