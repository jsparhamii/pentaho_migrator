import { dbService } from '../database/connection';
import { randomUUID } from 'crypto';

export interface ProjectFile {
  id: string;
  project_id: string;
  folder_id?: string;
  
  // File metadata
  file_name: string;
  file_type: 'transformation' | 'job';
  file_size: number;
  file_path?: string;
  file_extension: string;
  
  // Complete workflow data
  workflow_data: any; // Complete PentahoWorkflow object
  raw_content?: string; // Original file content
  
  // File references and dependencies
  references: any[]; // Files this file references
  referenced_by: any[]; // Files that reference this file
  external_dependencies: any[]; // External files, databases, etc.
  
  // Processing status
  parsing_status: 'pending' | 'processing' | 'completed' | 'failed';
  parsing_error?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  uploaded_at: Date;
  last_accessed: Date;
}

export interface CreateProjectFileRequest {
  project_id: string;
  folder_id?: string;
  file_name: string;
  file_type: 'transformation' | 'job';
  file_size: number;
  file_path?: string;
  file_extension: string;
  workflow_data: any;
  raw_content?: string;
  references?: any[];
  referenced_by?: any[];
  external_dependencies?: any[];
}

export interface UpdateProjectFileRequest {
  file_name?: string;
  workflow_data?: any;
  workflow_summary?: any;
  raw_content?: string;
  references?: any[];
  referenced_by?: any[];
  external_dependencies?: any[];
  parsing_status?: 'pending' | 'processing' | 'completed' | 'failed';
  parsing_error?: string;
  last_accessed?: Date;
}

export class ProjectFileModel {
  /**
   * Create a new project file
   */
  static async create(fileData: CreateProjectFileRequest): Promise<ProjectFile> {
    const id = randomUUID();
    
    const query = `
      INSERT INTO project_files (
        id, project_id, folder_id, file_name, file_type, file_size, 
        file_path, file_extension, workflow_data, raw_content,
        file_references, referenced_by, external_dependencies
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;
    
    const values = [
      id,
      fileData.project_id,
      fileData.folder_id || null,
      fileData.file_name,
      fileData.file_type,
      fileData.file_size,
      fileData.file_path || null,
      fileData.file_extension,
      JSON.stringify(fileData.workflow_data),
      fileData.raw_content || null,
      JSON.stringify(fileData.references || []),
      JSON.stringify(fileData.referenced_by || []),
      JSON.stringify(fileData.external_dependencies || [])
    ];
    
    const result = await dbService.query(query, values);
    return this.mapRowToProjectFile(result.rows[0]);
  }
  
  /**
   * Get project file by ID
   */
  static async findById(id: string): Promise<ProjectFile | null> {
    const query = `
      SELECT pf.*, pfo.folder_name, pfo.folder_path
      FROM project_files pf
      LEFT JOIN project_folders pfo ON pf.folder_id = pfo.id
      WHERE pf.id = $1
    `;
    
    const result = await dbService.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    // Update last_accessed timestamp
    await dbService.query(
      'UPDATE project_files SET last_accessed = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
    
    return this.mapRowToProjectFile(result.rows[0]);
  }
  
  /**
   * Get all files for a project
   */
  static async findByProjectId(
    projectId: string, 
    options: {
      folderId?: string;
      fileType?: 'transformation' | 'job';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    files: ProjectFile[];
    total: number;
    limit: number;
    offset: number;
  }> {
    let whereClause = 'WHERE pf.project_id = $1';
    const values: any[] = [projectId];
    
    if (options.folderId) {
      whereClause += ` AND pf.folder_id = $${values.length + 1}`;
      values.push(options.folderId);
    }
    
    if (options.fileType) {
      whereClause += ` AND pf.file_type = $${values.length + 1}`;
      values.push(options.fileType);
    }
    
    // Count total files
    const countQuery = `
      SELECT COUNT(*) as count
      FROM project_files pf
      ${whereClause}
    `;
    
    const countResult = await dbService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    // Get files with pagination
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const query = `
      SELECT pf.*, pfo.folder_name, pfo.folder_path
      FROM project_files pf
      LEFT JOIN project_folders pfo ON pf.folder_id = pfo.id
      ${whereClause}
      ORDER BY pf.created_at DESC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    
    values.push(limit, offset);
    
    const result = await dbService.query(query, values);
    
    return {
      files: result.rows.map(this.mapRowToProjectFile),
      total,
      limit,
      offset
    };
  }
  
  /**
   * Update a project file
   */
  static async update(id: string, updateData: UpdateProjectFileRequest): Promise<ProjectFile | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'workflow_data' || key === 'workflow_summary' || key === 'references' || key === 'referenced_by' || key === 'external_dependencies') {
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
      UPDATE project_files 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(id);
    
    const result = await dbService.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProjectFile(result.rows[0]);
  }
  
  /**
   * Delete a project file
   */
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM project_files WHERE id = $1';
    const result = await dbService.query(query, [id]);
    return result.rowCount > 0;
  }
  
  /**
   * Get project file statistics
   */
  static async getProjectFileStats(projectId: string): Promise<{
    totalFiles: number;
    transformationFiles: number;
    jobFiles: number;
    totalSize: number;
    recentFiles: ProjectFile[];
  }> {
    // Get overall stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(*) FILTER (WHERE file_type = 'transformation') as transformation_files,
        COUNT(*) FILTER (WHERE file_type = 'job') as job_files,
        COALESCE(SUM(file_size), 0) as total_size
      FROM project_files 
      WHERE project_id = $1
    `;
    
    const statsResult = await dbService.query(statsQuery, [projectId]);
    const stats = statsResult.rows[0];
    
    // Get recent files
    const recentQuery = `
      SELECT pf.*, pfo.folder_name, pfo.folder_path
      FROM project_files pf
      LEFT JOIN project_folders pfo ON pf.folder_id = pfo.id
      WHERE pf.project_id = $1
      ORDER BY pf.created_at DESC
      LIMIT 5
    `;
    
    const recentResult = await dbService.query(recentQuery, [projectId]);
    
    return {
      totalFiles: parseInt(stats.total_files) || 0,
      transformationFiles: parseInt(stats.transformation_files) || 0,
      jobFiles: parseInt(stats.job_files) || 0,
      totalSize: parseInt(stats.total_size) || 0,
      recentFiles: recentResult.rows.map(this.mapRowToProjectFile)
    };
  }
  
  /**
   * Search files within a project
   */
  static async search(
    projectId: string, 
    searchTerm: string,
    options: {
      fileType?: 'transformation' | 'job';
      folderId?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    files: ProjectFile[];
    total: number;
  }> {
    let whereClause = 'WHERE pf.project_id = $1 AND (pf.file_name ILIKE $2 OR pf.file_path ILIKE $2)';
    const values: any[] = [projectId, `%${searchTerm}%`];
    
    if (options.fileType) {
      whereClause += ` AND pf.file_type = $${values.length + 1}`;
      values.push(options.fileType);
    }
    
    if (options.folderId) {
      whereClause += ` AND pf.folder_id = $${values.length + 1}`;
      values.push(options.folderId);
    }
    
    // Count results
    const countQuery = `
      SELECT COUNT(*) as count
      FROM project_files pf
      ${whereClause}
    `;
    
    const countResult = await dbService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    // Get results with pagination
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    
    const query = `
      SELECT pf.*, pfo.folder_name, pfo.folder_path
      FROM project_files pf
      LEFT JOIN project_folders pfo ON pf.folder_id = pfo.id
      ${whereClause}
      ORDER BY pf.file_name ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    
    values.push(limit, offset);
    
    const result = await dbService.query(query, values);
    
    return {
      files: result.rows.map(this.mapRowToProjectFile),
      total
    };
  }
  
  /**
   * Map database row to ProjectFile interface
   */
  private static mapRowToProjectFile(row: any): ProjectFile {
    return {
      id: row.id,
      project_id: row.project_id,
      folder_id: row.folder_id,
      file_name: row.file_name,
      file_type: row.file_type,
      file_size: parseInt(row.file_size) || 0,
      file_path: row.file_path,
      file_extension: row.file_extension,
      workflow_data: typeof row.workflow_data === 'string' ? JSON.parse(row.workflow_data) : row.workflow_data,
      raw_content: row.raw_content,
      references: typeof row.references === 'string' ? JSON.parse(row.references) : (row.references || []),
      referenced_by: typeof row.referenced_by === 'string' ? JSON.parse(row.referenced_by) : (row.referenced_by || []),
      external_dependencies: typeof row.external_dependencies === 'string' ? JSON.parse(row.external_dependencies) : (row.external_dependencies || []),
      parsing_status: row.parsing_status,
      parsing_error: row.parsing_error,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      uploaded_at: new Date(row.uploaded_at),
      last_accessed: new Date(row.last_accessed)
    };
  }
}
