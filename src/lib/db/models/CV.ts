import { DataTypes, Model, Optional } from 'sequelize';
import { getSequelize } from '../connection';
import type { ParsedCVData } from '../../types';

// CV attributes
interface CVAttributes {
  id: number;
  session_id: number;
  file_path: string | null;
  raw_text: string;
  parsed_data: ParsedCVData | null;
  created_at: Date;
  updated_at: Date;
}

// Attributes for creation
interface CVCreationAttributes extends Optional<CVAttributes, 'id' | 'file_path' | 'parsed_data' | 'created_at' | 'updated_at'> {}

class CV extends Model<CVAttributes, CVCreationAttributes> implements CVAttributes {
  declare id: number;
  declare session_id: number;
  declare file_path: string | null;
  declare raw_text: string;
  declare parsed_data: ParsedCVData | null;
  declare created_at: Date;
  declare updated_at: Date;

  // Association
  declare readonly session?: import('./Session').default;
}

export function initCV() {
  CV.init(
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
      file_path: {
        type: DataTypes.STRING(500),
        allowNull: true,
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
      tableName: 'cvs',
      modelName: 'CV',
      indexes: [
        { fields: ['session_id'] },
      ],
    }
  );

  return CV;
}

export default CV;
