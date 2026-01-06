import { config } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';

interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

/**
 * Check if Whisper service is healthy
 */
export async function checkWhisperHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${config.whisper.host}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Transcribe audio file using Whisper
 */
export async function transcribeAudio(audioBuffer: Buffer, filename: string): Promise<TranscriptionResult> {
  // Use mock if AI services are mocked
  if (config.dev.mockAiServices) {
    return getMockTranscription();
  }

  const formData = new FormData();
  // Convert Buffer to Uint8Array for Blob
  const uint8Array = new Uint8Array(audioBuffer);
  const blob = new Blob([uint8Array], { type: getAudioMimeType(filename) });
  formData.append('file', blob, filename);

  // faster-whisper-server API endpoint
  const response = await fetch(`${config.whisper.host}/v1/audio/transcriptions`, {
    method: 'POST',
    body: formData,
    signal: AbortSignal.timeout(config.whisper.timeoutMs),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper transcription failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();

  return {
    text: result.text || '',
    language: result.language,
    duration: result.duration,
  };
}

/**
 * Transcribe audio from a file path
 */
export async function transcribeAudioFile(filePath: string): Promise<TranscriptionResult> {
  const buffer = await fs.readFile(filePath);
  const filename = path.basename(filePath);
  return transcribeAudio(buffer, filename);
}

/**
 * Save audio buffer to file and return path
 */
export async function saveAudioFile(
  sessionId: number,
  questionId: number,
  audioBuffer: Buffer,
  format: string = 'webm'
): Promise<string> {
  const filename = `answer_${sessionId}_${questionId}_${Date.now()}.${format}`;
  const filePath = path.join(config.files.audioDir, filename);

  // Ensure directory exists
  await fs.mkdir(config.files.audioDir, { recursive: true });

  // Write file
  await fs.writeFile(filePath, audioBuffer);

  return filePath;
}

/**
 * Get MIME type for audio file
 */
function getAudioMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.webm': 'audio/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
  };
  return mimeTypes[ext] || 'audio/webm';
}

/**
 * Mock transcription for development
 */
function getMockTranscription(): TranscriptionResult {
  const mockResponses = [
    "In my previous role, I worked extensively with React and TypeScript to build scalable web applications. One notable project was a real-time dashboard that processed thousands of data points per second.",
    "I've led a team of five developers where we implemented a microservices architecture using Node.js and Docker. The main challenge was ensuring consistent communication between services.",
    "My approach to problem-solving starts with understanding the requirements deeply, then breaking down the problem into smaller components. I usually prototype first before committing to a full implementation.",
    "I handled a situation where our production system went down by quickly identifying the root cause through log analysis, then implementing a fix while keeping stakeholders informed throughout the process.",
  ];

  return {
    text: mockResponses[Math.floor(Math.random() * mockResponses.length)],
    language: 'en',
    duration: 15.5,
  };
}
