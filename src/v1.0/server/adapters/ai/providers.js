function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitize(text, apiKey) {
  if (!text) return '';
  const withoutKey = apiKey ? String(text).split(apiKey).join('[redacted]') : String(text);
  return withoutKey.slice(0, 800);
}

async function readError(response, apiKey) {
  let body = '';
  try {
    body = await response.text();
  } catch {
    body = '';
  }
  return sanitize(body, apiKey);
}

function isRetryable(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`AI request timed out after ${timeoutMs}ms`);
      timeoutError.code = 'AI_TIMEOUT';
      throw timeoutError;
    }
    const networkError = new Error(`AI network error: ${error.message}`);
    networkError.code = 'AI_NETWORK';
    throw networkError;
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson(url, options, { apiKey, timeoutMs, provider }) {
  let lastError;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      if (!response.ok) {
        const body = await readError(response, apiKey);
        const error = new Error(`${provider} returned HTTP ${response.status}: ${body}`);
        error.status = response.status;
        error.code = response.status === 401 || response.status === 403 ? 'AI_AUTH' : 'AI_HTTP';
        error.body = body;
        if (attempt === 0 && isRetryable(response.status)) {
          lastError = error;
          await sleep(800);
          continue;
        }
        throw error;
      }
      return await response.json();
    } catch (error) {
      if (error.code === 'AI_AUTH' || error.code === 'AI_TIMEOUT' || error.code === 'AI_NETWORK') throw error;
      if (attempt === 0 && (!error.status || isRetryable(error.status))) {
        lastError = error;
        await sleep(800);
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error(`${provider} request failed`);
}

function extractOpenAIText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  return '';
}

export async function callOpenAICompatible({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  maxOutputTokens,
  timeoutMs,
}) {
  const endpoint = `${String(baseUrl).replace(/\/$/, '')}/chat/completions`;
  const baseBody = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_tokens: maxOutputTokens,
  };
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };

  let data;
  try {
    data = await requestJson(
      endpoint,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...baseBody, response_format: { type: 'json_object' } }),
      },
      { apiKey, timeoutMs, provider: 'openai-compatible' },
    );
  } catch (error) {
    // Some OpenAI-compatible providers do not support response_format.
    if (error.status === 400 && /response_format|json_object/i.test(error.body || '')) {
      data = await requestJson(
        endpoint,
        { method: 'POST', headers, body: JSON.stringify(baseBody) },
        { apiKey, timeoutMs, provider: 'openai-compatible' },
      );
    } else {
      throw error;
    }
  }

  return {
    text: extractOpenAIText(data),
    model: data?.model || model,
    usage: data?.usage || null,
  };
}

export async function callGemini({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  maxOutputTokens,
  timeoutMs,
}) {
  const endpoint = `${String(baseUrl).replace(/\/$/, '')}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const data = await requestJson(
    endpoint,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          maxOutputTokens,
        },
      }),
    },
    { apiKey, timeoutMs, provider: 'gemini' },
  );

  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    const error = new Error(`Gemini blocked the request: ${blockReason}`);
    error.code = 'AI_BLOCKED';
    throw error;
  }
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map((part) => part?.text || '')
    .join('');
  return {
    text,
    model,
    usage: data?.usageMetadata || null,
  };
}

export async function callAnthropic({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  maxOutputTokens,
  timeoutMs,
}) {
  const endpoint = `${String(baseUrl).replace(/\/$/, '')}/messages`;
  const data = await requestJson(
    endpoint,
    {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxOutputTokens,
        temperature: 0.1,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    },
    { apiKey, timeoutMs, provider: 'anthropic' },
  );

  const text = (data?.content || [])
    .filter((part) => part?.type === 'text')
    .map((part) => part.text)
    .join('');
  return {
    text,
    model: data?.model || model,
    usage: data?.usage || null,
  };
}

export async function callProvider({ aiConfig, system, user }) {
  const common = {
    apiKey: aiConfig.apiKey,
    baseUrl: aiConfig.baseUrl,
    model: aiConfig.model,
    system,
    user,
    maxOutputTokens: aiConfig.maxOutputTokens,
    timeoutMs: aiConfig.timeoutMs,
  };
  switch (aiConfig.provider) {
    case 'gemini':
      return callGemini(common);
    case 'anthropic':
      return callAnthropic(common);
    case 'openai':
    case 'deepseek':
    case 'openai-compatible':
      return callOpenAICompatible(common);
    default:
      throw new Error(`Unsupported AI provider: ${aiConfig.provider}`);
  }
}
