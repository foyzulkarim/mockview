import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { getInterviewState } from '@/lib/services/interview-engine';
import type { ApiResponse } from '@/lib/types';

interface InterviewStateResponse {
  interviewId: number;
  status: string;
  currentQuestion?: {
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

/**
 * GET /api/interview/state?sessionUuid=xxx - Get current interview state
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<InterviewStateResponse>>> {
  try {
    const sessionUuid = request.nextUrl.searchParams.get('sessionUuid');

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

    // Get interview state
    const state = await getInterviewState(sessionUuid);

    if (!state) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_INTERVIEW',
            message: 'No interview found for this session',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: state,
    });
  } catch (error) {
    console.error('Failed to get interview state:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_STATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get interview state',
        },
      },
      { status: 500 }
    );
  }
}
