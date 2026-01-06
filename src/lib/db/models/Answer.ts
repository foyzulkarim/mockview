import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { AnswerEvaluation } from '../../types';

// Answer attributes
interface AnswerAttributes {
  id: number;
  question_id: number;
  answer_text: string | null;
  audio_path: string | null;
  transcription: string | null;
  response_time_ms: number | null;
  evaluation: AnswerEvaluation | null;
  quality_score: number | null; // 1-5 overall score
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface AnswerCreationAttributes extends Optional<AnswerAttributes, 'id' | 'answer_text' | 'audio_path' | 'transcription' | 'response_time_ms' | 'evaluation' | 'quality_score' | 'created_at' | 'updated_at'> {}

class Answer extends Model<AnswerAttributes, AnswerCreationAttributes> implements AnswerAttributes {
  declare id: number;
  declare question_id: number;
  declare answer_text: string | null;
  declare audio_path: string | null;
  declare transcription: string | null;
  declare response_time_ms: number | null;
  declare evaluation: AnswerEvaluation | null;
  declare quality_score: number | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Association
  declare readonly question?: import('./Question').default;
}

export function initAnswer() {
  Answer.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'questions',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      answer_text: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      audio_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      transcription: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      response_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      evaluation: {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      quality_score: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5,
        },
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
      tableName: 'answers',
      modelName: 'Answer',
      indexes: [
        { fields: ['question_id'] },
      ],
    }
  );

  return Answer;
}

export default Answer;
