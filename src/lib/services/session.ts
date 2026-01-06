import { v4 as uuidv4 } from 'uuid';
import { Session } from '../db/models';
import { initializeModels } from '../db/models';
import { config } from '../config';
import type { SessionStatus } from '../types';

// Ensure models are initialized
let modelsInitialized = false;

async function ensureModelsInitialized(): Promise<void> {
  if (!modelsInitialized) {
    await initializeModels();
    modelsInitialized = true;
  }
}

/**
 * Create a new session with auto-expiration
 * Returns the session UUID for client storage
 */
export async function createSession(clientFingerprint?: string): Promise<{
  uuid: string;
  expiresAt: Date;
}> {
  await ensureModelsInitialized();

  const uuid = uuidv4();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + config.session.expiryHours);

  await Session.create({
    uuid,
    status: 'created',
    client_fingerprint: clientFingerprint || null,
    expires_at: expiresAt,
  });

  return { uuid, expiresAt };
}

/**
 * Validate a session UUID and return the session if valid
 * Returns null if session doesn't exist or is expired
 */
export async function validateSession(uuid: string): Promise<{
  id: number;
  uuid: string;
  status: SessionStatus;
  expiresAt: Date;
} | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({
    where: { uuid },
  });

  if (!session) {
    return null;
  }

  // Check if expired
  if (new Date() > session.expires_at) {
    // Mark as expired if not already
    if (session.status !== 'expired') {
      await session.update({ status: 'expired' });
    }
    return null;
  }

  return {
    id: session.id,
    uuid: session.uuid,
    status: session.status,
    expiresAt: session.expires_at,
  };
}

/**
 * Get a session by UUID (includes expired sessions)
 */
export async function getSession(uuid: string): Promise<{
  id: number;
  uuid: string;
  status: SessionStatus;
  expiresAt: Date;
  isExpired: boolean;
} | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({
    where: { uuid },
  });

  if (!session) {
    return null;
  }

  const isExpired = new Date() > session.expires_at;

  return {
    id: session.id,
    uuid: session.uuid,
    status: session.status,
    expiresAt: session.expires_at,
    isExpired,
  };
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  uuid: string,
  status: SessionStatus
): Promise<boolean> {
  await ensureModelsInitialized();

  const [updatedCount] = await Session.update(
    { status },
    { where: { uuid } }
  );

  return updatedCount > 0;
}

/**
 * Delete a session and all associated data (manual cleanup)
 */
export async function deleteSession(uuid: string): Promise<boolean> {
  await ensureModelsInitialized();

  const session = await Session.findOne({
    where: { uuid },
  });

  if (!session) {
    return false;
  }

  // Cascade delete will remove all associated records
  await session.destroy();
  return true;
}

/**
 * Get sessions that have expired (for cleanup job)
 */
export async function getExpiredSessions(): Promise<Array<{
  id: number;
  uuid: string;
}>> {
  await ensureModelsInitialized();

  const sessions = await Session.findAll({
    where: {
      expires_at: {
        // Using raw query for less-than comparison
        [Symbol.for('sequelize.lt')]: new Date(),
      },
    },
    attributes: ['id', 'uuid'],
  });

  return sessions.map(s => ({
    id: s.id,
    uuid: s.uuid,
  }));
}

/**
 * Extend session expiration (optional feature)
 */
export async function extendSession(uuid: string, additionalHours: number = 24): Promise<Date | null> {
  await ensureModelsInitialized();

  const session = await Session.findOne({
    where: { uuid },
  });

  if (!session) {
    return null;
  }

  const newExpiresAt = new Date();
  newExpiresAt.setHours(newExpiresAt.getHours() + additionalHours);

  await session.update({ expires_at: newExpiresAt });
  return newExpiresAt;
}
