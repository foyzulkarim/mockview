import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { synthesizeSpeech } from '@/lib/services/tts';
import type { ApiResponse } from '@/lib/types';

/**
 * POST /api/voice/synthesize - Convert text to speech
 * Returns audio as base64 or streams it directly
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ audio: string; format: string; duration?: number }>> | NextResponse> {
  try {
    const body = await request.json();
    const { sessionUuid, text, stream } = body;

    // Validate session UUID
    if (!sessionUuid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_SESSION',
            message: 'Session UUID is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate text
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_TEXT',
            message: 'Text is required for synthesis',
          },
        },
        { status: 400 }
      );
    }

    // Limit text length
    if (text.length > 1000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'TEXT_TOO_LONG',
            message: 'Text must be less than 1000 characters',
          },
        },
        { status: 400 }
      );
    }

    // Validate session
    const session = await validateSession(sessionUuid);
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: 'Session not found or has expired',
          },
        },
        { status: 401 }
      );
    }

    // Synthesize speech
    const result = await synthesizeSpeech(text);

    // If stream mode, return audio directly
    if (stream) {
      // Convert Buffer to Uint8Array for NextResponse
      const uint8Array = new Uint8Array(result.audioBuffer);
      return new NextResponse(uint8Array, {
        status: 200,
        headers: {
          'Content-Type': `audio/${result.format}`,
          'Content-Length': result.audioBuffer.length.toString(),
        },
      });
    }

    // Return as base64 JSON response
    return NextResponse.json({
      success: true,
      data: {
        audio: result.audioBuffer.toString('base64'),
        format: result.format,
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error('Speech synthesis failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SYNTHESIS_ERROR',
          message: error instanceof Error ? error.message : 'Speech synthesis failed',
        },
      },
      { status: 500 }
    );
  }
}
