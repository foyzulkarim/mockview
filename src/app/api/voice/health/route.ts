import { NextResponse } from 'next/server';
import { checkWhisperHealth } from '@/lib/services/stt';
import { checkTTSHealth } from '@/lib/services/tts';
import type { ApiResponse } from '@/lib/types';

interface VoiceHealthResponse {
  stt: {
    available: boolean;
    service: string;
  };
  tts: {
    available: boolean;
    service: string;
  };
  voiceEnabled: boolean;
}

/**
 * GET /api/voice/health - Check voice services health
 */
export async function GET(): Promise<NextResponse<ApiResponse<VoiceHealthResponse>>> {
  try {
    // Check both services in parallel
    const [sttHealthy, ttsHealthy] = await Promise.all([
      checkWhisperHealth(),
      checkTTSHealth(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        stt: {
          available: sttHealthy,
          service: 'faster-whisper',
        },
        tts: {
          available: ttsHealthy,
          service: 'coqui-tts',
        },
        voiceEnabled: sttHealthy && ttsHealthy,
      },
    });
  } catch (error) {
    console.error('Voice health check failed:', error);

    return NextResponse.json({
      success: true,
      data: {
        stt: {
          available: false,
          service: 'faster-whisper',
        },
        tts: {
          available: false,
          service: 'coqui-tts',
        },
        voiceEnabled: false,
      },
    });
  }
}
