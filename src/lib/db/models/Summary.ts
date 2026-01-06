import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { Verdict, CompetencyScore } from '../../types';

// Summary attributes
interface SummaryAttributes {
  id: number;
  interview_id: number;
  overall_score: number;
  competency_scores: CompetencyScore[];
  strengths: string[];
  improvements: string[];
  recommendations: string[];
  verdict: Verdict;
  verdict_reasoning: string;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface SummaryCreationAttributes extends Optional<SummaryAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Summary extends Model<SummaryAttributes, SummaryCreationAttributes> implements SummaryAttributes {
  declare id: number;
  declare interview_id: number;
  declare overall_score: number;
  declare competency_scores: CompetencyScore[];
  declare strengths: string[];
  declare improvements: string[];
  declare recommendations: string[];
  declare verdict: Verdict;
  declare verdict_reasoning: string;
  declare created_at: Date;
  declare updated_at: Date;

  // Association
  declare readonly interview?: import('./Interview').default;
}

export function initSummary() {
  Summary.init(
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      interview_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'interviews',
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
      competency_scores: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      strengths: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      improvements: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      recommendations: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      verdict: {
        type: DataTypes.ENUM('ready', 'needs_preparation', 'not_ready'),
        allowNull: false,
      },
      verdict_reasoning: {
        type: DataTypes.TEXT,
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
      tableName: 'summaries',
      modelName: 'Summary',
      indexes: [
        { fields: ['interview_id'] },
      ],
    }
  );

  return Summary;
}

export default Summary;
