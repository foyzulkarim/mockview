import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { startInterview } from '@/lib/services/interview-engine';
import type { ApiResponse } from '@/lib/types';

interface StartInterviewResponse {
  interviewId: number;
  question: {
    id: number;
    text: string;
    competency: string;
  };
  progress: {
    current: number;
    estimated_total: number;
    competency: string;
  };
}

interface StartInterviewRequest {
  sessionUuid: string;
}

/**
 * POST /api/interview/start - Start a new interview session
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<StartInterviewResponse>>> {
  try {
    const body: StartInterviewRequest = await request.json();
    const { sessionUuid } = body;

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

    // Start the interview
    const result = await startInterview(sessionUuid);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to start interview:', error);

    const message = error instanceof Error ? error.message : 'Failed to start interview';
    const isMissingData = message.includes('not found') || message.includes('must be parsed');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isMissingData ? 'MISSING_DATA' : 'START_INTERVIEW_ERROR',
          message,
        },
      },
      { status: isMissingData ? 400 : 500 }
    );
  }
}
