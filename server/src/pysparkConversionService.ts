import { PentahoWorkflow, PentahoNode } from './types';

export interface PySparkConversion {
  success: boolean;
  pysparkCode: string;
  originalWorkflow: string;
  conversionNotes: string[];
  estimatedComplexity: 'Low' | 'Medium' | 'High';
  requiredLibraries: string[];
  databricksNotebook: DatabricksNotebook;
}

export interface DatabricksNotebook {
  version: string;
  origId: number;
  language: string;
  title: string;
  commands: DatabricksCommand[];
}

export interface DatabricksCommand {
  version: string;
  origId: number;
  guid: string;
  subtype: string;
  commandType: string;
  position: number;
  command: string;
  commentThread: any[];
  commentsVisible: boolean;
  parentHierarchy: any[];
  diffInserts: any[];
  diffDeletes: any[];
  globalVars: Record<string, any>;
  latestUser: string;
  height: string;
  width: string;
  xPos: number;
  yPos: number;
  commandTitle: string;
  showCommandTitle: boolean;
  hideCommandCode: boolean;
  hideCommandResult: boolean;
  bindings: Record<string, any>;
  displayType: string;
  results: any;
  startTime: number;
  submitTime: number;
  finishTime: number;
  state: string;
  errorSummary: string;
  error: string;
  workflows: any[];
  ipythonMetadata: any;
}

/**
 * PySpark Conversion Service for converting Pentaho workflows to PySpark code
 */
export class PySparkConversionService {
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
   * Check if conversion service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Convert a Pentaho workflow to PySpark code
   */
  async convertToPySpark(workflow: PentahoWorkflow): Promise<PySparkConversion> {
    if (!this.isAvailable()) {
      return this.generateFallbackConversion(workflow);
    }

    try {
      console.log(`🔄 Converting workflow to PySpark: ${workflow.name}`);
      
      const prompt = this.buildConversionPrompt(workflow);
      const response = await this.callLLM(prompt);
      const conversion = this.parseConversionResponse(response, workflow);
      
      console.log(`✅ PySpark conversion completed for: ${workflow.name}`);
      return conversion;
    } catch (error) {
      console.error('Error converting to PySpark:', error);
      return this.generateFallbackConversion(workflow);
    }
  }

  /**
   * Build the conversion prompt for the LLM
   */
  private buildConversionPrompt(workflow: PentahoWorkflow): string {
    const workflowContext = {
      name: workflow.name,
      type: workflow.type,
      description: workflow.description,
      nodes: workflow.nodes.map(node => ({
        id: node.id,
        name: node.name,
        stepType: node.stepType,
        type: node.type,
        properties: this.extractRelevantProperties(node.properties)
      })),
      connections: workflow.connections.map(conn => ({
        from: conn.from,
        to: conn.to,
        type: conn.type,
        enabled: conn.enabled
      }))
    };

    return `You are an expert in converting Pentaho Data Integration (Kettle) workflows to PySpark code for Databricks.

TASK: Convert the following Pentaho workflow to equivalent PySpark code that can run on Databricks.

WORKFLOW DETAILS:
${JSON.stringify(workflowContext, null, 2)}

CONVERSION REQUIREMENTS:
1. Convert each Pentaho step to equivalent PySpark operations
2. Maintain the same data flow and transformations
3. Use Databricks-optimized patterns and functions
4. Handle data types and schemas appropriately
5. Include error handling where applicable
6. Add comments explaining the conversion logic
7. Ensure the code is production-ready and follows best practices

STEP TYPE MAPPINGS TO CONSIDER:
- Table Input → spark.read from various sources (JDBC, files, etc.)
- Text File Input → spark.read.text() or spark.read.csv()
- Text File Output → df.write.mode().format().save()
- Select Values → df.select() with column transformations
- Filter Rows → df.filter() or df.where()
- Sort Rows → df.orderBy()
- Group By → df.groupBy().agg()
- Join → df.join() with appropriate join types
- Modified Java Script Value → Custom UDFs or complex transformations
- Calculator → df.withColumn() with expressions
- Value Mapper → df.replace() or when/otherwise logic
- Split Fields → df.select() with split functions
- Database Lookup → Join operations or broadcast variables
- Stream Lookup → Broadcast joins
- Merge Join → df.join() with merge logic

RESPONSE FORMAT:
Respond with a valid JSON object containing:
{
  "success": true,
  "pysparkCode": "# Complete PySpark code here",
  "conversionNotes": ["Note about conversion approach", "Assumptions made", etc.],
  "estimatedComplexity": "Low|Medium|High",
  "requiredLibraries": ["pyspark.sql", "pyspark.sql.functions", etc.]
}

IMPORTANT: 
- The pysparkCode should be complete and runnable
- Include all necessary imports at the top
- Use proper DataFrame operations and avoid RDD operations when possible
- Include data validation and error handling
- Add meaningful variable names and comments
- Consider performance optimizations like caching for reused DataFrames

Convert the workflow now:`;
  }

  /**
   * Parse the LLM response and create PySparkConversion object
   */
  private parseConversionResponse(response: string, workflow: PentahoWorkflow): PySparkConversion {
    try {
      // Strip markdown code blocks if present
      const cleanResponse = response.replace(/```json\s*|\s*```/g, '').trim();
      const parsed = JSON.parse(cleanResponse);

      const conversion: PySparkConversion = {
        success: parsed.success || true,
        pysparkCode: parsed.pysparkCode || '# Conversion failed',
        originalWorkflow: workflow.name,
        conversionNotes: parsed.conversionNotes || ['Converted using AI'],
        estimatedComplexity: parsed.estimatedComplexity || 'Medium',
        requiredLibraries: parsed.requiredLibraries || ['pyspark.sql'],
        databricksNotebook: this.createDatabricksNotebook(
          parsed.pysparkCode,
          workflow.name,
          parsed.conversionNotes
        )
      };

      return conversion;
    } catch (error) {
      console.error('Error parsing conversion response:', error);
      return this.generateFallbackConversion(workflow);
    }
  }

  /**
   * Create a Databricks notebook format from the PySpark code
   */
  private createDatabricksNotebook(pysparkCode: string, workflowName: string, notes: string[]): DatabricksNotebook {
    const commands: DatabricksCommand[] = [];
    let position = 0;

    // Add header command
    commands.push(this.createCommand(
      position++,
      'md',
      `# ${workflowName} - Converted from Pentaho\n\nThis notebook was automatically converted from a Pentaho workflow.\n\n**Conversion Notes:**\n${notes.map(note => `- ${note}`).join('\n')}`
    ));

    // Split the code into logical sections
    const codeSections = this.splitCodeIntoSections(pysparkCode);
    
    for (const section of codeSections) {
      commands.push(this.createCommand(position++, 'python', section.code));
      
      if (section.description) {
        commands.push(this.createCommand(
          position++,
          'md',
          `### ${section.description}`
        ));
      }
    }

    return {
      version: '4.0',
      origId: Date.now(),
      language: 'python',
      title: `${workflowName}_converted`,
      commands
    };
  }

  /**
   * Create a Databricks command object
   */
  private createCommand(position: number, type: string, content: string): DatabricksCommand {
    return {
      version: '4.0',
      origId: Date.now() + position,
      guid: `command-${Date.now()}-${position}`,
      subtype: 'command',
      commandType: type,
      position,
      command: content,
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
    };
  }

  /**
   * Split code into logical sections for better notebook organization
   */
  private splitCodeIntoSections(code: string): Array<{code: string, description?: string}> {
    const sections = [];
    const lines = code.split('\n');
    let currentSection = '';
    let currentDescription = '';

    for (const line of lines) {
      if (line.trim().startsWith('# ===') || line.trim().startsWith('# ---')) {
        if (currentSection.trim()) {
          sections.push({
            code: currentSection.trim(),
            description: currentDescription
          });
        }
        currentSection = '';
        currentDescription = line.replace(/^#\s*[=-]+\s*/, '').trim();
      } else {
        currentSection += line + '\n';
      }
    }

    if (currentSection.trim()) {
      sections.push({
        code: currentSection.trim(),
        description: currentDescription
      });
    }

    // If no sections found, return the whole code as one section
    if (sections.length === 0) {
      sections.push({ code: code.trim() });
    }

    return sections;
  }

  /**
   * Call the LLM API
   */
  private async callLLM(prompt: string): Promise<string> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 8000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`LLM API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || data.message || '';
  }

  /**
   * Extract relevant properties from node properties, limiting size
   */
  private extractRelevantProperties(properties: any): any {
    if (!properties) return {};

    // Convert to string and check size
    const propsString = JSON.stringify(properties);
    if (propsString.length <= 4096) {
      return properties;
    }

    // If too large, extract only key properties
    const relevantKeys = [
      'sql', 'query', 'table', 'schema', 'database', 'connection',
      'filename', 'filepath', 'format', 'separator', 'encoding',
      'field_name', 'field_type', 'field_format', 'field_length',
      'lookup_field', 'stream_field', 'value_name', 'value_rename',
      'condition', 'filter', 'expression', 'function', 'script',
      'join_type', 'key_field1', 'key_field2', 'comparator'
    ];

    const extracted: any = {};
    for (const key of relevantKeys) {
      if (key in properties) {
        extracted[key] = properties[key];
      }
    }

    // If still too large, truncate
    const extractedString = JSON.stringify(extracted);
    if (extractedString.length > 4096) {
      const truncated = extractedString.substring(0, 4000);
      return JSON.parse(truncated + '"}');
    }

    return extracted;
  }

  /**
   * Generate a fallback conversion when AI is not available
   */
  private generateFallbackConversion(workflow: PentahoWorkflow): PySparkConversion {
    const fallbackCode = this.generateBasicPySparkTemplate(workflow);
    
    return {
      success: false,
      pysparkCode: fallbackCode,
      originalWorkflow: workflow.name,
      conversionNotes: [
        'AI conversion service not available',
        'Basic template generated based on workflow structure',
        'Manual review and completion required'
      ],
      estimatedComplexity: 'High',
      requiredLibraries: ['pyspark.sql', 'pyspark.sql.functions'],
      databricksNotebook: this.createDatabricksNotebook(fallbackCode, workflow.name, [
        'Basic template - requires manual completion'
      ])
    };
  }

  /**
   * Generate a basic PySpark template when AI is not available
   */
  private generateBasicPySparkTemplate(workflow: PentahoWorkflow): string {
    const template = `# ${workflow.name} - Pentaho to PySpark Conversion Template
# Generated: ${new Date().toISOString()}
# Original Type: ${workflow.type}

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# Initialize Spark Session
spark = SparkSession.builder \\
    .appName("${workflow.name}") \\
    .getOrCreate()

# TODO: Implement the following steps from your Pentaho workflow:
${workflow.nodes.map(node => `
# Step: ${node.name} (${node.stepType})
# TODO: Convert ${node.stepType} logic
# Original properties: ${JSON.stringify(node.properties, null, 2).substring(0, 200)}...
`).join('')}

# TODO: Implement workflow connections:
${workflow.connections.map(conn => `
# Connection: ${conn.from} → ${conn.to} (${conn.type})
`).join('')}

print("Conversion template generated - requires manual implementation")
`;

    return template;
  }
}

// Export singleton instance
export const pysparkConversionService = new PySparkConversionService();
