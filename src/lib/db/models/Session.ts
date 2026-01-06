import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { SessionStatus } from '../../types';

// Session attributes
interface SessionAttributes {
  id: number;
  uuid: string;
  status: SessionStatus;
  client_fingerprint: string | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation (optional fields)
interface SessionCreationAttributes extends Optional<SessionAttributes, 'id' | 'status' | 'client_fingerprint' | 'created_at' | 'updated_at'> {}

class Session extends Model<SessionAttributes, SessionCreationAttributes> implements SessionAttributes {
  declare id: number;
  declare uuid: string;
  declare status: SessionStatus;
  declare client_fingerprint: string | null;
  declare expires_at: Date;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations will be set up in index.ts
  declare readonly cv?: import('./CV').default;
  declare readonly job_description?: import('./JobDescription').default;
  declare readonly match_score?: import('./MatchScore').default;
  declare readonly interviews?: import('./Interview').default[];
}

export function initSession() {
  Session.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      uuid: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        unique: true,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          'created',
          'cv_uploaded',
          'jd_submitted',
          'scored',
          'interviewing',
          'completed',
          'expired'
        ),
        defaultValue: 'created',
        allowNull: false,
      },
      client_fingerprint: {
        type: DataTypes.STRING(64),
        allowNull: true,
      },
      expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize: getSequelize(),
      tableName: 'sessions',
      modelName: 'Session',
      indexes: [
        { fields: ['uuid'], unique: true },
        { fields: ['expires_at'] }, // For cleanup queries
        { fields: ['status'] },
      ],
    }
  );

  return Session;
}

export default Session;
