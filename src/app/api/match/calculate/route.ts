import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { processMatchCalculation, getMatchScore } from '@/lib/services/match-scorer';
import type { ApiResponse, MatchBreakdown } from '@/lib/types';

interface MatchCalculateResponse {
  matchScoreId: number;
  overallScore: number;
  breakdown: MatchBreakdown;
  canStartInterview: boolean;
}

interface MatchCalculateRequest {
  sessionUuid: string;
}

/**
 * POST /api/match/calculate - Calculate compatibility score
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<MatchCalculateResponse>>> {
  try {
    const body: MatchCalculateRequest = await request.json();
    const { sessionUuid } = body;

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

    // Calculate match score
    const result = await processMatchCalculation(sessionUuid);

    // Get canStartInterview flag
    const scoreData = await getMatchScore(sessionUuid);

    return NextResponse.json({
      success: true,
      data: {
        matchScoreId: result.matchScoreId,
        overallScore: result.overallScore,
        breakdown: result.breakdown,
        canStartInterview: scoreData?.canStartInterview ?? false,
      },
    });
  } catch (error) {
    console.error('Match calculation failed:', error);

    const message = error instanceof Error ? error.message : 'Match calculation failed';
    const isMissingData = message.includes('not found') || message.includes('not parsed');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isMissingData ? 'MISSING_DATA' : 'MATCH_CALCULATION_ERROR',
          message,
        },
      },
      { status: isMissingData ? 400 : 500 }
    );
  }
}

/**
 * GET /api/match/calculate?sessionUuid=xxx - Get existing match score
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<Omit<MatchCalculateResponse, 'matchScoreId'>>>> {
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

    // Get match score
    const scoreData = await getMatchScore(sessionUuid);

    if (!scoreData) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SCORE_NOT_FOUND',
            message: 'Match score not calculated yet. Please upload CV and JD first.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: scoreData,
    });
  } catch (error) {
    console.error('Failed to get match score:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_SCORE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get match score',
        },
      },
      { status: 500 }
    );
  }
}
