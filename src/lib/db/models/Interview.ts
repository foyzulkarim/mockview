import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { InterviewStatus, QuestionPlan, InterviewState } from '../../types';

// Interview attributes
interface InterviewAttributes {
  id: number;
  session_id: number;
  status: InterviewStatus;
  question_plan: QuestionPlan | null;
  interview_state: InterviewState | null;
  started_at: Date | null;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface InterviewCreationAttributes extends Optional<InterviewAttributes, 'id' | 'status' | 'question_plan' | 'interview_state' | 'started_at' | 'completed_at' | 'created_at' | 'updated_at'> {}

class Interview extends Model<InterviewAttributes, InterviewCreationAttributes> implements InterviewAttributes {
  declare id: number;
  declare session_id: number;
  declare status: InterviewStatus;
  declare question_plan: QuestionPlan | null;
  declare interview_state: InterviewState | null;
  declare started_at: Date | null;
  declare completed_at: Date | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Associations
  declare readonly session?: import('./Session').default;
  declare readonly questions?: import('./Question').default[];
  declare readonly summary?: import('./Summary').default;
}

export function initInterview() {
  Interview.init(
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
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
      },
      question_plan: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      interview_state: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      started_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      completed_at: {
        type: DataTypes.DATE,
        allowNull: true,
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
      tableName: 'interviews',
      modelName: 'Interview',
      indexes: [
        { fields: ['session_id'] },
        { fields: ['status'] },
      ],
    }
  );

  return Interview;
}

export default Interview;
