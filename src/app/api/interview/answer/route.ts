import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { processAnswer } from '@/lib/services/interview-engine';
import type { ApiResponse, AnswerEvaluation } from '@/lib/types';

interface AnswerResponse {
  evaluation: AnswerEvaluation;
  nextQuestion?: {
    id: number;
    text: string;
    competency: string;
    isFollowUp: boolean;
    depth: number;
  };
  progress: {
    current: number;
    estimated_total: number;
    competency: string;
  };
  isComplete: boolean;
}

interface AnswerRequest {
  sessionUuid: string;
  questionId: number;
  answerText: string;
  responseTimeMs?: number;
}

/**
 * POST /api/interview/answer - Submit an answer to a question
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<AnswerResponse>>> {
  try {
    const body: AnswerRequest = await request.json();
    const { sessionUuid, questionId, answerText, responseTimeMs } = body;

    // Validate required fields
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

    if (!questionId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_QUESTION_ID',
            message: 'Question ID is required',
          },
        },
        { status: 400 }
      );
    }

    if (!answerText || answerText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_ANSWER',
            message: 'Answer text is required',
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

    // Process the answer
    const result = await processAnswer(sessionUuid, questionId, answerText.trim(), responseTimeMs);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Failed to process answer:', error);

    const message = error instanceof Error ? error.message : 'Failed to process answer';
    const isNotFound = message.includes('not found');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isNotFound ? 'NOT_FOUND' : 'PROCESS_ANSWER_ERROR',
          message,
        },
      },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
