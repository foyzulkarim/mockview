import { Op } from 'sequelize';
import {
  Session,
  CV,
  JobDescription,
  MatchScore,
  Interview,
  Question,
  Answer,
  Summary,
} from '../db/models';
import { initializeModels } from '../db/models';
import { config } from '../config';
import * as fs from 'fs/promises';
import * as path from 'path';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

interface CleanupResult {
  expiredSessions: number;
  deletedFiles: {
    uploads: number;
    audio: number;
  };
  errors: string[];
  duration_ms: number;
}

/**
 * Clean up expired sessions and their related data
 * Due to CASCADE delete, deleting a session will delete all related records
 */
export async function cleanupExpiredSessions(): Promise<{
  deletedCount: number;
  errors: string[];
}> {
  await ensureModelsInitialized();

  const errors: string[] = [];
  let deletedCount = 0;

  try {
    // Find expired sessions
    const expiredSessions = await Session.findAll({
      where: {
        expires_at: {
          [Op.lt]: new Date(),
        },
      },
    });

    console.log(`Found ${expiredSessions.length} expired sessions to clean up`);

    // Collect file paths before deletion
    const filesToDelete: string[] = [];

    for (const session of expiredSessions) {
      try {
        // Get CV file paths
        const cv = await CV.findOne({ where: { session_id: session.id } });
        if (cv?.file_path) {
          filesToDelete.push(cv.file_path);
        }

        // Get audio file paths from answers
        const interview = await Interview.findOne({ where: { session_id: session.id } });
        if (interview) {
          const questions = await Question.findAll({ where: { interview_id: interview.id } });
          for (const question of questions) {
            const answer = await Answer.findOne({ where: { question_id: question.id } });
            // Audio paths would be stored in metadata if we tracked them
          }
        }

        // Delete the session (cascades to all related records)
        await session.destroy();
        deletedCount++;

        // Delete associated files
        for (const filePath of filesToDelete) {
          try {
            await fs.unlink(filePath);
          } catch (err) {
            // File might already be deleted or not exist
            if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
              errors.push(`Failed to delete file ${filePath}: ${(err as Error).message}`);
            }
          }
        }
      } catch (err) {
        errors.push(`Failed to clean up session ${session.uuid}: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Session cleanup failed: ${(err as Error).message}`);
  }

  return { deletedCount, errors };
}

/**
 * Clean up orphaned files that don't have corresponding database records
 */
export async function cleanupOrphanedFiles(): Promise<{
  deletedUploads: number;
  deletedAudio: number;
  errors: string[];
}> {
  await ensureModelsInitialized();

  const errors: string[] = [];
  let deletedUploads = 0;
  let deletedAudio = 0;

  // Get all valid file paths from database
  const validFilePaths = new Set<string>();

  try {
    const cvs = await CV.findAll({ attributes: ['file_path'] });
    cvs.forEach((cv) => {
      if (cv.file_path) {
        validFilePaths.add(cv.file_path);
      }
    });
  } catch (err) {
    errors.push(`Failed to get CV paths: ${(err as Error).message}`);
  }

  // Clean uploads directory
  try {
    const uploadsDir = config.files.uploadsDir;
    await fs.mkdir(uploadsDir, { recursive: true });

    const uploadFiles = await fs.readdir(uploadsDir);
    for (const file of uploadFiles) {
      const filePath = path.join(uploadsDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile() && !validFilePaths.has(filePath)) {
        // Check if file is old enough (at least 1 hour old)
        const fileAge = Date.now() - stat.mtime.getTime();
        const oneHourMs = 60 * 60 * 1000;

        if (fileAge > oneHourMs) {
          try {
            await fs.unlink(filePath);
            deletedUploads++;
          } catch (err) {
            errors.push(`Failed to delete upload ${file}: ${(err as Error).message}`);
          }
        }
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      errors.push(`Upload cleanup failed: ${(err as Error).message}`);
    }
  }

  // Clean audio directory
  try {
    const audioDir = config.files.audioDir;
    await fs.mkdir(audioDir, { recursive: true });

    const audioFiles = await fs.readdir(audioDir);
    for (const file of audioFiles) {
      const filePath = path.join(audioDir, file);
      const stat = await fs.stat(filePath);

      if (stat.isFile()) {
        // Check if file is old enough (at least 1 hour old)
        const fileAge = Date.now() - stat.mtime.getTime();
        const oneHourMs = 60 * 60 * 1000;

        if (fileAge > oneHourMs) {
          // Extract session ID from filename pattern: answer_sessionId_questionId_timestamp.ext
          // or question_sessionId_questionId_timestamp.ext
          const match = file.match(/^(?:answer|question)_(\d+)_/);
          if (match) {
            const sessionId = parseInt(match[1], 10);
            const session = await Session.findByPk(sessionId);

            if (!session) {
              // Session doesn't exist, delete the file
              try {
                await fs.unlink(filePath);
                deletedAudio++;
              } catch (err) {
                errors.push(`Failed to delete audio ${file}: ${(err as Error).message}`);
              }
            }
          } else {
            // Unknown file format, delete if old enough
            try {
              await fs.unlink(filePath);
              deletedAudio++;
            } catch (err) {
              errors.push(`Failed to delete audio ${file}: ${(err as Error).message}`);
            }
          }
        }
      }
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      errors.push(`Audio cleanup failed: ${(err as Error).message}`);
    }
  }

  return { deletedUploads, deletedAudio, errors };
}

/**
 * Run full cleanup (sessions + orphaned files)
 */
export async function runFullCleanup(): Promise<CleanupResult> {
  const startTime = Date.now();
  const allErrors: string[] = [];

  console.log('Starting full cleanup...');

  // Clean up expired sessions
  const sessionResult = await cleanupExpiredSessions();
  allErrors.push(...sessionResult.errors);

  // Clean up orphaned files
  const fileResult = await cleanupOrphanedFiles();
  allErrors.push(...fileResult.errors);

  const result: CleanupResult = {
    expiredSessions: sessionResult.deletedCount,
    deletedFiles: {
      uploads: fileResult.deletedUploads,
      audio: fileResult.deletedAudio,
    },
    errors: allErrors,
    duration_ms: Date.now() - startTime,
  };

  console.log(`Cleanup complete:`, result);

  return result;
}

/**
 * Get cleanup statistics without performing cleanup
 */
export async function getCleanupStats(): Promise<{
  expiredSessions: number;
  totalSessions: number;
  oldestSession?: Date;
}> {
  await ensureModelsInitialized();

  const [expiredCount, totalCount, oldestSession] = await Promise.all([
    Session.count({
      where: {
        expires_at: {
          [Op.lt]: new Date(),
        },
      },
    }),
    Session.count(),
    Session.findOne({
      order: [['created_at', 'ASC']],
      attributes: ['created_at'],
    }),
  ]);

  return {
    expiredSessions: expiredCount,
    totalSessions: totalCount,
    oldestSession: oldestSession?.created_at,
  };
}
