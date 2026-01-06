import { NextResponse } from 'next/server';
import { checkAllServices } from '@/lib/services/health';
import type { ApiResponse, SystemHealth } from '@/lib/types';

export async function GET(): Promise<NextResponse<ApiResponse<SystemHealth>>> {
  try {
    const health = await checkAllServices();

    // Set appropriate status code based on health
    const statusCode = health.overall === 'healthy' ? 200 :
                       health.overall === 'degraded' ? 207 : 503;

    return NextResponse.json(
      {
        success: true,
        data: health,
      },
      { status: statusCode }
    );
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: error instanceof Error ? error.message : 'Health check failed',
        },
      },
      { status: 500 }
    );
  }
}
