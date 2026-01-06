import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { processJD } from '@/lib/services/jd-parser';
import type { ApiResponse, ParsedJDData } from '@/lib/types';

interface JDSubmitResponse {
  jdId: number;
  parsedData: ParsedJDData;
}

interface JDSubmitRequest {
  sessionUuid: string;
  jobDescription: string;
}

/**
 * POST /api/jd/submit - Submit and parse a job description
 *
 * Accepts JSON body with:
 * - sessionUuid: Session identifier
 * - jobDescription: Job description text
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<JDSubmitResponse>>> {
  try {
    const body: JDSubmitRequest = await request.json();
    const { sessionUuid, jobDescription } = body;

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

    // Validate job description
    if (!jobDescription || typeof jobDescription !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_JD',
            message: 'Job description is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate minimum length
    if (jobDescription.trim().length < 50) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'JD_TOO_SHORT',
            message: 'Job description is too short. Please provide more detail.',
          },
        },
        { status: 400 }
      );
    }

    // Process job description
    const result = await processJD(sessionUuid, jobDescription);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('JD submit failed:', error);

    // Handle specific error types
    const message = error instanceof Error ? error.message : 'Job description submission failed';
    const isValidationError = message.includes('empty') || message.includes('short');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isValidationError ? 'JD_VALIDATION_ERROR' : 'JD_SUBMIT_ERROR',
          message,
        },
      },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
