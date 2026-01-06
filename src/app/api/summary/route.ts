import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { generateSummary, getSummary } from '@/lib/services/summary-generator';
import type { ApiResponse, InterviewSummary } from '@/lib/types';

interface SummaryResponse {
  summaryId?: number;
  summary: InterviewSummary;
}

/**
 * POST /api/summary - Generate interview summary
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SummaryResponse>>> {
  try {
    const body = await request.json();
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

    // Generate summary
    const result = await generateSummary(sessionUuid);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Summary generation failed:', error);

    const message = error instanceof Error ? error.message : 'Summary generation failed';
    const isNotComplete = message.includes('must be completed');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isNotComplete ? 'INTERVIEW_NOT_COMPLETE' : 'SUMMARY_ERROR',
          message,
        },
      },
      { status: isNotComplete ? 400 : 500 }
    );
  }
}

/**
 * GET /api/summary?sessionUuid=xxx - Get existing summary
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<{ summary: InterviewSummary }>>> {
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

    // Get summary
    const summary = await getSummary(sessionUuid);

    if (!summary) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SUMMARY_NOT_FOUND',
            message: 'No summary found. Please complete the interview and generate a summary first.',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { summary },
    });
  } catch (error) {
    console.error('Failed to get summary:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GET_SUMMARY_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get summary',
        },
      },
      { status: 500 }
    );
  }
}
