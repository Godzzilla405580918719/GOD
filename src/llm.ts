import { LlmSettings, Message } from './types';

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      role?: string;
      content?: string;
    };
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

async function safeFetch(url: string, init: RequestInit, provider: 'Gemini' | 'OpenAI-compatible') {
  try {
    return await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown network error';
    if (provider === 'OpenAI-compatible' && message.toLowerCase().includes('failed to fetch')) {
      throw new Error(
        'OpenAI-compatible request failed in browser (Failed to fetch). This is commonly CORS/network policy. Use Gemini preset, Ollama local preset, or route requests through your own backend relay.'
      );
    }

    throw new Error(
      `${provider} request could not reach the endpoint (${message}). Check internet access, endpoint URL, CORS/referrer restrictions, and firewall/proxy settings.`
    );
  }
}

function formatProviderHttpError(provider: 'Gemini' | 'OpenAI-compatible', status: number, details: string): string {
  const brief = details.slice(0, 220);

  if (status === 429) {
    return `${provider} quota/rate limit reached (429): ${brief}. Check billing/quota, then retry later or switch to Ollama preset.`;
  }

  if (status === 401 || status === 403) {
    return `${provider} authentication/permission failed (${status}): ${brief}. Verify API key and provider permissions.`;
  }

  if (provider === 'Gemini') {
    return `Gemini request failed (${status}): ${brief}. Verify API key validity and that Generative Language API is enabled.`;
  }

  return `${provider} request failed (${status}): ${brief}`;
}

export const defaultLlmSettings: LlmSettings = {
  endpoint: 'http://localhost:11434/v1/chat/completions',
  model: 'tinyllama',
  apiKey: import.meta.env.VITE_GOD_API_KEY ?? '',
  systemPrompt: 'You are GOD, a concise and safe assistant focused on coding and automation.'
};

function isGeminiEndpoint(endpoint: string): boolean {
  return endpoint.includes('generativelanguage.googleapis.com');
}

function isLocalOllamaEndpoint(endpoint: string): boolean {
  const value = endpoint.toLowerCase();
  return value.includes('localhost:11434') || value.includes('127.0.0.1:11434');
}

function resolveApiKey(settings: LlmSettings): string {
  const entered = settings.apiKey.trim();
  if (entered) {
    return entered;
  }

  return (import.meta.env.VITE_GOD_API_KEY ?? '').trim();
}

function validateProviderSettings(endpoint: string, apiKey: string): string | null {
  const trimmedKey = apiKey.trim();
  const gemini = isGeminiEndpoint(endpoint);

  if (isLocalOllamaEndpoint(endpoint)) {
    return null;
  }

  if (!trimmedKey) {
    return null;
  }

  if (gemini && !trimmedKey.startsWith('AIza')) {
    return 'Gemini preset expects a Google API key (usually starts with AIza).';
  }

  if (!gemini && trimmedKey.startsWith('AIza')) {
    return 'OpenAI-compatible preset cannot use a Google Gemini key. Switch preset to Gemini API or provide a compatible provider key.';
  }

  return null;
}

function withGeminiApiKey(endpoint: string, apiKey: string): string {
  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    return endpoint;
  }

  const url = new URL(endpoint);
  if (!url.searchParams.has('key')) {
    url.searchParams.set('key', trimmedApiKey);
  }
  return url.toString();
}

function withGeminiModel(endpoint: string, model: string): string {
  const trimmedModel = model.trim();
  if (!trimmedModel) {
    return endpoint;
  }

  return endpoint.replace(/\/models\/[^:/?]+(?::generateContent)?/i, `/models/${trimmedModel}:generateContent`);
}

function buildHeaders(settings: LlmSettings): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };

  const apiKey = resolveApiKey(settings);
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

export async function requestChatCompletion(messages: Message[], settings: LlmSettings): Promise<string> {
  const endpointValue = settings.endpoint.trim();
  const apiKey = resolveApiKey(settings);
  if (!endpointValue) {
    throw new Error('Connector endpoint is empty. Set a valid endpoint in Connector settings.');
  }

  const configProblem = validateProviderSettings(endpointValue, apiKey);
  if (configProblem) {
    throw new Error(configProblem);
  }

  if (isGeminiEndpoint(settings.endpoint.trim())) {
    const modelEndpoint = withGeminiModel(endpointValue, settings.model);
    const endpoint = withGeminiApiKey(modelEndpoint, apiKey);
    const payload = {
      system_instruction: {
        parts: [{ text: settings.systemPrompt.trim() }]
      },
      contents: messages
        .filter((message) => message.role !== 'system')
        .map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: message.content }]
        }))
    };

    const response = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }, 'Gemini');

    if (!response.ok) {
      const details = await response.text();
      throw new Error(formatProviderHttpError('Gemini', response.status, details));
    }

    const body = (await response.json()) as GeminiResponse;
    const content = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
    if (!content) {
      throw new Error('Gemini response did not include assistant content.');
    }

    return content;
  }

  const payload = {
    model: settings.model.trim(),
    messages: [
      {
        role: 'system',
        content: settings.systemPrompt.trim()
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content
      }))
    ],
    temperature: 0.3
  };

  const headers = buildHeaders(settings);

  const response = await safeFetch(endpointValue, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  }, 'OpenAI-compatible');

  if (!response.ok) {
    const details = await response.text();
    throw new Error(formatProviderHttpError('OpenAI-compatible', response.status, details));
  }

  const body = (await response.json()) as ChatCompletionResponse;
  const content = body.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('LLM response did not include assistant content.');
  }

  return content;
}

export async function testConnector(settings: LlmSettings): Promise<string> {
  const endpointValue = settings.endpoint.trim();
  const apiKey = resolveApiKey(settings);
  if (!endpointValue) {
    throw new Error('Connector endpoint is empty.');
  }

  const configProblem = validateProviderSettings(endpointValue, apiKey);
  if (configProblem) {
    throw new Error(configProblem);
  }

  if (isGeminiEndpoint(settings.endpoint.trim())) {
    const modelEndpoint = withGeminiModel(endpointValue, settings.model);
    const endpoint = withGeminiApiKey(modelEndpoint, apiKey);
    const payload = {
      system_instruction: {
        parts: [{ text: settings.systemPrompt.trim() }]
      },
      contents: [{ role: 'user', parts: [{ text: 'Reply with: OK' }] }],
      generationConfig: {
        maxOutputTokens: 8,
        temperature: 0
      }
    };

    const response = await safeFetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }, 'Gemini');

    if (!response.ok) {
      const details = await response.text();
      throw new Error(formatProviderHttpError('Gemini', response.status, details));
    }

    return 'Gemini connector reachable';
  }

  const payload = {
    model: settings.model.trim(),
    messages: [
      { role: 'system', content: settings.systemPrompt.trim() },
      { role: 'user', content: 'Reply with: OK' }
    ],
    temperature: 0,
    max_tokens: 8
  };

  const response = await safeFetch(endpointValue, {
    method: 'POST',
    headers: buildHeaders(settings),
    body: JSON.stringify(payload)
  }, 'OpenAI-compatible');

  if (!response.ok) {
    const details = await response.text();
    throw new Error(formatProviderHttpError('OpenAI-compatible', response.status, details));
  }

  return 'Connector reachable';
}
