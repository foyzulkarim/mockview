import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/services/session';
import { processCV } from '@/lib/services/cv-parser';
import { config } from '@/lib/config';
import type { ApiResponse, ParsedCVData } from '@/lib/types';

interface CVUploadResponse {
  cvId: number;
  parsedData: ParsedCVData;
}

/**
 * POST /api/cv/upload - Upload and parse a CV
 *
 * Accepts multipart form data with:
 * - file: CV file (PDF or TXT)
 * - sessionUuid: Session identifier
 */
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<CVUploadResponse>>> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const sessionUuid = formData.get('sessionUuid') as string | null;

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

    // Validate file presence
    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'MISSING_FILE',
            message: 'CV file is required',
          },
        },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isPDF = fileName.endsWith('.pdf') || file.type === 'application/pdf';
    const isTXT = fileName.endsWith('.txt') || file.type === 'text/plain';

    if (!isPDF && !isTXT) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_FILE_TYPE',
            message: 'Only PDF and TXT files are accepted',
          },
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > config.files.maxCvSize) {
      const maxSizeMB = config.files.maxCvSize / (1024 * 1024);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `File size exceeds maximum of ${maxSizeMB}MB`,
          },
        },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Process CV
    const result = await processCV(
      sessionUuid,
      buffer,
      file.name,
      isPDF ? 'pdf' : 'txt'
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('CV upload failed:', error);

    // Handle specific error types
    const message = error instanceof Error ? error.message : 'CV upload failed';
    const isValidationError = message.includes('empty') || message.includes('short');

    return NextResponse.json(
      {
        success: false,
        error: {
          code: isValidationError ? 'CV_VALIDATION_ERROR' : 'CV_UPLOAD_ERROR',
          message,
        },
      },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
