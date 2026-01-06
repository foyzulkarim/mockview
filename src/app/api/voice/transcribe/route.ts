import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { transcribeAudio, saveAudioFile } from '@/lib/services/stt';
import { Session } from '@/lib/db/models';
import { initializeModels } from '@/lib/db/models';
import type { ApiResponse } from '@/lib/types';

interface TranscribeResponse {
  text: string;
  language?: string;
  duration?: number;
  audioPath?: string;
}

let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

/**
 * POST /api/voice/transcribe - Transcribe audio to text
 * Accepts multipart/form-data with audio file
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<TranscribeResponse>>> {
  try {
    await ensureModelsInitialized();

    const formData = await request.formData();
    const sessionUuid = formData.get('sessionUuid') as string;
    const questionId = formData.get('questionId') as string;
    const audioFile = formData.get('audio') as File | null;

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

    // Validate audio file
    if (!audioFile) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_AUDIO',
            message: 'Audio file is required',
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

    // Get session record for ID
    const sessionRecord = await Session.findOne({ where: { uuid: sessionUuid } });
    if (!sessionRecord) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found',
          },
        },
        { status: 404 }
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await audioFile.arrayBuffer();
    const audioBuffer = Buffer.from(arrayBuffer);

    // Validate file size (max 10MB)
    if (audioBuffer.length > 10 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'Audio file must be less than 10MB',
          },
        },
        { status: 400 }
      );
    }

    // Save audio file if questionId provided
    let audioPath: string | undefined;
    if (questionId) {
      const ext = audioFile.name.split('.').pop() || 'webm';
      audioPath = await saveAudioFile(
        sessionRecord.id,
        parseInt(questionId, 10),
        audioBuffer,
        ext
      );
    }

    // Transcribe audio
    const result = await transcribeAudio(audioBuffer, audioFile.name);

    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        language: result.language,
        duration: result.duration,
        audioPath,
      },
    });
  } catch (error) {
    console.error('Transcription failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TRANSCRIPTION_ERROR',
          message: error instanceof Error ? error.message : 'Transcription failed',
        },
      },
      { status: 500 }
    );
  }
}
