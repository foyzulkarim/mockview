import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { MatchBreakdown } from '../../types';

// MatchScore attributes
interface MatchScoreAttributes {
  id: number;
  session_id: number;
  overall_score: number;
  breakdown: MatchBreakdown;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface MatchScoreCreationAttributes extends Optional<MatchScoreAttributes, 'id' | 'created_at' | 'updated_at'> {}

class MatchScore extends Model<MatchScoreAttributes, MatchScoreCreationAttributes> implements MatchScoreAttributes {
  declare id: number;
  declare session_id: number;
  declare overall_score: number;
  declare breakdown: MatchBreakdown;
  declare created_at: Date;
  declare updated_at: Date;

  // Association
  declare readonly session?: import('./Session').default;
}

export function initMatchScore() {
  MatchScore.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'sessions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      overall_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: 0,
          max: 100,
        },
      },
      breakdown: {
        type: DataTypes.JSONB,
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
      tableName: 'match_scores',
      modelName: 'MatchScore',
      indexes: [
        { fields: ['session_id'] },
      ],
    }
  );

  return MatchScore;
}

export default MatchScore;
