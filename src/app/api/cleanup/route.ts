import { NextRequest, NextResponse } from 'next/server';
import { runFullCleanup, getCleanupStats } from '@/lib/services/cleanup';
import type { ApiResponse } from '@/lib/types';

interface CleanupResponse {
  expiredSessions: number;
  deletedFiles: {
    uploads: number;
    audio: number;
  };
  errors: string[];
  duration_ms: number;
}

interface CleanupStatsResponse {
  expiredSessions: number;
  totalSessions: number;
  oldestSession?: string;
}

/**
 * POST /api/cleanup - Run cleanup of expired sessions and orphaned files
 * This endpoint should be called by a scheduled task (cron job)
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CleanupResponse>>> {
  try {
    // Optional: Add API key validation for security
    const apiKey = request.headers.get('x-cleanup-key');
    const expectedKey = process.env.CLEANUP_API_KEY;

    // Only require key in production
    if (process.env.NODE_ENV === 'production' && expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid cleanup API key',
          },
        },
        { status: 401 }
      );
    }

    console.log('Running scheduled cleanup...');
    const result = await runFullCleanup();

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Cleanup failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: error instanceof Error ? error.message : 'Cleanup failed',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cleanup - Get cleanup statistics
 */
export async function GET(): Promise<NextResponse<ApiResponse<CleanupStatsResponse>>> {
  try {
    const stats = await getCleanupStats();

    return NextResponse.json({
      success: true,
      data: {
        expiredSessions: stats.expiredSessions,
        totalSessions: stats.totalSessions,
        oldestSession: stats.oldestSession?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get cleanup stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to get stats',
        },
      },
      { status: 500 }
    );
  }
}
