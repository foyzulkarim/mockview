import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { InterviewSummary } from '../../types';

// Overall rating type
type OverallRating = 'excellent' | 'good' | 'satisfactory' | 'needs_improvement';

// Summary attributes
interface SummaryAttributes {
  id: number;
  interview_id: number;
  summary_data: InterviewSummary;
  overall_rating: OverallRating;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface SummaryCreationAttributes extends Optional<SummaryAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Summary extends Model<SummaryAttributes, SummaryCreationAttributes> implements SummaryAttributes {
  declare id: number;
  declare interview_id: number;
  declare summary_data: InterviewSummary;
  declare overall_rating: OverallRating;
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
      summary_data: {
        type: DataTypes.JSONB,
        allowNull: false,
      },
      overall_rating: {
        type: DataTypes.ENUM('excellent', 'good', 'satisfactory', 'needs_improvement'),
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
        { fields: ['overall_rating'] },
      ],
    }
  );

  return Summary;
}

export default Summary;
