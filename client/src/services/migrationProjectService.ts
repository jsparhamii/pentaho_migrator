import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001/api';

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
  created_at: string;
  updated_at: string;
  completed_at?: string;
  
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
  settings?: any;
}

export interface WorkflowConversion {
  id: string;
  project_id: string;
  
  // Source workflow info
  source_workflow_name: string;
  source_workflow_type: 'transformation' | 'job';
  source_file_path?: string;
  source_file_size?: number;
  source_last_modified?: string;
  
  // Conversion details
  conversion_status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  conversion_type: 'pyspark' | 'sql' | 'scala';
  
  // Generated code
  generated_code?: string;
  generated_notebook?: any;
  required_libraries: string[];
  conversion_notes: string[];
  estimated_complexity?: 'Low' | 'Medium' | 'High';
  
  // AI/LLM details
  ai_model_used?: string;
  ai_tokens_used?: number;
  ai_processing_time_ms?: number;
  
  // Databricks integration
  databricks_notebook_path?: string;
  databricks_notebook_id?: string;
  lakebase_artifact_id?: string;
  
  // Error handling
  error_message?: string;
  error_details?: any;
  retry_count: number;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  conversion_started_at?: string;
  conversion_completed_at?: string;
  
  // Performance metrics
  source_node_count: number;
  source_connection_count: number;
  generated_code_size: number;
}

export interface ProjectStats {
  totalWorkflows: number;
  completedWorkflows: number;
  failedWorkflows: number;
  pendingWorkflows: number;
  progressPercentage: string; // PostgreSQL DECIMAL returned as string
}

export interface ConversionStats {
  total: number;
  completed: number;
  failed: number;
  pending: number;
  processing: number;
  byComplexity: { [key: string]: number };
  averageProcessingTime: number;
}

export interface ProjectDashboard {
  project: MigrationProject;
  stats: ProjectStats;
  conversionStats: ConversionStats;
  recentConversions: WorkflowConversion[];
}

/**
 * Migration Project Service
 * Handles API calls for migration project management
 */
export class MigrationProjectService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  /**
   * Get all migration projects
   */
  async getAllProjects(limit: number = 50, offset: number = 0): Promise<{
    projects: MigrationProject[];
    total: number;
    limit: number;
    offset: number;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/migration-projects`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching migration projects:', error);
      throw error;
    }
  }

  /**
   * Get a specific migration project
   */
  async getProject(id: string): Promise<{
    project: MigrationProject;
    stats: ProjectStats;
    recentConversions: WorkflowConversion[];
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/migration-projects/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching migration project:', error);
      throw error;
    }
  }

  /**
   * Create a new migration project
   */
  async createProject(projectData: CreateMigrationProjectRequest): Promise<{
    project: MigrationProject;
    lakebaseProject?: any;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/migration-projects`, projectData);
      return response.data;
    } catch (error) {
      console.error('Error creating migration project:', error);
      throw error;
    }
  }

  /**
   * Update a migration project
   */
  async updateProject(id: string, updateData: UpdateMigrationProjectRequest): Promise<{
    project: MigrationProject;
  }> {
    try {
      const response = await axios.put(`${this.baseURL}/migration-projects/${id}`, updateData);
      return response.data;
    } catch (error) {
      console.error('Error updating migration project:', error);
      throw error;
    }
  }

  /**
   * Delete a migration project
   */
  async deleteProject(id: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/migration-projects/${id}`);
    } catch (error) {
      console.error('Error deleting migration project:', error);
      throw error;
    }
  }

  /**
   * Get workflow conversions for a project
   */
  async getProjectConversions(id: string, limit: number = 50, offset: number = 0): Promise<{
    conversions: WorkflowConversion[];
    total: number;
    stats: ConversionStats;
    limit: number;
    offset: number;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/migration-projects/${id}/conversions`, {
        params: { limit, offset }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching project conversions:', error);
      throw error;
    }
  }

  /**
   * Get existing conversion for a specific workflow
   */
  async getExistingConversion(projectId: string, workflowName: string): Promise<WorkflowConversion | null> {
    try {
      const response = await axios.get(`${this.baseURL}/migration-projects/${projectId}/conversions/by-workflow/${encodeURIComponent(workflowName)}`);
      return response.data.conversion;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // No existing conversion found
      }
      console.error('Error fetching existing conversion:', error);
      throw error;
    }
  }

  /**
   * Convert a workflow as part of a project
   */
  async convertWorkflow(
    projectId: string,
    workflow: any,
    sourceFilePath?: string,
    sourceFileSize?: number,
    sourceLastModified?: string
  ): Promise<{
    conversion: WorkflowConversion;
    project: MigrationProject;
  }> {
    try {
      const response = await axios.post(`${this.baseURL}/migration-projects/${projectId}/convert-workflow`, {
        workflow,
        sourceFilePath,
        sourceFileSize,
        sourceLastModified
      });
      return response.data;
    } catch (error) {
      console.error('Error converting workflow for project:', error);
      throw error;
    }
  }

  /**
   * Get project dashboard data
   */
  async getProjectDashboard(id: string): Promise<ProjectDashboard> {
    try {
      const response = await axios.get(`${this.baseURL}/migration-projects/${id}/dashboard`);
      return response.data;
    } catch (error) {
      console.error('Error fetching project dashboard:', error);
      throw error;
    }
  }

  /**
   * Search migration projects
   */
  async searchProjects(searchTerm: string, limit: number = 20): Promise<{
    projects: MigrationProject[];
    searchTerm: string;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/migration-projects/search/${encodeURIComponent(searchTerm)}`, {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      console.error('Error searching migration projects:', error);
      throw error;
    }
  }

  /**
   * Get project status color
   */
  getStatusColor(status: string): string {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200';
      case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'archived': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Get conversion status color
   */
  getConversionStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'skipped': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  /**
   * Get complexity color
   */
  getComplexityColor(complexity: string): string {
    switch (complexity) {
      case 'Low': return 'bg-green-100 text-green-800 border-green-200';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'High': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  }

  /**
   * Format file size
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format processing time
   */
  formatProcessingTime(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * Calculate progress percentage
   */
  calculateProgress(completed: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  }
}

// Export singleton instance
export const migrationProjectService = new MigrationProjectService();
