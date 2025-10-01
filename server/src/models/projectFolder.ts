import { dbService } from '../database/connection';
import { randomUUID } from 'crypto';

export interface ProjectFolder {
  id: string;
  project_id: string;
  parent_folder_id?: string;
  
  // Folder metadata
  folder_name: string;
  folder_path: string;
  
  // Folder statistics
  total_files: number;
  transformation_files: number;
  job_files: number;
  total_dependencies: number;
  
  // Folder analysis data
  folder_metadata: any;
  dependency_graph: any;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  uploaded_at: Date;
}

export interface CreateProjectFolderRequest {
  project_id: string;
  parent_folder_id?: string;
  folder_name: string;
  folder_path: string;
  folder_metadata?: any;
  dependency_graph?: any;
}

export interface UpdateProjectFolderRequest {
  folder_name?: string;
  folder_path?: string;
  folder_metadata?: any;
  dependency_graph?: any;
}

export class ProjectFolderModel {
  /**
   * Create a new project folder
   */
  static async create(folderData: CreateProjectFolderRequest): Promise<ProjectFolder> {
    const id = randomUUID();
    
    const query = `
      INSERT INTO project_folders (
        id, project_id, parent_folder_id, folder_name, folder_path,
        folder_metadata, dependency_graph
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const values = [
      id,
      folderData.project_id,
      folderData.parent_folder_id || null,
      folderData.folder_name,
      folderData.folder_path,
      JSON.stringify(folderData.folder_metadata || {}),
      JSON.stringify(folderData.dependency_graph || {})
    ];
    
    const result = await dbService.query(query, values);
    return this.mapRowToProjectFolder(result.rows[0]);
  }
  
  /**
   * Get project folder by ID
   */
  static async findById(id: string): Promise<ProjectFolder | null> {
    const query = `
      SELECT pfo.*, parent.folder_name as parent_folder_name
      FROM project_folders pfo
      LEFT JOIN project_folders parent ON pfo.parent_folder_id = parent.id
      WHERE pfo.id = $1
    `;
    
    const result = await dbService.query(query, [id]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProjectFolder(result.rows[0]);
  }
  
  /**
   * Get all folders for a project
   */
  static async findByProjectId(
    projectId: string,
    options: {
      parentFolderId?: string;
      includeSubfolders?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{
    folders: ProjectFolder[];
    total: number;
    limit: number;
    offset: number;
  }> {
    let whereClause = 'WHERE pfo.project_id = $1';
    const values: any[] = [projectId];
    
    if (options.parentFolderId !== undefined) {
      if (options.parentFolderId === null) {
        // Get root folders (no parent)
        whereClause += ` AND pfo.parent_folder_id IS NULL`;
      } else {
        // Get folders with specific parent
        whereClause += ` AND pfo.parent_folder_id = $${values.length + 1}`;
        values.push(options.parentFolderId);
      }
    }
    
    // Count total folders
    const countQuery = `
      SELECT COUNT(*) as count
      FROM project_folders pfo
      ${whereClause}
    `;
    
    const countResult = await dbService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);
    
    // Get folders with pagination
    const limit = options.limit || 50;
    const offset = options.offset || 0;
    
    const query = `
      SELECT pfo.*, parent.folder_name as parent_folder_name
      FROM project_folders pfo
      LEFT JOIN project_folders parent ON pfo.parent_folder_id = parent.id
      ${whereClause}
      ORDER BY pfo.folder_name ASC
      LIMIT $${values.length + 1} OFFSET $${values.length + 2}
    `;
    
    values.push(limit, offset);
    
    const result = await dbService.query(query, values);
    
    return {
      folders: result.rows.map(this.mapRowToProjectFolder),
      total,
      limit,
      offset
    };
  }
  
  /**
   * Get folder hierarchy for a project
   */
  static async getFolderHierarchy(projectId: string): Promise<ProjectFolder[]> {
    const query = `
      WITH RECURSIVE folder_hierarchy AS (
        -- Base case: root folders
        SELECT 
          pfo.*,
          0 as level,
          ARRAY[pfo.folder_name] as path_array,
          pfo.folder_path as full_path
        FROM project_folders pfo
        WHERE pfo.project_id = $1 AND pfo.parent_folder_id IS NULL
        
        UNION ALL
        
        -- Recursive case: child folders
        SELECT 
          child.*,
          parent.level + 1,
          parent.path_array || child.folder_name,
          parent.full_path || '/' || child.folder_name
        FROM project_folders child
        JOIN folder_hierarchy parent ON child.parent_folder_id = parent.id
        WHERE child.project_id = $1
      )
      SELECT * FROM folder_hierarchy
      ORDER BY level ASC, folder_name ASC
    `;
    
    const result = await dbService.query(query, [projectId]);
    return result.rows.map(this.mapRowToProjectFolder);
  }
  
  /**
   * Update a project folder
   */
  static async update(id: string, updateData: UpdateProjectFolderRequest): Promise<ProjectFolder | null> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === 'folder_metadata' || key === 'dependency_graph') {
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
      UPDATE project_folders 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    values.push(id);
    
    const result = await dbService.query(query, values);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProjectFolder(result.rows[0]);
  }
  
  /**
   * Delete a project folder (and all its contents)
   */
  static async delete(id: string): Promise<boolean> {
    // Note: CASCADE will automatically delete child folders and files
    const query = 'DELETE FROM project_folders WHERE id = $1';
    const result = await dbService.query(query, [id]);
    return result.rowCount > 0;
  }
  
  /**
   * Get folder tree structure for a project
   */
  static async getFolderTree(projectId: string): Promise<any> {
    // Get all folders with their file counts
    const foldersQuery = `
      SELECT 
        pfo.*,
        COUNT(pf.id) as file_count,
        COUNT(pf.id) FILTER (WHERE pf.file_type = 'transformation') as transformation_count,
        COUNT(pf.id) FILTER (WHERE pf.file_type = 'job') as job_count
      FROM project_folders pfo
      LEFT JOIN project_files pf ON pfo.id = pf.folder_id
      WHERE pfo.project_id = $1
      GROUP BY pfo.id
      ORDER BY pfo.folder_path ASC
    `;
    
    const result = await dbService.query(foldersQuery, [projectId]);
    const folders = result.rows.map((row: any) => ({
      ...this.mapRowToProjectFolder(row),
      file_count: parseInt(row.file_count) || 0,
      transformation_count: parseInt(row.transformation_count) || 0,
      job_count: parseInt(row.job_count) || 0
    }));
    
    // Build tree structure
    const folderMap = new Map();
    const rootFolders: any[] = [];
    
    // First pass: create folder nodes
    folders.forEach((folder: any) => {
      folderMap.set(folder.id, {
        ...folder,
        children: []
      });
    });
    
    // Second pass: build hierarchy
    folders.forEach((folder: any) => {
      const folderNode = folderMap.get(folder.id);
      
      if (folder.parent_folder_id) {
        const parent = folderMap.get(folder.parent_folder_id);
        if (parent) {
          parent.children.push(folderNode);
        }
      } else {
        rootFolders.push(folderNode);
      }
    });
    
    return rootFolders;
  }
  
  /**
   * Find folder by path
   */
  static async findByPath(projectId: string, folderPath: string): Promise<ProjectFolder | null> {
    const query = `
      SELECT pfo.*, parent.folder_name as parent_folder_name
      FROM project_folders pfo
      LEFT JOIN project_folders parent ON pfo.parent_folder_id = parent.id
      WHERE pfo.project_id = $1 AND pfo.folder_path = $2
    `;
    
    const result = await dbService.query(query, [projectId, folderPath]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return this.mapRowToProjectFolder(result.rows[0]);
  }
  
  /**
   * Get or create folder by path (for uploads)
   */
  static async getOrCreateByPath(
    projectId: string, 
    folderPath: string
  ): Promise<ProjectFolder> {
    // Try to find existing folder
    let folder = await this.findByPath(projectId, folderPath);
    
    if (folder) {
      return folder;
    }
    
    // Create folder and any missing parent folders
    const pathParts = folderPath.split('/').filter(part => part.length > 0);
    let currentPath = '';
    let parentId: string | undefined = undefined;
    
    for (const pathPart of pathParts) {
      currentPath = currentPath ? `${currentPath}/${pathPart}` : pathPart;
      
      let currentFolder = await this.findByPath(projectId, currentPath);
      
      if (!currentFolder) {
        currentFolder = await this.create({
          project_id: projectId,
          parent_folder_id: parentId,
          folder_name: pathPart,
          folder_path: currentPath
        });
      }
      
      parentId = currentFolder.id;
    }
    
    // Return the final folder
    return await this.findByPath(projectId, folderPath) as ProjectFolder;
  }
  
  /**
   * Map database row to ProjectFolder interface
   */
  private static mapRowToProjectFolder(row: any): ProjectFolder {
    return {
      id: row.id,
      project_id: row.project_id,
      parent_folder_id: row.parent_folder_id,
      folder_name: row.folder_name,
      folder_path: row.folder_path,
      total_files: parseInt(row.total_files) || 0,
      transformation_files: parseInt(row.transformation_files) || 0,
      job_files: parseInt(row.job_files) || 0,
      total_dependencies: parseInt(row.total_dependencies) || 0,
      folder_metadata: typeof row.folder_metadata === 'string' ? JSON.parse(row.folder_metadata) : (row.folder_metadata || {}),
      dependency_graph: typeof row.dependency_graph === 'string' ? JSON.parse(row.dependency_graph) : (row.dependency_graph || {}),
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
      uploaded_at: new Date(row.uploaded_at)
    };
  }
}
