import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { Interview, Session } from '@/lib/db/models';
import { initializeModels } from '@/lib/db/models';
import { updateSessionStatus } from '@/lib/services/session';
import type { ApiResponse, InterviewState, QuestionPlan } from '@/lib/types';

interface FinishInterviewResponse {
  interviewId: number;
  status: string;
  duration_minutes: number;
  total_questions: number;
  message: string;
}

interface FinishInterviewRequest {
  sessionUuid: string;
}

let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

/**
 * POST /api/interview/finish - Finish the interview early or confirm completion
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<FinishInterviewResponse>>> {
  try {
    await ensureModelsInitialized();

    const body: FinishInterviewRequest = await request.json();
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

    // Get the session record
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

    // Get the interview
    const interview = await Interview.findOne({
      where: { session_id: sessionRecord.id },
      order: [['created_at', 'DESC']],
    });

    if (!interview) {
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

    // Calculate duration
    const startedAt = interview.started_at ? new Date(interview.started_at) : new Date(interview.created_at);
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();
    const durationMinutes = Math.round(durationMs / 1000 / 60);

    // Get total questions from state
    const state = interview.interview_state as InterviewState;
    const plan = interview.question_plan as QuestionPlan;

    // Update interview status if not already completed
    if (interview.status !== 'completed') {
      await interview.update({
        status: 'completed',
        completed_at: completedAt,
      });

      await updateSessionStatus(sessionUuid, 'completed');
    }

    return NextResponse.json({
      success: true,
      data: {
        interviewId: interview.id,
        status: 'completed',
        duration_minutes: durationMinutes,
        total_questions: state.total_questions || plan.total_planned_questions,
        message: 'Interview completed successfully. Summary generation available.',
      },
    });
  } catch (error) {
    console.error('Failed to finish interview:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'FINISH_INTERVIEW_ERROR',
          message: error instanceof Error ? error.message : 'Failed to finish interview',
        },
      },
      { status: 500 }
    );
  }
}
