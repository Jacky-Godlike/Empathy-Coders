import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(here, '..');

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const providerKeys = {
  gemini: process.env.GEMINI_API_KEY || '',
  openai: process.env.OPENAI_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
};

const requestedProvider = (process.env.AI_PROVIDER || 'auto').toLowerCase();

function detectProvider() {
  if (requestedProvider !== 'auto') return requestedProvider;
  if (providerKeys.gemini) return 'gemini';
  if (providerKeys.openai) return 'openai';
  if (providerKeys.deepseek) return 'deepseek';
  if (providerKeys.anthropic) return 'anthropic';
  const genericKey = process.env.AI_API_KEY || '';
  if (process.env.AI_BASE_URL && genericKey) return 'openai-compatible';
  // A single AI_API_KEY is a common setup. Infer the provider from the key
  // prefix where it is unambiguous; otherwise ask the user to set AI_PROVIDER.
  if (genericKey.startsWith('AIza')) return 'gemini';
  if (genericKey.startsWith('sk-ant')) return 'anthropic';
  if (genericKey.startsWith('sk-')) return 'openai';
  return 'rules';
}

const provider = detectProvider();

const defaultModels = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  deepseek: 'deepseek-flash',
  anthropic: 'claude-sonnet-5-5',
  'openai-compatible': 'gpt-4.1-mini',
  rules: null,
};

const defaultBaseUrls = {
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com',
  'openai-compatible': process.env.AI_BASE_URL || 'https://api.openai.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  anthropic: 'https://api.anthropic.com/v1',
};

function resolveApiKey() {
  if (process.env.AI_API_KEY) return process.env.AI_API_KEY;
  return providerKeys[provider] || '';
}

const apiKey = resolveApiKey();
const aiConfigured = provider !== 'rules' && Boolean(apiKey);

export const config = {
  version: '1.0.0',
  rootDir,
  paths: {
    seedDir: process.env.ORDERPILOT_SEED_DIR || path.join(rootDir, 'data', 'seed'),
    runtimeDir: process.env.ORDERPILOT_RUNTIME_DIR || path.join(rootDir, 'data', 'runtime'),
    publicDir: path.join(rootDir, 'public'),
  },
  server: {
    port: numberFromEnv('PORT', 3000),
    bodyLimit: '256kb',
  },
  business: {
    name: 'Kopi & Co. Supply',
    shortName: 'Kopi & Co.',
    timezone: 'Asia/Kuala_Lumpur',
    currency: 'MYR',
  },
  ai: {
    provider,
    configured: aiConfigured,
    model: process.env.AI_MODEL || defaultModels[provider] || null,
    baseUrl: process.env.AI_BASE_URL || defaultBaseUrls[provider] || null,
    apiKey,
    timeoutMs: numberFromEnv('AI_TIMEOUT_MS', 45_000),
    // Kept deliberately small so a live demo cannot burn a sponsor's quota.
    maxMessagesPerCall: numberFromEnv('AI_MAX_MESSAGES_PER_CALL', 10),
    maxOutputTokens: numberFromEnv('AI_MAX_OUTPUT_TOKENS', 4096),
  },
  rules: {
    marginMinPct: numberFromEnv('RULE_MARGIN_MIN_PCT', 10),
    marginRejectPct: numberFromEnv('RULE_MARGIN_REJECT_PCT', 0),
    priceDeviationPct: numberFromEnv('RULE_PRICE_DEVIATION_PCT', 15),
    lowConfidence: numberFromEnv('RULE_LOW_CONFIDENCE', 0.55),
    duplicateWindowHours: numberFromEnv('RULE_DUPLICATE_WINDOW_HOURS', 48),
    consolidationWindowHours: numberFromEnv('RULE_CONSOLIDATION_WINDOW_HOURS', 72),
    handlingDays: numberFromEnv('RULE_HANDLING_DAYS', 1),
  },
  demo: {
    allowRoleSwitch: (process.env.ALLOW_ROLE_SWITCH || 'true') !== 'false',
    defaultActorId: process.env.DEFAULT_ACTOR_ID || 'u-aina',
  },
};

export function aiStatus() {
  return {
    provider: config.ai.provider,
    configured: config.ai.configured,
    mode: config.ai.configured ? 'ai' : 'rules',
    model: config.ai.model,
    label: config.ai.configured
      ? `AI · ${config.ai.provider}`
      : 'Rules fallback',
    detail: config.ai.configured
      ? `Messages are extracted with ${config.ai.provider}${config.ai.model ? ` (${config.ai.model})` : ''}. Stock, margin and risk are still calculated by deterministic rules.`
      : process.env.AI_API_KEY
        ? 'AI_API_KEY is set, but the provider could not be detected. Add AI_PROVIDER=gemini / openai / deepseek / anthropic, or add AI_BASE_URL for an OpenAI-compatible endpoint, then restart.'
        : 'No AI key is configured. OrderPilot is using the built-in deterministic extractor, so the full demo still works. Add AI_API_KEY and AI_PROVIDER (for example gemini) in Replit Secrets to switch to real AI extraction.',
  };
}
