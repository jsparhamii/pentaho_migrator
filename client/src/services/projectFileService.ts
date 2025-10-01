import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

export interface ProjectFile {
  id: string;
  project_id: string;
  folder_id?: string;
  file_name: string;
  file_type: 'transformation' | 'job';
  file_size: number;
  file_path?: string;
  file_extension: string;
  workflow_data: any; // PentahoWorkflow
  raw_content?: string;
  references: any[];
  referenced_by: any[];
  external_dependencies: any[];
  parsing_status: 'pending' | 'processing' | 'completed' | 'failed';
  parsing_error?: string;
  created_at: string;
  updated_at: string;
  uploaded_at: string;
  last_accessed: string;
}

export interface ProjectFolder {
  id: string;
  project_id: string;
  parent_folder_id?: string;
  folder_name: string;
  folder_path: string;
  total_files: number;
  transformation_files: number;
  job_files: number;
  total_dependencies: number;
  folder_metadata: any;
  dependency_graph: any;
  created_at: string;
  updated_at: string;
  uploaded_at: string;
  children?: ProjectFolder[];
  file_count?: number;
}

export interface ProjectUpload {
  id: string;
  project_id: string;
  upload_type: 'single_file' | 'folder' | 'multiple_files';
  original_name: string;
  upload_source: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  total_size: number;
  upload_status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  processing_errors: any[];
  session_metadata: any;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  uploaded_by?: string;
}

export interface FileStats {
  totalFiles: number;
  transformationFiles: number;
  jobFiles: number;
  totalSize: number;
  recentFiles: ProjectFile[];
}

export interface UploadStats {
  totalUploads: number;
  completedUploads: number;
  failedUploads: number;
  totalFilesUploaded: number;
  totalSizeUploaded: number;
  recentUploads: ProjectUpload[];
}

/**
 * Service for managing project files and uploads
 */
export class ProjectFileService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Upload files to a project
   */
  async uploadFiles(
    projectId: string,
    files: FileList,
    options: {
      folderName?: string;
      uploadType?: 'single_file' | 'folder' | 'multiple_files';
      uploadedBy?: string;
    } = {}
  ): Promise<{
    success: boolean;
    uploadSessionId: string;
    processedFiles: any[];
    failedFiles: any[];
    folder?: ProjectFolder;
    summary: {
      totalFiles: number;
      processedFiles: number;
      failedFiles: number;
    };
  }> {
    try {
      const formData = new FormData();
      
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      
      if (options.folderName) {
        formData.append('folderName', options.folderName);
      }
      
      if (options.uploadType) {
        formData.append('uploadType', options.uploadType);
      }
      
      if (options.uploadedBy) {
        formData.append('uploadedBy', options.uploadedBy);
      }

      const response = await axios.post(
        `${this.baseURL}/migration-projects/${projectId}/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error uploading files:', error);
      throw error;
    }
  }

  /**
   * Get all files for a project
   */
  async getProjectFiles(
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
    try {
      const params = new URLSearchParams();
      
      if (options.folderId) params.append('folderId', options.folderId);
      if (options.fileType) params.append('fileType', options.fileType);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.offset) params.append('offset', options.offset.toString());

      const response = await axios.get(
        `${this.baseURL}/migration-projects/${projectId}/files?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching project files:', error);
      throw error;
    }
  }

  /**
   * Get a specific file by ID
   */
  async getProjectFile(projectId: string, fileId: string): Promise<{
    file: ProjectFile;
  }> {
    try {
      const response = await axios.get(
        `${this.baseURL}/migration-projects/${projectId}/files/${fileId}`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching project file:', error);
      throw error;
    }
  }

  /**
   * Get folder structure for a project
   */
  async getProjectFolders(
    projectId: string,
    includeTree: boolean = false
  ): Promise<{
    folders?: ProjectFolder[];
    folderTree?: ProjectFolder[];
    total?: number;
    limit?: number;
    offset?: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (includeTree) params.append('tree', 'true');

      const response = await axios.get(
        `${this.baseURL}/migration-projects/${projectId}/folders?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching project folders:', error);
      throw error;
    }
  }

  /**
   * Get file and upload statistics for a project
   */
  async getProjectFileStats(projectId: string): Promise<{
    fileStats: FileStats;
    uploadStats: UploadStats;
  }> {
    try {
      const response = await axios.get(
        `${this.baseURL}/migration-projects/${projectId}/file-stats`
      );

      return response.data;
    } catch (error) {
      console.error('Error fetching project file stats:', error);
      throw error;
    }
  }

  /**
   * Search files within a project
   */
  async searchProjectFiles(
    projectId: string,
    searchTerm: string,
    options: {
      fileType?: 'transformation' | 'job';
      folderId?: string;
    } = {}
  ): Promise<{
    files: ProjectFile[];
    total: number;
    searchTerm: string;
  }> {
    try {
      const params = new URLSearchParams();
      params.append('q', searchTerm);
      
      if (options.fileType) params.append('fileType', options.fileType);
      if (options.folderId) params.append('folderId', options.folderId);

      const response = await axios.get(
        `${this.baseURL}/migration-projects/${projectId}/search?${params.toString()}`
      );

      return response.data;
    } catch (error) {
      console.error('Error searching project files:', error);
      throw error;
    }
  }

  /**
   * Delete a file from a project
   */
  async deleteProjectFile(projectId: string, fileId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const response = await axios.delete(
        `${this.baseURL}/migration-projects/${projectId}/files/${fileId}`
      );

      return response.data;
    } catch (error) {
      console.error('Error deleting project file:', error);
      throw error;
    }
  }

  /**
   * Update workflow summary for a project file
   */
  async updateWorkflowSummary(projectId: string, fileId: string, summary: any): Promise<{
    success: boolean;
    file: ProjectFile;
  }> {
    try {
      const response = await axios.patch(
        `${this.baseURL}/migration-projects/${projectId}/files/${fileId}/summary`,
        { summary }
      );

      return response.data;
    } catch (error) {
      console.error('Error updating workflow summary:', error);
      throw error;
    }
  }
}
