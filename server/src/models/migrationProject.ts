import { randomUUID } from 'crypto';
import { dbService } from '../database/connection';

export interface MigrationProject {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'archived' | 'failed';
  source_system: string;
  target_system: string;
  
  // Databricks integration
  databricks_workspace_url?: string;
  databricks_catalog_name?: string;
  databricks_schema_name?: string;
  lakebase_project_id?: string;
  
  // Project metadata
  total_workflows: number;
  converted_workflows: number;
  failed_conversions: number;
  conversion_progress: string; // PostgreSQL DECIMAL returned as string
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  
  // User tracking
  created_by?: string;
  
  // Project settings
  settings: any;
}

export interface CreateMigrationProjectRequest {
  name: string;
  description?: string;
  databricks_workspace_url?: string;
  databricks_catalog_name?: string;
  databricks_schema_name?: string;
  created_by?: string;
  settings?: any;
}

export interface UpdateMigrationProjectRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'completed' | 'archived' | 'failed';
  databricks_workspace_url?: string;
  databricks_catalog_name?: string;
  databricks_schema_name?: string;
  lakebase_project_id?: string;
  settings?: any;
}

/**
 * Migration Project Model
 * Handles CRUD operations for migration projects
 */
export class MigrationProjectModel {
  /**
   * Create a new migration project
   */
  static async create(projectData: CreateMigrationProjectRequest): Promise<MigrationProject> {
    const id = randomUUID();
    const now = new Date();
    
    const query = `
      INSERT INTO migration_projects (
        id, name, description, status, source_system, target_system,
        databricks_workspace_url, databricks_catalog_name, databricks_schema_name,
        created_by, settings, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      id,
      projectData.name,
      projectData.description || null,
      'active',
      'pentaho',
      'pyspark',
      projectData.databricks_workspace_url || null,
      projectData.databricks_catalog_name || null,
      projectData.databricks_schema_name || null,
      projectData.created_by || null,
      JSON.stringify(projectData.settings || {}),
      now,
      now
    ];

    const result = await dbService.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all migration projects
   */
  static async findAll(limit: number = 50, offset: number = 0): Promise<{projects: MigrationProject[], total: number}> {
    // Get total count
    const countResult = await dbService.query('SELECT COUNT(*) as count FROM migration_projects');
    const total = parseInt(countResult.rows[0].count);

    // Get projects
    const query = `
      SELECT * FROM migration_projects 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    const result = await dbService.query(query, [limit, offset]);
    
    return {
      projects: result.rows,
      total
    };
  }

  /**
   * Get a migration project by ID
   */
  static async findById(id: string): Promise<MigrationProject | null> {
    const query = 'SELECT * FROM migration_projects WHERE id = $1';
    const result = await dbService.query(query, [id]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update a migration project
   */
  static async update(id: string, updateData: UpdateMigrationProjectRequest): Promise<MigrationProject | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic SET clause
    if (updateData.name !== undefined) {
      setClause.push(`name = $${paramIndex++}`);
      values.push(updateData.name);
    }
    if (updateData.description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      values.push(updateData.description);
    }
    if (updateData.status !== undefined) {
      setClause.push(`status = $${paramIndex++}`);
      values.push(updateData.status);
    }
    if (updateData.databricks_workspace_url !== undefined) {
      setClause.push(`databricks_workspace_url = $${paramIndex++}`);
      values.push(updateData.databricks_workspace_url);
    }
    if (updateData.databricks_catalog_name !== undefined) {
      setClause.push(`databricks_catalog_name = $${paramIndex++}`);
      values.push(updateData.databricks_catalog_name);
    }
    if (updateData.databricks_schema_name !== undefined) {
      setClause.push(`databricks_schema_name = $${paramIndex++}`);
      values.push(updateData.databricks_schema_name);
    }
    if (updateData.lakebase_project_id !== undefined) {
      setClause.push(`lakebase_project_id = $${paramIndex++}`);
      values.push(updateData.lakebase_project_id);
    }
    if (updateData.settings !== undefined) {
      setClause.push(`settings = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.settings));
    }

    // Always update the updated_at timestamp
    setClause.push(`updated_at = CURRENT_TIMESTAMP`);
    
    // Handle completion timestamp
    if (updateData.status === 'completed') {
      setClause.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (setClause.length === 1) { // Only updated_at was added
      return await MigrationProjectModel.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE migration_projects 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await dbService.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Delete a migration project
   */
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM migration_projects WHERE id = $1';
    const result = await dbService.query(query, [id]);
    
    return result.rowCount > 0;
  }

  /**
   * Get project statistics
   */
  static async getProjectStats(id: string): Promise<{
    totalWorkflows: number;
    completedWorkflows: number;
    failedWorkflows: number;
    pendingWorkflows: number;
    progressPercentage: string; // PostgreSQL DECIMAL returned as string
  } | null> {
    const query = `
      SELECT 
        total_workflows,
        converted_workflows,
        failed_conversions,
        conversion_progress
      FROM migration_projects 
      WHERE id = $1
    `;
    
    const result = await dbService.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      totalWorkflows: row.total_workflows,
      completedWorkflows: row.converted_workflows,
      failedWorkflows: row.failed_conversions,
      pendingWorkflows: row.total_workflows - row.converted_workflows - row.failed_conversions,
      progressPercentage: row.conversion_progress
    };
  }

  /**
   * Search projects by name or description
   */
  static async search(searchTerm: string, limit: number = 20): Promise<MigrationProject[]> {
    const query = `
      SELECT * FROM migration_projects 
      WHERE name ILIKE $1 OR description ILIKE $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await dbService.query(query, [`%${searchTerm}%`, limit]);
    return result.rows;
  }

  /**
   * Get projects by status
   */
  static async findByStatus(status: string, limit: number = 50): Promise<MigrationProject[]> {
    const query = `
      SELECT * FROM migration_projects 
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await dbService.query(query, [status, limit]);
    return result.rows;
  }
}
