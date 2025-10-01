import { randomUUID } from 'crypto';
import { dbService } from '../database/connection';
import { PentahoWorkflow } from '../types';
import { PySparkConversion } from '../pysparkConversionService';

export interface WorkflowConversion {
  id: string;
  project_id: string;
  
  // Source workflow info
  source_workflow_name: string;
  source_workflow_type: 'transformation' | 'job';
  source_file_path?: string;
  source_file_size?: number;
  source_last_modified?: Date;
  
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
  created_at: Date;
  updated_at: Date;
  conversion_started_at?: Date;
  conversion_completed_at?: Date;
  
  // Performance metrics
  source_node_count: number;
  source_connection_count: number;
  generated_code_size: number;
}

export interface CreateWorkflowConversionRequest {
  project_id: string;
  source_workflow: PentahoWorkflow;
  source_file_path?: string;
  source_file_size?: number;
  source_last_modified?: Date;
  conversion_type?: 'pyspark' | 'sql' | 'scala';
}

export interface UpdateWorkflowConversionRequest {
  conversion_status?: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  generated_code?: string;
  generated_notebook?: any;
  required_libraries?: string[];
  conversion_notes?: string[];
  estimated_complexity?: 'Low' | 'Medium' | 'High';
  ai_model_used?: string;
  ai_tokens_used?: number;
  ai_processing_time_ms?: number;
  databricks_notebook_path?: string;
  databricks_notebook_id?: string;
  lakebase_artifact_id?: string;
  error_message?: string;
  error_details?: any;
}

/**
 * Workflow Conversion Model
 * Handles CRUD operations for workflow conversions within projects
 */
export class WorkflowConversionModel {
  /**
   * Create a new workflow conversion
   */
  static async create(conversionData: CreateWorkflowConversionRequest): Promise<WorkflowConversion> {
    const id = randomUUID();
    const now = new Date();
    
    const query = `
      INSERT INTO workflow_conversions (
        id, project_id, source_workflow_name, source_workflow_type,
        source_file_path, source_file_size, source_last_modified,
        conversion_status, conversion_type, required_libraries, conversion_notes,
        source_node_count, source_connection_count, retry_count,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING *
    `;
    
    const values = [
      id,
      conversionData.project_id,
      conversionData.source_workflow.name,
      conversionData.source_workflow.type,
      conversionData.source_file_path || null,
      conversionData.source_file_size || null,
      conversionData.source_last_modified || null,
      'pending',
      conversionData.conversion_type || 'pyspark',
      JSON.stringify([]),
      JSON.stringify([]),
      conversionData.source_workflow.nodes?.length || 0,
      conversionData.source_workflow.connections?.length || 0,
      0,
      now,
      now
    ];

    const result = await dbService.query(query, values);
    return result.rows[0];
  }

  /**
   * Get all conversions for a project
   */
  static async findByProjectId(projectId: string, limit: number = 100, offset: number = 0): Promise<{conversions: WorkflowConversion[], total: number}> {
    // Get total count
    const countResult = await dbService.query(
      'SELECT COUNT(*) as count FROM workflow_conversions WHERE project_id = $1',
      [projectId]
    );
    const total = parseInt(countResult.rows[0].count);

    // Get conversions
    const query = `
      SELECT * FROM workflow_conversions 
      WHERE project_id = $1
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    const result = await dbService.query(query, [projectId, limit, offset]);
    
    return {
      conversions: result.rows,
      total
    };
  }

  /**
   * Get a conversion by ID
   */
  static async findById(id: string): Promise<WorkflowConversion | null> {
    const query = 'SELECT * FROM workflow_conversions WHERE id = $1';
    const result = await dbService.query(query, [id]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get existing conversion by workflow name and project
   */
  static async findByWorkflowName(projectId: string, workflowName: string): Promise<WorkflowConversion | null> {
    const query = `
      SELECT * FROM workflow_conversions 
      WHERE project_id = $1 AND source_workflow_name = $2 AND conversion_status = 'completed'
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const result = await dbService.query(query, [projectId, workflowName]);
    
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Update a workflow conversion
   */
  static async update(id: string, updateData: UpdateWorkflowConversionRequest): Promise<WorkflowConversion | null> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic SET clause
    if (updateData.conversion_status !== undefined) {
      setClause.push(`conversion_status = $${paramIndex++}`);
      values.push(updateData.conversion_status);
      
      // Set timestamps based on status
      if (updateData.conversion_status === 'processing') {
        setClause.push(`conversion_started_at = CURRENT_TIMESTAMP`);
      } else if (updateData.conversion_status === 'completed' || updateData.conversion_status === 'failed') {
        setClause.push(`conversion_completed_at = CURRENT_TIMESTAMP`);
      }
    }

    if (updateData.generated_code !== undefined) {
      setClause.push(`generated_code = $${paramIndex++}`);
      values.push(updateData.generated_code);
      
      // Calculate code size
      setClause.push(`generated_code_size = $${paramIndex++}`);
      values.push(updateData.generated_code?.length || 0);
    }

    if (updateData.generated_notebook !== undefined) {
      setClause.push(`generated_notebook = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.generated_notebook));
    }

    if (updateData.required_libraries !== undefined) {
      setClause.push(`required_libraries = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.required_libraries));
    }

    if (updateData.conversion_notes !== undefined) {
      setClause.push(`conversion_notes = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.conversion_notes));
    }

    if (updateData.estimated_complexity !== undefined) {
      setClause.push(`estimated_complexity = $${paramIndex++}`);
      values.push(updateData.estimated_complexity);
    }

    if (updateData.ai_model_used !== undefined) {
      setClause.push(`ai_model_used = $${paramIndex++}`);
      values.push(updateData.ai_model_used);
    }

    if (updateData.ai_tokens_used !== undefined) {
      setClause.push(`ai_tokens_used = $${paramIndex++}`);
      values.push(updateData.ai_tokens_used);
    }

    if (updateData.ai_processing_time_ms !== undefined) {
      setClause.push(`ai_processing_time_ms = $${paramIndex++}`);
      values.push(updateData.ai_processing_time_ms);
    }

    if (updateData.databricks_notebook_path !== undefined) {
      setClause.push(`databricks_notebook_path = $${paramIndex++}`);
      values.push(updateData.databricks_notebook_path);
    }

    if (updateData.databricks_notebook_id !== undefined) {
      setClause.push(`databricks_notebook_id = $${paramIndex++}`);
      values.push(updateData.databricks_notebook_id);
    }

    if (updateData.lakebase_artifact_id !== undefined) {
      setClause.push(`lakebase_artifact_id = $${paramIndex++}`);
      values.push(updateData.lakebase_artifact_id);
    }

    if (updateData.error_message !== undefined) {
      setClause.push(`error_message = $${paramIndex++}`);
      values.push(updateData.error_message);
    }

    if (updateData.error_details !== undefined) {
      setClause.push(`error_details = $${paramIndex++}`);
      values.push(JSON.stringify(updateData.error_details));
    }

    // Always update the updated_at timestamp
    setClause.push(`updated_at = CURRENT_TIMESTAMP`);

    if (setClause.length === 1) { // Only updated_at was added
      return await WorkflowConversionModel.findById(id);
    }

    values.push(id);
    const query = `
      UPDATE workflow_conversions 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await dbService.query(query, values);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Delete a workflow conversion
   */
  static async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM workflow_conversions WHERE id = $1';
    const result = await dbService.query(query, [id]);
    
    return result.rowCount > 0;
  }

  /**
   * Create conversion from PySpark conversion result
   */
  static async createFromPySparkConversion(
    projectId: string,
    sourceWorkflow: PentahoWorkflow,
    conversion: PySparkConversion,
    aiModel: string,
    processingTimeMs: number
  ): Promise<WorkflowConversion> {
    const id = randomUUID();
    const now = new Date();
    
    const query = `
      INSERT INTO workflow_conversions (
        id, project_id, source_workflow_name, source_workflow_type,
        conversion_status, conversion_type, generated_code, generated_notebook,
        required_libraries, conversion_notes, estimated_complexity,
        ai_model_used, ai_processing_time_ms,
        source_node_count, source_connection_count, generated_code_size,
        retry_count, created_at, updated_at, conversion_started_at, conversion_completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *
    `;
    
    const values = [
      id,
      projectId,
      sourceWorkflow.name,
      sourceWorkflow.type,
      conversion.success ? 'completed' : 'failed',
      'pyspark',
      conversion.pysparkCode,
      JSON.stringify(conversion.databricksNotebook),
      JSON.stringify(conversion.requiredLibraries),
      JSON.stringify(conversion.conversionNotes),
      conversion.estimatedComplexity,
      aiModel,
      processingTimeMs,
      sourceWorkflow.nodes?.length || 0,
      sourceWorkflow.connections?.length || 0,
      conversion.pysparkCode?.length || 0,
      0,
      now,
      now,
      now,
      now
    ];

    const result = await dbService.query(query, values);
    return result.rows[0];
  }

  /**
   * Get conversions by status
   */
  static async findByStatus(status: string, limit: number = 50): Promise<WorkflowConversion[]> {
    const query = `
      SELECT * FROM workflow_conversions 
      WHERE conversion_status = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    const result = await dbService.query(query, [status, limit]);
    return result.rows;
  }

  /**
   * Get project conversion statistics
   */
  static async getProjectConversionStats(projectId: string): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    processing: number;
    byComplexity: { [key: string]: number };
    averageProcessingTime: number;
  }> {
    const query = `
      SELECT 
        conversion_status,
        estimated_complexity,
        ai_processing_time_ms
      FROM workflow_conversions 
      WHERE project_id = $1
    `;
    
    const result = await dbService.query(query, [projectId]);
    const conversions = result.rows;

    const stats = {
      total: conversions.length,
      completed: 0,
      failed: 0,
      pending: 0,
      processing: 0,
      byComplexity: { Low: 0, Medium: 0, High: 0 },
      averageProcessingTime: 0
    };

    let totalProcessingTime = 0;
    let processedCount = 0;

    conversions.forEach((conv: any) => {
      // Count by status
      switch (conv.conversion_status) {
        case 'completed': stats.completed++; break;
        case 'failed': stats.failed++; break;
        case 'processing': stats.processing++; break;
        case 'pending': stats.pending++; break;
      }

      // Count by complexity
      if (conv.estimated_complexity && ['Low', 'Medium', 'High'].includes(conv.estimated_complexity)) {
        const complexity = conv.estimated_complexity as 'Low' | 'Medium' | 'High';
        stats.byComplexity[complexity] = (stats.byComplexity[complexity] || 0) + 1;
      }

      // Calculate average processing time
      if (conv.ai_processing_time_ms) {
        totalProcessingTime += conv.ai_processing_time_ms;
        processedCount++;
      }
    });

    if (processedCount > 0) {
      stats.averageProcessingTime = Math.round(totalProcessingTime / processedCount);
    }

    return stats;
  }

  /**
   * Retry a failed conversion
   */
  static async retry(id: string): Promise<WorkflowConversion | null> {
    const query = `
      UPDATE workflow_conversions 
      SET 
        conversion_status = 'pending',
        error_message = NULL,
        error_details = NULL,
        retry_count = retry_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await dbService.query(query, [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }
}
