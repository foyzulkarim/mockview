import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { ParsedJDData } from '../../types';

// JobDescription attributes
interface JobDescriptionAttributes {
  id: number;
  session_id: number;
  raw_text: string;
  parsed_data: ParsedJDData | null;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface JobDescriptionCreationAttributes extends Optional<JobDescriptionAttributes, 'id' | 'parsed_data' | 'created_at' | 'updated_at'> {}

class JobDescription extends Model<JobDescriptionAttributes, JobDescriptionCreationAttributes> implements JobDescriptionAttributes {
  declare id: number;
  declare session_id: number;
  declare raw_text: string;
  declare parsed_data: ParsedJDData | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Association
  declare readonly session?: import('./Session').default;
}

export function initJobDescription() {
  JobDescription.init(
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
      raw_text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      parsed_data: {
        type: DataTypes.JSONB,
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
      tableName: 'job_descriptions',
      modelName: 'JobDescription',
      indexes: [
        { fields: ['session_id'] },
      ],
    }
  );

  return JobDescription;
}

export default JobDescription;
