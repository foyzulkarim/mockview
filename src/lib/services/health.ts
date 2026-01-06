import { config } from '../config';
import { testConnection } from '../db/connection';
import type { ServiceHealth, SystemHealth } from '../types';

// Health check for PostgreSQL database
async function checkDatabase(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const healthy = await testConnection();
    return {
      name: 'PostgreSQL',
      status: healthy ? 'healthy' : 'unhealthy',
      latency_ms: Date.now() - startTime,
      details: {
        host: config.database.host,
        port: config.database.port,
        database: config.database.name,
      },
    };
  } catch (error) {
    return {
      name: 'PostgreSQL',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Health check for Ollama LLM service
async function checkOllama(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${config.ollama.host}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        name: 'Ollama',
        status: 'healthy',
        latency_ms: Date.now() - startTime,
        details: {
          host: config.ollama.host,
          models: data.models?.map((m: { name: string }) => m.name) || [],
        },
      };
    }

    return {
      name: 'Ollama',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    return {
      name: 'Ollama',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Health check for Whisper STT service
async function checkWhisper(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    // faster-whisper-server has a /health endpoint
    const response = await fetch(`${config.whisper.host}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        name: 'Whisper (STT)',
        status: 'healthy',
        latency_ms: Date.now() - startTime,
        details: {
          host: config.whisper.host,
          model: config.whisper.model,
        },
      };
    }

    return {
      name: 'Whisper (STT)',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    return {
      name: 'Whisper (STT)',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Health check for TTS service
async function checkTTS(): Promise<ServiceHealth> {
  const startTime = Date.now();
  try {
    // Coqui TTS server has various endpoints, try a simple GET
    const response = await fetch(`${config.tts.host}/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok || response.status === 200) {
      return {
        name: 'TTS',
        status: 'healthy',
        latency_ms: Date.now() - startTime,
        details: {
          host: config.tts.host,
          voiceId: config.tts.voiceId,
        },
      };
    }

    return {
      name: 'TTS',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: `HTTP ${response.status}: ${response.statusText}`,
    };
  } catch (error) {
    return {
      name: 'TTS',
      status: 'unhealthy',
      latency_ms: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

// Aggregate health check for all services
export async function checkAllServices(): Promise<SystemHealth> {
  // Run all health checks in parallel
  const [database, ollama, whisper, tts] = await Promise.all([
    checkDatabase(),
    checkOllama(),
    checkWhisper(),
    checkTTS(),
  ]);

  const services = [database, ollama, whisper, tts];

  // Determine overall status
  const unhealthyCount = services.filter(s => s.status === 'unhealthy').length;
  let overall: SystemHealth['overall'];

  if (unhealthyCount === 0) {
    overall = 'healthy';
  } else if (unhealthyCount < services.length) {
    overall = 'degraded';
  } else {
    overall = 'unhealthy';
  }

  return {
    overall,
    services,
    timestamp: new Date().toISOString(),
  };
}

// Export individual health checks for granular access
export {
  checkDatabase,
  checkOllama,
  checkWhisper,
  checkTTS,
};
