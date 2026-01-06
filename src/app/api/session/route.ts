import { NextRequest, NextResponse } from 'next/server';
import { createSession, validateSession, deleteSession } from '@/lib/services/session';
import type { ApiResponse } from '@/lib/types';

interface SessionData {
  uuid: string;
  expiresAt: string;
}

/**
 * POST /api/session - Create a new session
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<SessionData>>> {
  try {
    // Optional: extract client fingerprint from headers or body
    let clientFingerprint: string | undefined;
    try {
      const body = await request.json();
      clientFingerprint = body.fingerprint;
    } catch {
      // No body provided, that's fine
    }

    const session = await createSession(clientFingerprint);

    return NextResponse.json({
      success: true,
      data: {
        uuid: session.uuid,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to create session:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_CREATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to create session',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/session?uuid=xxx - Validate/get session status
 */
export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<SessionData & { status: string; isValid: boolean }>>> {
  try {
    const uuid = request.nextUrl.searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_UUID',
            message: 'Session UUID is required',
          },
        },
        { status: 400 }
      );
    }

    const session = await validateSession(uuid);

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found or has expired',
          },
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        uuid: session.uuid,
        status: session.status,
        expiresAt: session.expiresAt.toISOString(),
        isValid: true,
      },
    });
  } catch (error) {
    console.error('Failed to validate session:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_VALIDATE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to validate session',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/session?uuid=xxx - Delete a session (manual cleanup)
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const uuid = request.nextUrl.searchParams.get('uuid');

    if (!uuid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_UUID',
            message: 'Session UUID is required',
          },
        },
        { status: 400 }
      );
    }

    const deleted = await deleteSession(uuid);

    if (!deleted) {
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

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Failed to delete session:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SESSION_DELETE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to delete session',
        },
      },
      { status: 500 }
    );
  }
}
