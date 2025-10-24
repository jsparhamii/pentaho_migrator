import { PentahoNode, PentahoWorkflow, WorkflowSummary } from './types';

export interface StepSummary {
  summary: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  keySettings: Record<string, any>;
}

export interface WorkflowChunk {
  id: string;
  nodes: PentahoNode[];
  connections: any[];
  chunkSummary?: string;
}

/**
 * AI Summary Service for generating human-readable explanations of Pentaho steps and workflows
 */
export class AISummaryService {
  private apiKey: string | undefined;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.DATABRICKS_TOKEN || process.env.OPENAI_API_KEY;
    this.model = process.env.AI_MODEL || 'databricks-claude-opus-4-1';
    
    // Construct full URL: baseUrl + model + /invocations
    const baseUrl = process.env.AI_BASE_URL || 'https://adb-984752964297111.11.azuredatabricks.net/serving-endpoints/';
    this.baseUrl = baseUrl.endsWith('/') 
      ? `${baseUrl}${this.model}/invocations`
      : `${baseUrl}/${this.model}/invocations`;
  }

  /**
   * Check if AI summarization is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Generate a summary for a Pentaho step
   */
  async generateStepSummary(step: PentahoNode): Promise<StepSummary | null> {
    if (!this.isAvailable()) {
      return this.generateFallbackSummary(step);
    }

    try {
      const prompt = this.buildPrompt(step);
      const response = await this.callLLM(prompt);
      return this.parseResponse(response, step);
    } catch (error) {
      console.error('Error generating AI summary:', error);
      return this.generateFallbackSummary(step);
    }
  }

  /**
   * Generate a comprehensive summary for an entire workflow
   */
  async generateWorkflowSummary(workflow: PentahoWorkflow): Promise<WorkflowSummary | null> {
    if (!this.isAvailable()) {
      return this.generateFallbackWorkflowSummary(workflow);
    }

    try {
      console.log(`🤖 Generating workflow summary for: ${workflow.name} (${workflow.nodes.length} nodes)`);
      
      // Check if workflow is too large and needs chunking
      const workflowSize = this.estimateWorkflowSize(workflow);
      
      if (workflowSize > 30000) { // 30KB threshold for chunking
        console.log(`📦 Large workflow detected (${workflowSize} chars), using chunking strategy`);
        return await this.generateChunkedWorkflowSummary(workflow);
      } else {
        // Generate summary in one shot
        const prompt = this.buildWorkflowPrompt(workflow);
        const response = await this.callLLM(prompt, 800); // Longer response for workflow summaries
        return this.parseWorkflowResponse(response, workflow);
      }
    } catch (error) {
      console.error('Error generating workflow AI summary:', error);
      return this.generateFallbackWorkflowSummary(workflow);
    }
  }

  /**
   * Build a prompt for the LLM based on the step properties
   */
  private buildPrompt(step: PentahoNode): string {
    const stepInfo = {
      name: step.name,
      type: step.stepType || step.type,
      properties: this.extractRelevantProperties(step.properties), // Still filter for size management
      description: step.description || 'No description available'
    };

    return `You are an expert Pentaho Data Integration (PDI/Kettle) analyst. This is a raw XML export from a Pentaho transformation/job file.

The data below is the ACTUAL Pentaho XML structure parsed into JSON. Each property contains the original XML values as arrays (Pentaho XML format).

PENTAHO STEP CONFIGURATION (from XML):
Name: ${stepInfo.name}
Type: ${stepInfo.type}
Description: ${stepInfo.description}

RAW PENTAHO XML DATA (as JSON):
${JSON.stringify(stepInfo.properties, null, 2)}

IMPORTANT PENTAHO XML NOTES:
- All XML values are in arrays (e.g., "name": ["value"])
- Look for specific Pentaho fields like: connection, sql, filename, tablename, fields, schema, etc.
- Database steps will have "connection" and may have "sql" or "table" fields
- File input/output steps will have "filename", "directory", or "file" fields
- Transform steps will have "fields" arrays defining column transformations
- Script steps will have "script" or "jsScripts" containing code

Based on this Pentaho XML configuration, please analyze:

1. What this step specifically does (be detailed about the actual function)
2. What data/files it processes as input
3. What it outputs or transforms
4. Key configuration parameters that affect its behavior
5. Any database connections, file paths, or external systems it interacts with
6. Data transformation logic (if any)

Provide a comprehensive analysis in JSON format (no markdown formatting):
{
  "summary": "Detailed 2-3 sentence explanation of what this step accomplishes",
  "purpose": "Primary business/technical function",
  "inputs": ["specific input types based on configuration"],
  "outputs": ["specific output types based on configuration"],
  "keySettings": {
    "setting1": "value and impact",
    "setting2": "value and impact"
  }
}`;
  }

  /**
   * Extract relevant properties for AI analysis (now more comprehensive)
   */
  private extractRelevantProperties(properties: Record<string, any>): Record<string, any> {
    // Return more complete properties but still manage size
    const jsonStr = JSON.stringify(properties);
    
    if (jsonStr.length > 8000) {
      // If too large, prioritize important properties but keep more context
      const relevant: Record<string, any> = {};
      
      // High priority properties for analysis
      const highPriorityKeys = [
        'sql', 'query', 'table', 'schema', 'connection', 'connectionName',
        'filename', 'filepath', 'directory', 'file', 'filePath',
        'field', 'fields', 'target_field', 'source_field', 'fieldName',
        'condition', 'expression', 'formula', 'calculation',
        'script', 'code', 'transformation', 'javascript',
        'host', 'port', 'database', 'username', 'databaseName',
        'separator', 'delimiter', 'encoding', 'format',
        'lookup_table', 'key_field', 'return_field',
        'value', 'default_value', 'replacement', 'newValue',
        'pattern', 'mask', 'type', 'stepType'
      ];
      
      // Include high priority properties
      for (const [key, value] of Object.entries(properties)) {
        const lowerKey = key.toLowerCase();
        if (highPriorityKeys.some(important => lowerKey.includes(important))) {
          relevant[key] = value;
        }
      }
      
      // Add some context properties even if not in high priority
      const contextKeys = ['name', 'description', 'enabled', 'distribute', 'copies'];
      for (const [key, value] of Object.entries(properties)) {
        if (contextKeys.includes(key.toLowerCase()) && !relevant[key]) {
          relevant[key] = value;
        }
      }
      
      return relevant;
    }
    
    return properties; // Return full properties if size is manageable
  }

  /**
   * Call the LLM API
   */
  private async callLLM(prompt: string, maxTokens: number = 500): Promise<string> {
    if (!this.apiKey) {
      throw new Error('No API key configured');
    }

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert Pentaho Data Integration (PDI/Kettle) analyst with deep knowledge of Pentaho XML formats, step types, and ETL patterns. You understand that Pentaho XML stores all values as arrays. Analyze configurations by reading the actual XML structure and provide detailed, technical summaries. Always respond with valid JSON only (no markdown formatting).'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: maxTokens,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response formats that Databricks might return
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      } else if (data.content) {
        return data.content;
      } else if (typeof data === 'string') {
        return data;
      } else {
        throw new Error('Unexpected response format from API');
      }
    } catch (error) {
      console.error('Error calling Databricks LLM:', error);
      throw error;
    }
  }

  /**
   * Parse the LLM response
   */
  private parseResponse(response: string, step: PentahoNode): StepSummary {
    try {
      // Handle markdown code blocks from LLM response
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      return {
        summary: parsed.summary || 'AI-generated summary not available',
        purpose: parsed.purpose || 'Purpose unclear',
        inputs: Array.isArray(parsed.inputs) ? parsed.inputs : ['Unknown'],
        outputs: Array.isArray(parsed.outputs) ? parsed.outputs : ['Unknown'],
        keySettings: parsed.keySettings || {}
      };
    } catch (error) {
      console.error('Error parsing LLM response:', error);
      console.error('Raw response:', response);
      return this.generateFallbackSummary(step);
    }
  }

  /**
   * Generate a rule-based summary when AI is not available
   */
  private generateFallbackSummary(step: PentahoNode): StepSummary {
    const stepType = step.stepType || step.type;
    const props = step.properties || {};

    let summary = 'Unknown step type';
    let purpose = 'Data processing';
    let inputs = ['Data'];
    let outputs = ['Processed data'];
    const keySettings: Record<string, any> = {};

    // Rule-based summaries for common step types
    switch (stepType?.toLowerCase()) {
      case 'tableinput':
      case 'table input':
        summary = 'Reads data from a database table using SQL queries';
        purpose = 'Data input from database';
        inputs = ['Database connection'];
        outputs = ['Table rows'];
        if (props.sql) keySettings.query = 'Custom SQL';
        if (props.connection) keySettings.database = props.connection;
        break;

      case 'tableoutput':
      case 'table output':
        summary = 'Writes data to a database table';
        purpose = 'Data output to database';
        inputs = ['Data rows'];
        outputs = ['Database records'];
        if (props.table) keySettings.targetTable = props.table;
        if (props.connection) keySettings.database = props.connection;
        break;

      case 'textfileinput':
      case 'csv file input':
        summary = 'Reads data from text/CSV files';
        purpose = 'File data input';
        inputs = ['Text/CSV files'];
        outputs = ['Parsed data rows'];
        if (props.filename) keySettings.file = props.filename;
        if (props.separator) keySettings.delimiter = props.separator;
        break;

      case 'textfileoutput':
      case 'csv file output':
        summary = 'Writes data to text/CSV files';
        purpose = 'File data output';
        inputs = ['Data rows'];
        outputs = ['Text/CSV files'];
        if (props.filename) keySettings.file = props.filename;
        break;

      case 'selectvalues':
      case 'select values':
        summary = 'Selects, renames, or removes fields from the data stream';
        purpose = 'Field selection and manipulation';
        inputs = ['Data with multiple fields'];
        outputs = ['Data with selected fields'];
        break;

      case 'filterrows':
      case 'filter rows':
        summary = 'Filters data rows based on specified conditions';
        purpose = 'Data filtering';
        inputs = ['All data rows'];
        outputs = ['Filtered data rows'];
        if (props.condition) keySettings.condition = props.condition;
        break;

      case 'calculator':
        summary = 'Performs calculations and creates new fields';
        purpose = 'Field calculations';
        inputs = ['Source fields'];
        outputs = ['Calculated fields'];
        break;

      case 'sort rows':
      case 'sortrows':
        summary = 'Sorts data rows by specified fields';
        purpose = 'Data sorting';
        inputs = ['Unsorted data'];
        outputs = ['Sorted data'];
        break;

      case 'merge join':
      case 'mergejoin':
        summary = 'Joins two data streams based on key fields';
        purpose = 'Data joining';
        inputs = ['Two data streams'];
        outputs = ['Joined data'];
        break;

      case 'group by':
      case 'groupby':
        summary = 'Groups data and performs aggregations';
        purpose = 'Data aggregation';
        inputs = ['Detail data'];
        outputs = ['Aggregated data'];
        break;

      default:
        summary = `${stepType} step for data processing`;
        if (props.sql || props.query) {
          summary = 'Executes SQL queries for data processing';
          purpose = 'SQL-based data processing';
        }
    }

    return {
      summary,
      purpose,
      inputs,
      outputs,
      keySettings
    };
  }

  /**
   * Estimate the size of a workflow for chunking decisions
   */
  private estimateWorkflowSize(workflow: PentahoWorkflow): number {
    return JSON.stringify({
      name: workflow.name,
      description: workflow.description,
      nodes: workflow.nodes,
      connections: workflow.connections,
      databaseConnections: workflow.databaseConnections,
      parameters: workflow.parameters
    }).length;
  }

  /**
   * Build a comprehensive prompt for workflow analysis
   */
  private buildWorkflowPrompt(workflow: PentahoWorkflow): string {
    const workflowInfo = {
      name: workflow.name,
      description: workflow.description || 'No description available',
      type: workflow.type,
      nodeCount: workflow.nodes.length,
      connectionCount: workflow.connections.length,
      nodes: workflow.nodes.map(node => ({
        id: node.id,
        name: node.name,
        type: node.type,
        stepType: node.stepType,
        description: node.description,
        keyProperties: this.extractRelevantProperties(node.properties)
      })),
      connections: workflow.connections,
      databaseConnections: workflow.databaseConnections || [],
      parameters: workflow.parameters || {}
    };

    return `You are an expert Pentaho Data Integration (PDI/Kettle) analyst. This is a complete Pentaho ${workflow.type} workflow with raw XML data parsed into JSON.

IMPORTANT: The data below comes from Pentaho XML where all values are stored as arrays (e.g., "name": ["value"]). Extract values from arrays when analyzing.

PENTAHO WORKFLOW CONFIGURATION:
Name: ${workflowInfo.name}
Type: ${workflowInfo.type}
Description: ${workflowInfo.description}
Total Steps/Entries: ${workflowInfo.nodeCount}
Connections/Hops: ${workflowInfo.connectionCount}

COMPLETE WORKFLOW STRUCTURE (from XML):
${JSON.stringify(workflowInfo, null, 2)}

PENTAHO-SPECIFIC ANALYSIS GUIDELINES:
- Look for database operations: check "connection", "sql", "table", "schema" fields
- Look for file operations: check "filename", "directory", "file" fields  
- Look for transformations: check "fields" arrays with field definitions
- Look for scripts: check "script", "jsScripts", or "execute" fields
- Understand data flow through connections/hops between steps
- Identify which steps are inputs (TableInput, TextFileInput, ExcelInput, etc.)
- Identify which steps are outputs (TableOutput, TextFileOutput, etc.)

Please analyze this Pentaho workflow and provide:

1. OVERALL PURPOSE: What business problem does this workflow solve?
2. DATA FLOW: Describe the high-level data flow from inputs to outputs
3. KEY STEPS: Identify the most important transformations/operations
4. INPUTS: What data sources, files, or systems does this workflow read from?
5. OUTPUTS: What data destinations, files, or systems does this workflow write to?
6. BUSINESS VALUE: What business value or insights does this workflow provide?
7. COMPLEXITY: Assess the technical complexity (Low/Medium/High)

Provide your analysis in JSON format (no markdown formatting):
{
  "summary": "2-3 sentence executive summary of what this workflow accomplishes",
  "purpose": "Primary business purpose and objectives",
  "overallInputs": ["specific input sources based on analysis"],
  "overallOutputs": ["specific output destinations based on analysis"],
  "keySteps": ["most important transformation steps"],
  "dataFlow": "Narrative description of how data flows through the workflow",
  "businessValue": "What business value this workflow provides",
  "complexity": "Low|Medium|High",
  "stepCount": ${workflowInfo.nodeCount},
  "connectionCount": ${workflowInfo.connectionCount}
}`;
  }

  /**
   * Generate chunked workflow summary for large workflows
   */
  private async generateChunkedWorkflowSummary(workflow: PentahoWorkflow): Promise<WorkflowSummary | null> {
    try {
      // Step 1: Create logical chunks based on workflow structure
      const chunks = this.createWorkflowChunks(workflow);
      console.log(`📦 Created ${chunks.length} chunks for analysis`);

      // Step 2: Generate summaries for each chunk
      const chunkSummaries: string[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`📝 Analyzing chunk ${i + 1}/${chunks.length}: ${chunk.nodes.length} nodes`);
        
        const chunkPrompt = this.buildChunkPrompt(chunk, i + 1, chunks.length);
        const chunkResponse = await this.callLLM(chunkPrompt, 400);
        
        // Extract just the summary part from the chunk response
        const cleanChunkResponse = this.cleanChunkResponse(chunkResponse);
        chunkSummaries.push(cleanChunkResponse);
        
        // Small delay to be respectful to API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Step 3: Generate final consolidated summary
      const finalPrompt = this.buildConsolidationPrompt(workflow, chunkSummaries);
      const finalResponse = await this.callLLM(finalPrompt, 800);
      
      return this.parseWorkflowResponse(finalResponse, workflow);
    } catch (error) {
      console.error('Error in chunked workflow summary:', error);
      return this.generateFallbackWorkflowSummary(workflow);
    }
  }

  /**
   * Create logical chunks for large workflows
   */
  private createWorkflowChunks(workflow: PentahoWorkflow): WorkflowChunk[] {
    const chunks: WorkflowChunk[] = [];
    const maxNodesPerChunk = 10; // Adjust based on testing
    
    // Group nodes by connected components or sequential groups
    const nodeGroups = this.groupConnectedNodes(workflow);
    
    for (let i = 0; i < nodeGroups.length; i++) {
      const group = nodeGroups[i];
      
      if (group.length <= maxNodesPerChunk) {
        // Small group - make it one chunk
        chunks.push({
          id: `chunk_${chunks.length + 1}`,
          nodes: group,
          connections: workflow.connections.filter(conn => 
            group.some(n => n.id === conn.from) && group.some(n => n.id === conn.to)
          )
        });
      } else {
        // Large group - split it further
        for (let j = 0; j < group.length; j += maxNodesPerChunk) {
          const subGroup = group.slice(j, j + maxNodesPerChunk);
          chunks.push({
            id: `chunk_${chunks.length + 1}`,
            nodes: subGroup,
            connections: workflow.connections.filter(conn => 
              subGroup.some(n => n.id === conn.from) && subGroup.some(n => n.id === conn.to)
            )
          });
        }
      }
    }
    
    return chunks;
  }

  /**
   * Group nodes by connectivity for logical chunking
   */
  private groupConnectedNodes(workflow: PentahoWorkflow): PentahoNode[][] {
    const visited = new Set<string>();
    const groups: PentahoNode[][] = [];
    
    // Create adjacency map
    const adjacencyMap = new Map<string, string[]>();
    workflow.connections.forEach(conn => {
      if (!adjacencyMap.has(conn.from)) adjacencyMap.set(conn.from, []);
      if (!adjacencyMap.has(conn.to)) adjacencyMap.set(conn.to, []);
      adjacencyMap.get(conn.from)!.push(conn.to);
      adjacencyMap.get(conn.to)!.push(conn.from);
    });
    
    // DFS to find connected components
    const dfs = (nodeId: string, currentGroup: PentahoNode[]) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (node) {
        currentGroup.push(node);
        
        const neighbors = adjacencyMap.get(nodeId) || [];
        neighbors.forEach(neighborId => dfs(neighborId, currentGroup));
      }
    };
    
    // Find all connected components
    workflow.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        const group: PentahoNode[] = [];
        dfs(node.id, group);
        if (group.length > 0) {
          groups.push(group);
        }
      }
    });
    
    return groups;
  }

  /**
   * Build prompt for individual chunk analysis
   */
  private buildChunkPrompt(chunk: WorkflowChunk, chunkIndex: number, totalChunks: number): string {
    return `You are analyzing chunk ${chunkIndex} of ${totalChunks} from a larger Pentaho workflow.

CHUNK DETAILS:
Nodes: ${chunk.nodes.length}
Connections: ${chunk.connections.length}

CHUNK DATA:
${JSON.stringify({
  nodes: chunk.nodes.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    stepType: node.stepType,
    keyProperties: this.extractRelevantProperties(node.properties)
  })),
  connections: chunk.connections
}, null, 2)}

Provide a brief summary of what this chunk accomplishes:
- What data operations happen here?
- Key transformations or processing steps
- How this chunk contributes to the overall workflow

Keep the response concise (2-3 sentences) since this will be combined with other chunk summaries.`;
  }

  /**
   * Clean chunk response to extract just the summary
   */
  private cleanChunkResponse(response: string): string {
    // Remove any JSON formatting if present and extract the core summary
    let cleaned = response.trim();
    
    // If it's JSON formatted, try to extract content
    if (cleaned.startsWith('{')) {
      try {
        const parsed = JSON.parse(cleaned);
        return parsed.summary || parsed.description || cleaned;
      } catch {
        // If parsing fails, use as-is
      }
    }
    
    return cleaned;
  }

  /**
   * Build consolidation prompt for final summary
   */
  private buildConsolidationPrompt(workflow: PentahoWorkflow, chunkSummaries: string[]): string {
    return `You are consolidating analysis of a Pentaho workflow that was analyzed in chunks.

WORKFLOW OVERVIEW:
Name: ${workflow.name}
Type: ${workflow.type}
Total Nodes: ${workflow.nodes.length}
Total Connections: ${workflow.connections.length}
Description: ${workflow.description || 'No description available'}

CHUNK ANALYSIS RESULTS:
${chunkSummaries.map((summary, index) => `Chunk ${index + 1}: ${summary}`).join('\n')}

DATABASE CONNECTIONS: ${JSON.stringify(workflow.databaseConnections || [])}
PARAMETERS: ${JSON.stringify(workflow.parameters || {})}

Based on all the chunk analyses, provide a comprehensive workflow summary in JSON format (no markdown formatting):
{
  "summary": "2-3 sentence executive summary of the complete workflow",
  "purpose": "Primary business purpose and objectives",
  "overallInputs": ["specific input sources from all chunks"],
  "overallOutputs": ["specific output destinations from all chunks"],
  "keySteps": ["most important transformation steps across all chunks"],
  "dataFlow": "How data flows through the entire workflow from start to finish",
  "businessValue": "What business value this complete workflow provides",
  "complexity": "Low|Medium|High",
  "stepCount": ${workflow.nodes.length},
  "connectionCount": ${workflow.connections.length}
}`;
  }

  /**
   * Parse workflow response from LLM
   */
  private parseWorkflowResponse(response: string, workflow: PentahoWorkflow): WorkflowSummary {
    try {
      // Handle markdown code blocks from LLM response
      let cleanResponse = response.trim();
      
      // Remove markdown code blocks if present
      if (cleanResponse.startsWith('```json')) {
        cleanResponse = cleanResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanResponse.startsWith('```')) {
        cleanResponse = cleanResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      const parsed = JSON.parse(cleanResponse);
      return {
        summary: parsed.summary || 'AI-generated workflow summary not available',
        purpose: parsed.purpose || 'Purpose unclear',
        overallInputs: Array.isArray(parsed.overallInputs) ? parsed.overallInputs : ['Unknown inputs'],
        overallOutputs: Array.isArray(parsed.overallOutputs) ? parsed.overallOutputs : ['Unknown outputs'],
        keySteps: Array.isArray(parsed.keySteps) ? parsed.keySteps : ['Key steps not identified'],
        dataFlow: parsed.dataFlow || 'Data flow description not available',
        businessValue: parsed.businessValue || 'Business value not identified',
        complexity: parsed.complexity === 'Low' || parsed.complexity === 'Medium' || parsed.complexity === 'High' 
          ? parsed.complexity : this.assessComplexity(workflow),
        stepCount: workflow.nodes.length,
        connectionCount: workflow.connections.length
      };
    } catch (error) {
      console.error('Error parsing workflow LLM response:', error);
      console.error('Raw response:', response);
      return this.generateFallbackWorkflowSummary(workflow);
    }
  }

  /**
   * Assess workflow complexity based on structure
   */
  private assessComplexity(workflow: PentahoWorkflow): 'Low' | 'Medium' | 'High' {
    const nodeCount = workflow.nodes.length;
    const connectionCount = workflow.connections.length;
    const dbConnections = (workflow.databaseConnections || []).length;
    
    if (nodeCount <= 5 && connectionCount <= 5) {
      return 'Low';
    } else if (nodeCount <= 15 && connectionCount <= 20) {
      return 'Medium';
    } else {
      return 'High';
    }
  }

  /**
   * Generate fallback workflow summary when AI is not available
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

    return {
      summary: `${workflow.type === 'job' ? 'Job' : 'Transformation'} workflow with ${nodes.length} steps processing data through ${connections.length} connections`,
      purpose: workflow.description || `${workflow.type} for data processing`,
      overallInputs: inputSteps.length > 0 ? inputSteps.map(s => s.name) : ['Data sources'],
      overallOutputs: outputSteps.length > 0 ? outputSteps.map(s => s.name) : ['Processed data'],
      keySteps: processingSteps.slice(0, 5).map(s => s.name),
      dataFlow: `Data flows from ${inputSteps.length} input sources through ${processingSteps.length} processing steps to ${outputSteps.length} outputs`,
      businessValue: 'Automates data processing and transformation tasks',
      complexity: this.assessComplexity(workflow),
      stepCount: nodes.length,
      connectionCount: connections.length
    };
  }
}

// Singleton instance
export const aiSummaryService = new AISummaryService();