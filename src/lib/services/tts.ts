import { config } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TTSResult {
  audioBuffer: Buffer;
  format: string;
  duration?: number;
}

/**
 * Check if TTS service is healthy
 */
export async function checkTTSHealth(): Promise<boolean> {
  try {
    // Coqui TTS uses different health endpoints
    const response = await fetch(`${config.tts.host}/api/tts`, {
      method: 'OPTIONS',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok || response.status === 405; // 405 is expected for OPTIONS
  } catch {
    // Try alternative health check
    try {
      const response = await fetch(`${config.tts.host}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Synthesize speech from text using Coqui TTS
 */
export async function synthesizeSpeech(text: string): Promise<TTSResult> {
  // Use mock if AI services are mocked
  if (config.dev.mockAiServices) {
    return getMockAudio();
  }

  // Clean and prepare text
  const cleanedText = cleanTextForTTS(text);

  // Coqui TTS API endpoint
  const url = new URL('/api/tts', config.tts.host);
  url.searchParams.set('text', cleanedText);

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal: AbortSignal.timeout(config.tts.timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`TTS synthesis failed: ${response.status} ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = Buffer.from(arrayBuffer);

  return {
    audioBuffer,
    format: 'wav',
    duration: estimateDuration(text),
  };
}

/**
 * Synthesize and save audio to file
 */
export async function synthesizeToFile(
  text: string,
  sessionId: number,
  questionId: number
): Promise<string> {
  const result = await synthesizeSpeech(text);

  const filename = `question_${sessionId}_${questionId}_${Date.now()}.${result.format}`;
  const filePath = path.join(config.files.audioDir, filename);

  // Ensure directory exists
  await fs.mkdir(config.files.audioDir, { recursive: true });

  // Write file
  await fs.writeFile(filePath, result.audioBuffer);

  return filePath;
}

/**
 * Clean text for TTS processing
 */
function cleanTextForTTS(text: string): string {
  return text
    // Remove markdown formatting
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/`/g, '')
    // Convert common abbreviations
    .replace(/e\.g\./gi, 'for example')
    .replace(/i\.e\./gi, 'that is')
    .replace(/etc\./gi, 'and so on')
    // Handle ellipsis
    .replace(/\.\.\./g, '.')
    // Clean up whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Estimate audio duration from text (rough approximation)
 * Average speaking rate: ~150 words per minute
 */
function estimateDuration(text: string): number {
  const words = text.split(/\s+/).length;
  const minutes = words / 150;
  return Math.ceil(minutes * 60);
}

/**
 * Mock audio for development
 */
function getMockAudio(): TTSResult {
  // Generate a minimal valid WAV file (silence)
  const sampleRate = 22050;
  const duration = 1; // 1 second of silence
  const numSamples = sampleRate * duration;
  const byteRate = sampleRate * 2; // 16-bit audio
  const blockAlign = 2;
  const bitsPerSample = 16;
  const dataSize = numSamples * 2;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(1, 22); // num channels
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // Silence (zeros) already initialized

  return {
    audioBuffer: buffer,
    format: 'wav',
    duration: 1,
  };
}
