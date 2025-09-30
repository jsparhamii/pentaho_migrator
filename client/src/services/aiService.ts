import axios from 'axios';
import { PentahoNode, StepSummary, PentahoWorkflow, WorkflowSummary } from '../types';

export interface PySparkConversion {
  success: boolean;
  pysparkCode: string;
  originalWorkflow: string;
  conversionNotes: string[];
  estimatedComplexity: 'Low' | 'Medium' | 'High';
  requiredLibraries: string[];
  databricksNotebook: any;
}

export interface ConversionStatus {
  available: boolean;
  provider: string;
  model: string;
  features: string[];
}

export interface ConversionResponse {
  success: boolean;
  conversion?: PySparkConversion;
  error?: string;
}

export interface AIStatus {
  available: boolean;
  provider: string;
  model: string;
}

export interface SummaryResponse {
  success: boolean;
  summary: StepSummary;
  aiAvailable: boolean;
}

export interface WorkflowSummaryResponse {
  success: boolean;
  workflowSummary: WorkflowSummary;
  aiAvailable: boolean;
  chunked: boolean;
}

class AIService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3001/api';
  }

  /**
   * Check if AI services are available
   */
  async getAIStatus(): Promise<AIStatus> {
    try {
      const response = await axios.get(`${this.baseURL}/ai-status`);
      return response.data;
    } catch (error) {
      console.error('Error checking AI status:', error);
      return {
        available: false,
        provider: 'unknown',
        model: 'unknown'
      };
    }
  }

  /**
   * Generate AI summary for a step
   */
  async generateSummary(step: PentahoNode): Promise<StepSummary | null> {
    try {
      const response = await axios.post<SummaryResponse>(`${this.baseURL}/generate-summary`, {
        step
      });

      if (response.data.success) {
        return response.data.summary;
      }

      throw new Error('Failed to generate summary');
    } catch (error) {
      console.error('Error generating AI summary:', error);
      
      // Return fallback summary on error
      return this.generateFallbackSummary(step);
    }
  }

  /**
   * Generate a simple fallback summary when AI is not available
   */
  private generateFallbackSummary(step: PentahoNode): StepSummary {
    const stepType = step.stepType || step.type;
    
    return {
      summary: `${step.name} is a ${stepType} step that processes data`,
      purpose: 'Data processing',
      inputs: ['Input data'],
      outputs: ['Processed data'],
      keySettings: {
        stepType: stepType,
        configured: Object.keys(step.properties).length > 0
      }
    };
  }

  /**
   * Generate AI summary for an entire workflow
   */
  async generateWorkflowSummary(workflow: PentahoWorkflow): Promise<WorkflowSummary | null> {
    try {
      console.log(`🔄 Requesting workflow summary for: ${workflow.name}`);
      
      const response = await axios.post<WorkflowSummaryResponse>(`${this.baseURL}/generate-workflow-summary`, {
        workflow
      });

      if (response.data.success) {
        console.log(`✅ Workflow summary generated (chunked: ${response.data.chunked})`);
        return response.data.workflowSummary;
      }

      throw new Error('Failed to generate workflow summary');
    } catch (error) {
      console.error('Error generating workflow AI summary:', error);
      
      // Return fallback summary on error
      return this.generateFallbackWorkflowSummary(workflow);
    }
  }

  /**
   * Generate a simple fallback workflow summary when AI is not available
   */
  private generateFallbackWorkflowSummary(workflow: PentahoWorkflow): WorkflowSummary {
    const nodes = workflow.nodes || [];
    const connections = workflow.connections || [];
    
    // Analyze node types to infer purpose
    const inputSteps = nodes.filter(n => 
      n.stepType?.toLowerCase().includes('input') || 
      n.type === 'start'
    );
    const outputSteps = nodes.filter(n => 
      n.stepType?.toLowerCase().includes('output') || 
      n.type === 'end'
    );
    const processingSteps = nodes.filter(n => 
      !inputSteps.includes(n) && !outputSteps.includes(n)
    );

    const complexity: 'Low' | 'Medium' | 'High' = 
      nodes.length <= 5 ? 'Low' : 
      nodes.length <= 15 ? 'Medium' : 'High';

    return {
      summary: `${workflow.type === 'job' ? 'Job' : 'Transformation'} workflow with ${nodes.length} steps processing data through ${connections.length} connections`,
      purpose: workflow.description || `${workflow.type} for data processing`,
      overallInputs: inputSteps.length > 0 ? inputSteps.map(s => s.name) : ['Data sources'],
      overallOutputs: outputSteps.length > 0 ? outputSteps.map(s => s.name) : ['Processed data'],
      keySteps: processingSteps.slice(0, 5).map(s => s.name),
      dataFlow: `Data flows from ${inputSteps.length} input sources through ${processingSteps.length} processing steps to ${outputSteps.length} outputs`,
      businessValue: 'Automates data processing and transformation tasks',
      complexity,
      stepCount: nodes.length,
      connectionCount: connections.length
    };
  }

  /**
   * Generate summaries for multiple steps in batch
   */
  async generateBatchSummaries(steps: PentahoNode[]): Promise<Map<string, StepSummary>> {
    const summaries = new Map<string, StepSummary>();
    
    // Process in parallel with a limit to avoid overwhelming the API
    const batchSize = 3;
    for (let i = 0; i < steps.length; i += batchSize) {
      const batch = steps.slice(i, i + batchSize);
      const promises = batch.map(async (step) => {
        const summary = await this.generateSummary(step);
        if (summary) {
          summaries.set(step.id, summary);
        }
      });
      
      await Promise.all(promises);
      
      // Small delay between batches to be respectful to API rate limits
      if (i + batchSize < steps.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return summaries;
  }

  /**
   * Check if PySpark conversion services are available
   */
  async getConversionStatus(): Promise<ConversionStatus> {
    try {
      const response = await axios.get(`${this.baseURL}/conversion-status`);
      return response.data;
    } catch (error) {
      console.error('Error checking conversion status:', error);
      return {
        available: false,
        provider: 'unknown',
        model: 'unknown',
        features: []
      };
    }
  }

  /**
   * Convert a Pentaho workflow to PySpark code
   */
  async convertToPySpark(workflow: PentahoWorkflow): Promise<PySparkConversion | null> {
    try {
      console.log(`🔄 Requesting PySpark conversion for: ${workflow.name}`);

      const response = await axios.post(`${this.baseURL}/convert-to-pyspark`, {
        workflow
      });

      if (response.data.success || response.data.pysparkCode) {
        console.log(`✅ PySpark conversion completed for: ${workflow.name}`);
        return response.data;
      }

      throw new Error('Conversion failed');
    } catch (error) {
      console.error('Error converting to PySpark:', error);
      return null;
    }
  }

  /**
   * Download a Databricks notebook file
   */
  async downloadDatabricksNotebook(conversion: PySparkConversion): Promise<void> {
    try {
      const response = await axios.post(`${this.baseURL}/download-databricks-notebook`, {
        conversion
      }, {
        responseType: 'blob'
      });

      // Create a blob URL and trigger download
      const blob = new Blob([JSON.stringify(conversion.databricksNotebook, null, 2)], {
        type: 'application/json'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${conversion.databricksNotebook.title || 'converted_workflow'}.dbc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ Databricks notebook downloaded successfully');
    } catch (error) {
      console.error('Error downloading Databricks notebook:', error);
      throw new Error('Failed to download notebook');
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
