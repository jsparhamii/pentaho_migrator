import { dbService } from '../database/connection';
import { randomUUID } from 'crypto';

export interface ProjectUpload {
  id: string;
  project_id: string;
  
  // Upload metadata
  upload_type: 'single_file' | 'folder' | 'multiple_files';
  original_name: string;
  upload_source: string;
  
  // Upload statistics
  total_files: number;
  processed_files: number;
  failed_files: number;
  total_size: number;
  
  // Upload status
  upload_status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  processing_errors: any[];
  
  // Upload session data
  session_metadata: any;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  
  // User tracking
  uploaded_by?: string;
}

export interface CreateProjectUploadRequest {
  project_id: string;
  upload_type: 'single_file' | 'folder' | 'multiple_files';
  original_name: string;
  upload_source?: string;
  total_files: number;
  total_size?: number;
  session_metadata?: any;
  uploaded_by?: string;
}

export interface UpdateProjectUploadRequest {
  processed_files?: number;
  failed_files?: number;
  upload_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  processing_errors?: any[];
  completed_at?: Date;
}

export class ProjectUploadModel {
  /**
   * Create a new project upload session
   */
  static async create(uploadData: CreateProjectUploadRequest): Promise<ProjectUpload> {
    const id = randomUUID();
    
    const query = `
      INSERT INTO project_uploads (
        id, project_id, upload_type, original_name, upload_source,
        total_files, total_size, session_metadata, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
    const values = [
      id,
      uploadData.project_id,
      uploadData.upload_type,
      uploadData.original_name,
      uploadData.upload_source || 'web_interface',
      uploadData.total_files,
      uploadData.total_size || 0,
      JSON.stringify(uploadData.session_metadata || {}),
      uploadData.uploaded_by || null
    ];
    
    const result = await dbService.query(query, values);
    return this.mapRowToProjectUpload(result.rows[0]);
  }
  
  /**
   * Get project upload by ID
   */
  static async findById(id: string): Promise<ProjectUpload | null> {
    const query = `
      SELECT pu.*, mp.name as project_name
      FROM project_uploads pu
      LEFT JOIN migration_projects mp ON pu.project_id = mp.id
      WHERE pu.id = $1
    `;
    
    const result = await dbService.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProjectUpload(result.rows[0]);
  }
  
  /**
   * Get all uploads for a project
   */
  static async findByProjectId(
    projectId: string,
    options: {
      uploadStatus?: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    uploads: ProjectUpload[];
    total: number;
    limit: number;
    offset: number;
  }> {
    let whereClause = 'WHERE pu.project_id = $1';
    const values: any[] = [projectId];
    
    if (options.uploadStatus) {
      whereClause += ` AND pu.upload_status = $${values.length + 1}`;
      values.push(options.uploadStatus);
    }
    
    // Count total uploads
    const countQuery = `
      SELECT COUNT(*) as count
      FROM project_uploads pu
      ${whereClause}
    `;
    
    const countResult = await dbService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    // Get uploads with pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    const query = `
      SELECT pu.*, mp.name as project_name
      FROM project_uploads pu
      LEFT JOIN migration_projects mp ON pu.project_id = mp.id
      ${whereClause}
      ORDER BY pu.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    
    values.push(limit, offset);
    
    const result = await dbService.query(query, values);
    
    return {
      uploads: result.rows.map(this.mapRowToProjectUpload),
      total,
      limit,
      offset
    };
  }
  
  /**
   * Update a project upload
   */
  static async update(id: string, updateData: UpdateProjectUploadRequest): Promise<ProjectUpload | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'processing_errors') {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    });
    
    if (setClauses.length === 0) {
      return this.findById(id);
    }
    
    const query = `
      UPDATE project_uploads 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(id);
    
    const result = await dbService.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProjectUpload(result.rows[0]);
  }
  
  /**
   * Mark upload as completed
   */
  static async markCompleted(id: string, processedFiles: number, failedFiles: number = 0): Promise<ProjectUpload | null> {
    return this.update(id, {
      processed_files: processedFiles,
      failed_files: failedFiles,
      upload_status: failedFiles > 0 ? 'partial' : 'completed',
      completed_at: new Date()
    });
  }
  
  /**
   * Mark upload as failed
   */
  static async markFailed(id: string, errors: any[]): Promise<ProjectUpload | null> {
    return this.update(id, {
      upload_status: 'failed',
      processing_errors: errors,
      completed_at: new Date()
    });
  }
  
  /**
   * Delete a project upload record
   */
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM project_uploads WHERE id = $1';
    const result = await dbService.query(query, [id]);
    return result.rowCount > 0;
  }
  
  /**
   * Get upload statistics for a project
   */
  static async getProjectUploadStats(projectId: string): Promise<{
    totalUploads: number;
    completedUploads: number;
    failedUploads: number;
    totalFilesUploaded: number;
    totalSizeUploaded: number;
    recentUploads: ProjectUpload[];
  }> {
    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_uploads,
        COUNT(*) FILTER (WHERE upload_status = 'completed') as completed_uploads,
        COUNT(*) FILTER (WHERE upload_status = 'failed') as failed_uploads,
        COALESCE(SUM(processed_files), 0) as total_files_uploaded,
        COALESCE(SUM(total_size), 0) as total_size_uploaded
      FROM project_uploads 
      WHERE project_id = $1
    `;
    
    const statsResult = await dbService.query(statsQuery, [projectId]);
    const stats = statsResult.rows[0];
    
    // Get recent uploads
    const recentQuery = `
      SELECT pu.*, mp.name as project_name
      FROM project_uploads pu
      LEFT JOIN migration_projects mp ON pu.project_id = mp.id
      WHERE pu.project_id = $1
      ORDER BY pu.created_at DESC
      LIMIT 5
    `;
    
    const recentResult = await dbService.query(recentQuery, [projectId]);
    
    return {
      totalUploads: parseInt(stats.total_uploads) || 0,
      completedUploads: parseInt(stats.completed_uploads) || 0,
      failedUploads: parseInt(stats.failed_uploads) || 0,
      totalFilesUploaded: parseInt(stats.total_files_uploaded) || 0,
      totalSizeUploaded: parseInt(stats.total_size_uploaded) || 0,
      recentUploads: recentResult.rows.map(this.mapRowToProjectUpload)
    };
  }
  
  /**
   * Clean up old completed uploads (optional maintenance)
   */
  static async cleanupOldUploads(daysOld: number = 30): Promise<number> {
    const query = `
      DELETE FROM project_uploads 
      WHERE upload_status IN ('completed', 'failed') 
      AND created_at < CURRENT_TIMESTAMP - INTERVAL '${daysOld} days'
    `;
    
    const result = await dbService.query(query);
    return result.rowCount;
  }
  
  /**
   * Map database row to ProjectUpload interface
   */
  private static mapRowToProjectUpload(row: any): ProjectUpload {
    return {
      id: row.id,
      project_id: row.project_id,
      upload_type: row.upload_type,
      original_name: row.original_name,
      upload_source: row.upload_source,
      total_files: parseInt(row.total_files) || 0,
      processed_files: parseInt(row.processed_files) || 0,
      failed_files: parseInt(row.failed_files) || 0,
      total_size: parseInt(row.total_size) || 0,
      upload_status: row.upload_status,
      processing_errors: typeof row.processing_errors === 'string' ? JSON.parse(row.processing_errors) : (row.processing_errors || []),
      session_metadata: typeof row.session_metadata === 'string' ? JSON.parse(row.session_metadata) : (row.session_metadata || {}),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      uploaded_by: row.uploaded_by
    };
  }
}

