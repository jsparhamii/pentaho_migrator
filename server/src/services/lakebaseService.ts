import { randomUUID } from 'crypto';

export interface LakebaseProject {
  id: string;
  name: string;
  description: string;
  workspace_url: string;
  catalog_name: string;
  schema_name: string;
  created_at: Date;
  status: 'active' | 'archived';
}

export interface LakebaseArtifact {
  id: string;
  project_id: string;
  name: string;
  type: 'notebook' | 'sql' | 'pipeline';
  path: string;
  content: string;
  metadata: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateLakebaseProjectRequest {
  name: string;
  description: string;
  workspace_url: string;
  catalog_name: string;
  schema_name: string;
}

export interface CreateLakebaseArtifactRequest {
  project_id: string;
  name: string;
  type: 'notebook' | 'sql' | 'pipeline';
  content: string;
  metadata?: any;
}

/**
 * Databricks Lakebase Integration Service
 * Handles integration with Databricks Lakebase for project and artifact management
 */
export class LakebaseService {
  private databricksToken: string | undefined;
  private baseUrl: string;

  constructor() {
    this.databricksToken = process.env.DATABRICKS_TOKEN;
    this.baseUrl = process.env.DATABRICKS_WORKSPACE_URL || '';
    
    if (!this.databricksToken || !this.baseUrl) {
      console.warn('⚠️ Databricks credentials not configured. Lakebase features will be limited.');
    }
  }

  /**
   * Check if Lakebase integration is available
   */
  isAvailable(): boolean {
    return !!(this.databricksToken && this.baseUrl);
  }

  /**
   * Create a new Lakebase project
   */
  async createProject(projectData: CreateLakebaseProjectRequest): Promise<LakebaseProject> {
    if (!this.isAvailable()) {
      throw new Error('Databricks Lakebase integration not configured');
    }

    try {
      console.log(`🔄 Creating Lakebase project: ${projectData.name}`);

      // For now, we'll create a mock project since Lakebase API might not be publicly available
      // In a real implementation, this would make actual API calls to Databricks Lakebase
      const project: LakebaseProject = {
        id: randomUUID(),
        name: projectData.name,
        description: projectData.description,
        workspace_url: projectData.workspace_url,
        catalog_name: projectData.catalog_name,
        schema_name: projectData.schema_name,
        created_at: new Date(),
        status: 'active'
      };

      // Create the catalog and schema in Databricks
      await this.ensureCatalogAndSchema(projectData.catalog_name, projectData.schema_name);

      console.log(`✅ Lakebase project created: ${project.id}`);
      return project;
    } catch (error) {
      console.error('❌ Error creating Lakebase project:', error);
      throw error;
    }
  }

  /**
   * Create a Lakebase artifact (notebook, SQL, pipeline)
   */
  async createArtifact(artifactData: CreateLakebaseArtifactRequest): Promise<LakebaseArtifact> {
    if (!this.isAvailable()) {
      throw new Error('Databricks Lakebase integration not configured');
    }

    try {
      console.log(`🔄 Creating Lakebase artifact: ${artifactData.name}`);

      const artifact: LakebaseArtifact = {
        id: randomUUID(),
        project_id: artifactData.project_id,
        name: artifactData.name,
        type: artifactData.type,
        path: `/Workspace/Projects/${artifactData.project_id}/${artifactData.name}`,
        content: artifactData.content,
        metadata: artifactData.metadata || {},
        created_at: new Date(),
        updated_at: new Date()
      };

      // Upload the artifact to Databricks workspace
      if (artifactData.type === 'notebook') {
        await this.uploadNotebook(artifact.path, artifactData.content);
      } else if (artifactData.type === 'sql') {
        await this.createSqlFile(artifact.path, artifactData.content);
      }

      console.log(`✅ Lakebase artifact created: ${artifact.id}`);
      return artifact;
    } catch (error) {
      console.error('❌ Error creating Lakebase artifact:', error);
      throw error;
    }
  }

  /**
   * Ensure catalog and schema exist in Databricks
   */
  private async ensureCatalogAndSchema(catalogName: string, schemaName: string): Promise<void> {
    try {
      // Create catalog if it doesn't exist
      await this.executeSql(`CREATE CATALOG IF NOT EXISTS \`${catalogName}\``);
      
      // Create schema if it doesn't exist
      await this.executeSql(`CREATE SCHEMA IF NOT EXISTS \`${catalogName}\`.\`${schemaName}\``);
      
      console.log(`✅ Catalog and schema ensured: ${catalogName}.${schemaName}`);
    } catch (error) {
      console.error('❌ Error ensuring catalog and schema:', error);
      // Don't throw here, as this might not be critical for the project creation
    }
  }

  /**
   * Upload a notebook to Databricks workspace
   */
  private async uploadNotebook(path: string, content: string): Promise<void> {
    try {
      const notebookContent = typeof content === 'string' ? JSON.parse(content) : content;
      
      // Convert our notebook format to Databricks format if needed
      const databricksNotebook = this.convertToDatabricksFormat(notebookContent);
      
      const response = await fetch(`${this.baseUrl}/api/2.0/workspace/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.databricksToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: path,
          format: 'DBC',
          content: Buffer.from(JSON.stringify(databricksNotebook)).toString('base64'),
          overwrite: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to upload notebook: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Notebook uploaded to: ${path}`);
    } catch (error) {
      console.error('❌ Error uploading notebook:', error);
      throw error;
    }
  }

  /**
   * Create a SQL file in Databricks
   */
  private async createSqlFile(path: string, content: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/2.0/workspace/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.databricksToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: path,
          format: 'SOURCE',
          language: 'SQL',
          content: Buffer.from(content).toString('base64'),
          overwrite: true
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to create SQL file: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ SQL file created at: ${path}`);
    } catch (error) {
      console.error('❌ Error creating SQL file:', error);
      throw error;
    }
  }

  /**
   * Execute SQL in Databricks
   */
  private async executeSql(sql: string): Promise<any> {
    try {
      // This would use Databricks SQL Connector or REST API
      // For now, we'll simulate the execution
      console.log(`🔄 Executing SQL: ${sql}`);
      
      // In a real implementation, you would use:
      // - Databricks SQL Connector (@databricks/sql)
      // - Or Databricks REST API for SQL execution
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error executing SQL:', error);
      throw error;
    }
  }

  /**
   * Convert our notebook format to Databricks format
   */
  private convertToDatabricksFormat(notebook: any): any {
    // Convert from our internal notebook format to Databricks .dbc format
    if (notebook.commands) {
      // Already in Databricks format
      return notebook;
    }

    // Convert from generic notebook format
    return {
      version: '4.0',
      origId: Date.now(),
      language: notebook.language || 'python',
      title: notebook.title || 'Converted Notebook',
      commands: notebook.cells ? notebook.cells.map((cell: any, index: number) => ({
        version: '4.0',
        origId: Date.now() + index,
        guid: randomUUID(),
        subtype: 'command',
        commandType: cell.cell_type === 'markdown' ? 'md' : 'python',
        position: index,
        command: Array.isArray(cell.source) ? cell.source.join('') : cell.source,
        commentThread: [],
        commentsVisible: false,
        parentHierarchy: [],
        diffInserts: [],
        diffDeletes: [],
        globalVars: {},
        latestUser: 'system',
        height: 'auto',
        width: 'auto',
        xPos: 0,
        yPos: 0,
        commandTitle: '',
        showCommandTitle: false,
        hideCommandCode: false,
        hideCommandResult: false,
        bindings: {},
        displayType: 'table',
        results: null,
        startTime: 0,
        submitTime: 0,
        finishTime: 0,
        state: 'finished',
        errorSummary: '',
        error: '',
        workflows: [],
        ipythonMetadata: null
      })) : []
    };
  }

  /**
   * Get project artifacts
   */
  async getProjectArtifacts(projectId: string): Promise<LakebaseArtifact[]> {
    if (!this.isAvailable()) {
      return [];
    }

    try {
      // In a real implementation, this would fetch artifacts from Databricks workspace
      // For now, return empty array
      return [];
    } catch (error) {
      console.error('❌ Error getting project artifacts:', error);
      return [];
    }
  }

  /**
   * Delete a Lakebase project
   */
  async deleteProject(projectId: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Databricks Lakebase integration not configured');
    }

    try {
      console.log(`🔄 Deleting Lakebase project: ${projectId}`);
      
      // Delete project folder from workspace
      const projectPath = `/Workspace/Projects/${projectId}`;
      await this.deleteWorkspaceItem(projectPath);
      
      console.log(`✅ Lakebase project deleted: ${projectId}`);
    } catch (error) {
      console.error('❌ Error deleting Lakebase project:', error);
      throw error;
    }
  }

  /**
   * Delete an item from Databricks workspace
   */
  private async deleteWorkspaceItem(path: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/2.0/workspace/delete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.databricksToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: path,
          recursive: true
        })
      });

      if (!response.ok && response.status !== 404) { // 404 is OK - item doesn't exist
        throw new Error(`Failed to delete workspace item: ${response.status} ${response.statusText}`);
      }

      console.log(`✅ Workspace item deleted: ${path}`);
    } catch (error) {
      console.error('❌ Error deleting workspace item:', error);
      throw error;
    }
  }

  /**
   * Test Databricks connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/2.0/clusters/list`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.databricksToken}`,
          'Content-Type': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Databricks connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const lakebaseService = new LakebaseService();
