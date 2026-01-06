// Environment configuration with sensible defaults
// All values can be overridden via environment variables

export const config = {
  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://mockview:mockview_dev@localhost:5432/mockview',
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    name: process.env.POSTGRES_DB || 'mockview',
    user: process.env.POSTGRES_USER || 'mockview',
    password: process.env.POSTGRES_PASSWORD || 'mockview_dev',
  },

  // Ollama (LLM)
  ollama: {
    host: process.env.OLLAMA_HOST || 'http://localhost:11434',
    modelLight: process.env.OLLAMA_MODEL_LIGHT || 'llama3.1:8b-instruct-q8_0',
    modelHeavy: process.env.OLLAMA_MODEL_HEAVY || 'llama3.1:70b-instruct-q4_K_M',
    timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS || '300000', 10),
    maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '3', 10),
  },

  // Whisper (STT)
  whisper: {
    host: process.env.WHISPER_HOST || 'http://localhost:8080',
    model: process.env.WHISPER_MODEL || 'large-v3',
    timeoutMs: parseInt(process.env.WHISPER_TIMEOUT_MS || '60000', 10),
  },

  // TTS
  tts: {
    host: process.env.TTS_HOST || 'http://localhost:8081',
    timeoutMs: parseInt(process.env.TTS_TIMEOUT_MS || '30000', 10),
    voiceId: process.env.TTS_VOICE_ID || 'default',
  },

  // Session management
  session: {
    expiryHours: parseInt(process.env.SESSION_EXPIRY_HOURS || '24', 10),
    cleanupIntervalMinutes: parseInt(process.env.CLEANUP_INTERVAL_MINUTES || '60', 10),
  },

  // File handling
  files: {
    maxCvSize: parseInt(process.env.MAX_CV_FILE_SIZE || '5242880', 10), // 5MB
    uploadsDir: process.env.UPLOADS_DIR || '/data/uploads',
    audioDir: process.env.AUDIO_DIR || '/data/audio',
  },

  // Interview settings
  interview: {
    maxFollowUpDepth: parseInt(process.env.MAX_FOLLOW_UP_DEPTH || '3', 10),
    maxQuestions: parseInt(process.env.MAX_QUESTIONS_PER_INTERVIEW || '15', 10),
    maxDurationMinutes: parseInt(process.env.MAX_INTERVIEW_DURATION_MINUTES || '45', 10),
    minMatchScore: parseInt(process.env.MIN_MATCH_SCORE_FOR_INTERVIEW || '50', 10),
  },

  // Development
  dev: {
    mockAiServices: process.env.MOCK_AI_SERVICES === 'true',
    debugMode: process.env.DEBUG_MODE === 'true',
    nodeEnv: process.env.NODE_ENV || 'development',
  },
} as const;

// Type for the config object
export type Config = typeof config;
