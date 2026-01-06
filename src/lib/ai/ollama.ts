import { config } from '../config';
import type { OllamaGenerateRequest, OllamaGenerateResponse } from '../types';

/**
 * Ollama LLM Orchestrator
 * Handles all communication with the Ollama server including
 * prompt management, retry logic, and response parsing.
 */

interface GenerateOptions {
  model?: 'light' | 'heavy';
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Send a prompt to Ollama and get a response
 */
export async function generateCompletion(
  prompt: string,
  systemPrompt?: string,
  options: GenerateOptions = {}
): Promise<string> {
  const model = options.model === 'heavy'
    ? config.ollama.modelHeavy
    : config.ollama.modelLight;

  const requestBody: OllamaGenerateRequest = {
    model,
    prompt,
    system: systemPrompt,
    stream: false,
    options: {
      temperature: options.temperature ?? 0.7,
      num_predict: options.maxTokens ?? 4096,
    },
  };

  // Enable JSON mode if requested
  if (options.jsonMode) {
    requestBody.format = 'json';
  }

  let lastError: Error | null = null;

  // Retry logic
  for (let attempt = 0; attempt < config.ollama.maxRetries; attempt++) {
    try {
      const response = await fetch(`${config.ollama.host}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(config.ollama.timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`Ollama returned ${response.status}: ${response.statusText}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      return data.response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Ollama attempt ${attempt + 1} failed:`, lastError.message);

      // Wait before retrying (exponential backoff)
      if (attempt < config.ollama.maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw new Error(`Ollama failed after ${config.ollama.maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Generate completion and parse as JSON
 * Includes retry logic for JSON parsing failures
 */
export async function generateJSON<T>(
  prompt: string,
  systemPrompt?: string,
  options: Omit<GenerateOptions, 'jsonMode'> = {}
): Promise<T> {
  let lastError: Error | null = null;

  // Try up to 3 times to get valid JSON
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await generateCompletion(prompt, systemPrompt, {
        ...options,
        jsonMode: true,
      });

      // Try to parse the JSON
      const parsed = JSON.parse(response) as T;
      return parsed;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // If JSON parsing failed, try again with a clearer prompt
      if (lastError.message.includes('JSON')) {
        console.warn(`JSON parsing failed on attempt ${attempt + 1}, retrying...`);
      }
    }
  }

  throw new Error(`Failed to get valid JSON from Ollama: ${lastError?.message}`);
}

/**
 * Check if Ollama service is available
 */
export async function checkOllamaHealth(): Promise<{
  healthy: boolean;
  models: string[];
  error?: string;
}> {
  try {
    const response = await fetch(`${config.ollama.host}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return {
        healthy: false,
        models: [],
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const models = data.models?.map((m: { name: string }) => m.name) || [];

    return {
      healthy: true,
      models,
    };
  } catch (error) {
    return {
      healthy: false,
      models: [],
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check if required models are available
 */
export async function checkRequiredModels(): Promise<{
  allPresent: boolean;
  missing: string[];
  present: string[];
}> {
  const health = await checkOllamaHealth();

  if (!health.healthy) {
    return {
      allPresent: false,
      missing: [config.ollama.modelLight, config.ollama.modelHeavy],
      present: [],
    };
  }

  const requiredModels = [config.ollama.modelLight, config.ollama.modelHeavy];
  const present: string[] = [];
  const missing: string[] = [];

  for (const model of requiredModels) {
    // Check if model exists (handle version tags)
    const modelBase = model.split(':')[0];
    const hasModel = health.models.some(m =>
      m === model || m.startsWith(modelBase + ':')
    );

    if (hasModel) {
      present.push(model);
    } else {
      missing.push(model);
    }
  }

  return {
    allPresent: missing.length === 0,
    missing,
    present,
  };
}
