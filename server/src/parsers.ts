import fs from 'fs';
import path from 'path';
import { parseStringPromise } from 'xml2js';
import { PentahoWorkflow, PentahoNode, PentahoConnection, PentahoFile, FolderWorkflow } from './types';

export interface ParseResult {
  success: boolean;
  workflow?: PentahoWorkflow;
  folderWorkflow?: FolderWorkflow;
  error?: string;
}

/**
 * Parse a single Pentaho file (.ktr, .kjb, or .xml)
 */
export async function parseKettleFile(filePath: string, originalName: string): Promise<ParseResult> {
  try {
    console.log(`📊 Parsing file: ${originalName}`);
    
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' };
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    const fileExtension = path.extname(originalName).toLowerCase();
    
    // Handle different file types
    if (fileExtension === '.ktr') {
      return await parseTransformationFile(fileContent, originalName);
    } else if (fileExtension === '.kjb') {
      return await parseJobFile(fileContent, originalName);
    } else if (fileExtension === '.xml') {
      // Try to detect if it's a transformation or job
      if (fileContent.includes('<transformation>')) {
        return await parseTransformationFile(fileContent, originalName);
      } else if (fileContent.includes('<job>')) {
        return await parseJobFile(fileContent, originalName);
      } else {
        return { success: false, error: 'Unknown XML format - not a Pentaho transformation or job' };
      }
    } else {
      return { success: false, error: `Unsupported file type: ${fileExtension}` };
    }

  } catch (error) {
    console.error('Error parsing Kettle file:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown parsing error' 
    };
  }
}

/**
 * Parse a folder containing multiple Pentaho files
 */
export async function parseFolder(folderPath: string, folderName: string): Promise<ParseResult> {
  try {
    console.log(`📁 Parsing folder: ${folderName}`);
    
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder not found' };
    }

    const files = fs.readdirSync(folderPath);
    const pentahoFiles: PentahoFile[] = [];

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile()) {
        const fileExtension = path.extname(file).toLowerCase();
        
        if (['.ktr', '.kjb', '.xml'].includes(fileExtension)) {
          console.log(`  📄 Processing: ${file}`);
          
          const parseResult = await parseKettleFile(filePath, file);
          
          if (parseResult.success && parseResult.workflow) {
            pentahoFiles.push({
              fileName: file,
              filePath: filePath, // Add the missing filePath property
              type: parseResult.workflow.type, // Set the file type from the workflow type
              workflow: parseResult.workflow,
              size: stats.size,
              lastModified: stats.mtime.toISOString(),
              references: [], // TODO: Implement file reference analysis
              referencedBy: [] // TODO: Implement reverse reference analysis
            });
          } else {
            console.warn(`  ⚠️ Failed to parse: ${file} - ${parseResult.error}`);
          }
        }
      }
    }

    if (pentahoFiles.length === 0) {
      return { success: false, error: 'No valid Pentaho files found in folder' };
    }

    console.log(`✅ Successfully parsed ${pentahoFiles.length} files from folder: ${folderName}`);

    // Count transformations and jobs
    const transformations = pentahoFiles.filter(f => f.workflow.type === 'transformation').length;
    const jobs = pentahoFiles.filter(f => f.workflow.type === 'job').length;

    const dependencies = analyzeFolderDependencies(pentahoFiles);
    
    return {
      success: true,
      folderWorkflow: {
        folderName: folderName,
        files: pentahoFiles,
        dependencies: dependencies,
        metadata: {
          totalFiles: pentahoFiles.length,
          transformations: transformations,
          jobs: jobs,
          dependencies: dependencies.length,
          parsed: new Date().toISOString()
        }
      }
    };

  } catch (error) {
    console.error('Error parsing folder:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown folder parsing error' 
    };
  }
}

/**
 * Parse a Pentaho Transformation file (.ktr)
 */
async function parseTransformationFile(xmlContent: string, fileName: string): Promise<ParseResult> {
  try {
    const parsedXml = await parseStringPromise(xmlContent);
    const transformation = parsedXml.transformation;

    if (!transformation) {
      return { success: false, error: 'Invalid transformation format' };
    }

    const workflow: PentahoWorkflow = {
      name: transformation.info?.[0]?.name?.[0] || fileName,
      type: 'transformation',
      description: transformation.info?.[0]?.description?.[0] || '',
      nodes: [],
      connections: []
    };

    // Parse steps (nodes)
    if (transformation.step && Array.isArray(transformation.step)) {
      workflow.nodes = transformation.step.map((step: any, index: number) => {
        const node: PentahoNode = {
          id: step.name?.[0] || `step_${index}`,
          name: step.name?.[0] || `Step ${index + 1}`,
          type: step.type?.[0] || 'unknown',
          stepType: step.type?.[0] || 'unknown',
          position: {
            x: parseInt(step.GUI?.[0]?.xloc?.[0] || '100'),
            y: parseInt(step.GUI?.[0]?.yloc?.[0] || '100')
          },
          properties: step || {}
        };

        return node;
      });
    }

    // Parse hops (connections) - check multiple possible structures
    let connections: PentahoConnection[] = [];
    
    // Debug: log the transformation structure to understand the XML format
    console.log(`🔍 Debugging transformation structure for: ${workflow.name}`);
    console.log(`  🗂️ Available transformation keys:`, Object.keys(transformation));
    
    if (transformation.order) {
      console.log(`  📋 transformation.order:`, JSON.stringify(transformation.order, null, 2));
    }
    if (transformation.hops) {
      console.log(`  📋 transformation.hops:`, JSON.stringify(transformation.hops, null, 2));
    }
    
    // Check for other possible connection structures
    ['hop', 'connection', 'flow', 'edge'].forEach(key => {
      if (transformation[key]) {
        console.log(`  📋 transformation.${key}:`, JSON.stringify(transformation[key], null, 2));
      }
    });
    
    // Try transformation.order structure
    if (transformation.order && Array.isArray(transformation.order)) {
      connections = transformation.order.map((order: any, index: number) => {
        const conn = {
          id: `hop_${index}`,
          from: order.from?.[0] || '',
          to: order.to?.[0] || '',
          enabled: order.enabled?.[0] !== 'N',
          type: 'hop' as const
        };
        console.log(`  🔗 Order connection ${index}:`, conn);
        return conn;
      });
    }
    
    // Try transformation.order[0].hop structure (alternative format)
    else if (transformation.order?.[0]?.hop && Array.isArray(transformation.order[0].hop)) {
      connections = transformation.order[0].hop.map((hop: any, index: number) => {
        return {
          id: `hop_${index}`,
          from: hop.from?.[0] || '',
          to: hop.to?.[0] || '',
          enabled: hop.enabled?.[0] !== 'N',
          type: 'hop' as const
        };
      });
    }
    
    // Try transformation.hops structure (another possible format)
    else if (transformation.hops && transformation.hops[0] && transformation.hops[0].hop && Array.isArray(transformation.hops[0].hop)) {
      connections = transformation.hops[0].hop.map((hop: any, index: number) => {
        return {
          id: `hop_${index}`,
          from: hop.from?.[0] || '',
          to: hop.to?.[0] || '',
          enabled: hop.enabled?.[0] !== 'N',
          type: 'hop' as const
        };
      });
    }
    
    // Analyze comprehensive dependencies
    const dependencies = analyzeWorkflowDependencies(workflow, transformation);
    console.log(`🔍 Comprehensive dependency analysis for ${workflow.name}:`);
    console.log(`  📊 Step connections: ${dependencies.stepConnections.length}`);
    console.log(`  📁 File dependencies: ${dependencies.fileDependencies.length}`);
    console.log(`  🗄️ Database dependencies: ${dependencies.databaseDependencies.length}`);
    console.log(`  🔧 Variable dependencies: ${dependencies.variableDependencies.length}`);
    console.log(`  🔄 Sub-workflow dependencies: ${dependencies.subWorkflowDependencies.length}`);

    // Use enhanced connections if we found more than the original parsing
    if (dependencies.stepConnections.length > connections.length) {
      console.log(`🔄 Using enhanced connection parsing (found ${dependencies.stepConnections.length} vs ${connections.length})`);
      workflow.connections = dependencies.stepConnections.map((conn: any) => ({
        id: conn.id,
        from: conn.from,
        to: conn.to,
        enabled: conn.enabled,
        type: 'hop' as const
      }));
    } else {
      workflow.connections = connections;
    }

    console.log(`✅ Parsed transformation: ${workflow.name} (${workflow.nodes.length} steps, ${workflow.connections.length} hops)`);
    if (workflow.connections.length > 0) {
      console.log(`  🔗 Connections: ${workflow.connections.map(c => `${c.from} → ${c.to}`).join(', ')}`);
    }

    return { success: true, workflow };

  } catch (error) {
    console.error('Error parsing transformation XML:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'XML parsing error' 
    };
  }
}

/**
 * Parse a Pentaho Job file (.kjb)
 */
async function parseJobFile(xmlContent: string, fileName: string): Promise<ParseResult> {
  try {
    const parsedXml = await parseStringPromise(xmlContent);
    const job = parsedXml.job;

    if (!job) {
      return { success: false, error: 'Invalid job format' };
    }

    const workflow: PentahoWorkflow = {
      name: job.name?.[0] || fileName,
      type: 'job',
      description: job.description?.[0] || '',
      nodes: [],
      connections: []
    };

    // Parse entries (nodes)
    if (job.entries && job.entries[0] && job.entries[0].entry && Array.isArray(job.entries[0].entry)) {
      workflow.nodes = job.entries[0].entry.map((entry: any, index: number) => {
        const node: PentahoNode = {
          id: entry.name?.[0] || `entry_${index}`,
          name: entry.name?.[0] || `Entry ${index + 1}`,
          type: entry.type?.[0] || 'unknown',
          stepType: entry.type?.[0] || 'unknown',
          position: {
            x: parseInt(entry.xloc?.[0] || '100'),
            y: parseInt(entry.yloc?.[0] || '100')
          },
          properties: entry || {}
        };

        return node;
      });
    }

    // Parse hops (connections) - check multiple possible structures
    let connections: PentahoConnection[] = [];
    
    // Try job.hops[0].hop structure (standard format)
    if (job.hops && job.hops[0] && job.hops[0].hop && Array.isArray(job.hops[0].hop)) {
      connections = job.hops[0].hop.map((hop: any, index: number) => {
        return {
          id: `hop_${index}`,
          from: hop.from?.[0] || '',
          to: hop.to?.[0] || '',
          enabled: hop.enabled?.[0] !== 'N',
          type: 'hop' as const
        };
      });
    }
    
    // Try job.hops structure (alternative format)
    else if (job.hops && Array.isArray(job.hops)) {
      connections = job.hops.map((hop: any, index: number) => {
        return {
          id: `hop_${index}`,
          from: hop.from?.[0] || '',
          to: hop.to?.[0] || '',
          enabled: hop.enabled?.[0] !== 'N',
          type: 'hop' as const
        };
      });
    }
    
    // Try job.order structure (another possible format)
    else if (job.order && Array.isArray(job.order)) {
      connections = job.order.map((order: any, index: number) => {
        return {
          id: `hop_${index}`,
          from: order.from?.[0] || '',
          to: order.to?.[0] || '',
          enabled: order.enabled?.[0] !== 'N',
          type: 'hop' as const
        };
      });
    }
    
    workflow.connections = connections;

    console.log(`✅ Parsed job: ${workflow.name} (${workflow.nodes.length} entries, ${workflow.connections.length} hops)`);
    if (workflow.connections.length > 0) {
      console.log(`  🔗 Connections: ${workflow.connections.map(c => `${c.from} → ${c.to}`).join(', ')}`);
    }

    return { success: true, workflow };

  } catch (error) {
    console.error('Error parsing job XML:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'XML parsing error' 
    };
  }
}

/**
 * Analyze dependencies between files in a folder
 */
function analyzeFolderDependencies(files: PentahoFile[]): any[] {
  const dependencies: any[] = [];
  
  // Create a map of file names (without extension) for quick lookup
  const fileMap = new Map<string, string>();
  files.forEach(file => {
    const baseName = file.fileName.replace(/\.(ktr|kjb)$/, '');
    fileMap.set(baseName.toLowerCase(), file.fileName);
  });
  
  files.forEach(file => {
    const workflow = file.workflow;
    
    // Check job entries for transformation calls
    if (workflow.type === 'job') {
      workflow.nodes.forEach(node => {
        // Look for transformation entry types that call other files
        if (node.stepType === 'TRANS' || node.stepType === 'TRANSFORMATION') {
          // Check if the transformation name matches any file in the folder
          const transName = extractTransformationName(node.properties);
          if (transName) {
            const targetFile = findMatchingFile(transName, fileMap);
            if (targetFile) {
              dependencies.push({
                id: `${file.fileName}_to_${targetFile}`,
                from: file.fileName,
                to: targetFile,
                type: 'transformation_call',
                sourceStep: node.name
              });
            }
          }
        }
        
        // Look for job entry types that call other jobs
        if (node.stepType === 'JOB' || node.stepType === 'JOB_EXECUTOR') {
          const jobName = extractJobName(node.properties);
          if (jobName) {
            const targetFile = findMatchingFile(jobName, fileMap);
            if (targetFile) {
              dependencies.push({
                id: `${file.fileName}_to_${targetFile}`,
                from: file.fileName,
                to: targetFile,
                type: 'job_call',
                sourceStep: node.name
              });
            }
          }
        }
      });
    }
    
    // Check transformation steps for sub-transformation calls
    if (workflow.type === 'transformation') {
      workflow.nodes.forEach(node => {
        // Look for mapping or sub-transformation steps
        if (node.stepType === 'MappingInput' || node.stepType === 'MappingOutput' || 
            node.stepType === 'Mapping' || node.stepType === 'SubTrans') {
          const subTransName = extractSubTransformationName(node.properties);
          if (subTransName) {
            const targetFile = findMatchingFile(subTransName, fileMap);
            if (targetFile) {
              dependencies.push({
                id: `${file.fileName}_to_${targetFile}`,
                from: file.fileName,
                to: targetFile,
                type: 'sub_transformation',
                sourceStep: node.name
              });
            }
          }
        }
      });
    }
  });
  
  console.log(`🔗 Found ${dependencies.length} dependencies between files`);
  
  return dependencies;
}

/**
 * Extract transformation name from job entry properties
 */
function extractTransformationName(properties: any): string | null {
  // Look in various possible property locations
  if (properties.specification && properties.specification[0]) {
    return properties.specification[0];
  }
  if (properties.trans_object_id && properties.trans_object_id[0]) {
    return properties.trans_object_id[0];
  }
  if (properties.filename && properties.filename[0]) {
    const filename = properties.filename[0];
    return filename.replace(/^.*[\/\\]/, '').replace(/\.(ktr|kjb)$/, '');
  }
  if (properties.transname && properties.transname[0]) {
    return properties.transname[0];
  }
  return null;
}

/**
 * Extract job name from job entry properties
 */
function extractJobName(properties: any): string | null {
  if (properties.specification && properties.specification[0]) {
    return properties.specification[0];
  }
  if (properties.job_object_id && properties.job_object_id[0]) {
    return properties.job_object_id[0];
  }
  if (properties.filename && properties.filename[0]) {
    const filename = properties.filename[0];
    return filename.replace(/^.*[\/\\]/, '').replace(/\.(ktr|kjb)$/, '');
  }
  if (properties.jobname && properties.jobname[0]) {
    return properties.jobname[0];
  }
  return null;
}

/**
 * Extract sub-transformation name from transformation step properties
 */
function extractSubTransformationName(properties: any): string | null {
  if (properties.trans_name && properties.trans_name[0]) {
    return properties.trans_name[0];
  }
  if (properties.filename && properties.filename[0]) {
    const filename = properties.filename[0];
    return filename.replace(/^.*[\/\\]/, '').replace(/\.(ktr|kjb)$/, '');
  }
  if (properties.specification && properties.specification[0]) {
    return properties.specification[0];
  }
  return null;
}

/**
 * Find a matching file in the file map
 */
function findMatchingFile(targetName: string, fileMap: Map<string, string>): string | null {
  // Try exact match first
  const exactMatch = fileMap.get(targetName.toLowerCase());
  if (exactMatch) {
    return exactMatch;
  }
  
  // Try partial matches
  for (const [baseName, fileName] of fileMap.entries()) {
    if (baseName.includes(targetName.toLowerCase()) || targetName.toLowerCase().includes(baseName)) {
      return fileName;
    }
  }
  
  return null;
}

/**
 * Comprehensive dependency analysis for a workflow
 * Analyzes all types of dependencies as requested by the user
 */
function analyzeWorkflowDependencies(workflow: PentahoWorkflow, xmlData: any) {
  const dependencies = {
    stepConnections: [] as any[],
    fileDependencies: [] as any[],
    databaseDependencies: [] as any[],
    variableDependencies: [] as any[],
    subWorkflowDependencies: [] as any[]
  };

  // 1. Step-to-step dependencies (hops) - try alternative parsing methods
  if (xmlData.order && Array.isArray(xmlData.order)) {
    xmlData.order.forEach((order: any, index: number) => {
      if (order.hop && Array.isArray(order.hop)) {
        // Alternative structure: order contains hop arrays
        order.hop.forEach((hop: any, hopIndex: number) => {
          dependencies.stepConnections.push({
            id: `hop_${index}_${hopIndex}`,
            from: hop.from?.[0] || hop.from || '',
            to: hop.to?.[0] || hop.to || '',
            enabled: hop.enabled?.[0] !== 'N',
            type: 'step_hop'
          });
        });
      } else {
        // Direct order structure
        dependencies.stepConnections.push({
          id: `hop_${index}`,
          from: order.from?.[0] || order.from || '',
          to: order.to?.[0] || order.to || '',
          enabled: order.enabled?.[0] !== 'N',
          type: 'step_hop'
        });
      }
    });
  }

  // Alternative hop parsing - check for direct hop arrays
  if (xmlData.hop && Array.isArray(xmlData.hop)) {
    xmlData.hop.forEach((hop: any, index: number) => {
      dependencies.stepConnections.push({
        id: `direct_hop_${index}`,
        from: hop.from?.[0] || hop.from || '',
        to: hop.to?.[0] || hop.to || '',
        enabled: hop.enabled?.[0] !== 'N',
        type: 'step_hop'
      });
    });
  }

  // 2. External file dependencies (CSV, Excel, scripts, etc.)
  workflow.nodes.forEach(node => {
    const properties = node.properties || {};
    
    // CSV/Text file inputs
    if (node.stepType?.includes('Input') || node.stepType?.includes('File')) {
      const filename = extractFilePath(properties);
      if (filename) {
        dependencies.fileDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          filePath: filename,
          type: 'file_input',
          stepType: node.stepType
        });
      }
    }

    // CSV/Text file outputs
    if (node.stepType?.includes('Output') || node.stepType?.includes('Writer')) {
      const filename = extractFilePath(properties);
      if (filename) {
        dependencies.fileDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          filePath: filename,
          type: 'file_output',
          stepType: node.stepType
        });
      }
    }

    // Excel files
    if (node.stepType?.toLowerCase().includes('excel')) {
      const filename = extractFilePath(properties);
      if (filename) {
        dependencies.fileDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          filePath: filename,
          type: 'excel_file',
          stepType: node.stepType
        });
      }
    }

    // Script files
    if (node.stepType?.toLowerCase().includes('script') || 
        node.stepType?.toLowerCase().includes('javascript') ||
        node.stepType?.toLowerCase().includes('execute')) {
      const scriptPath = extractScriptPath(properties);
      if (scriptPath) {
        dependencies.fileDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          filePath: scriptPath,
          type: 'script_file',
          stepType: node.stepType
        });
      }
    }
  });

  // 3. Database connection dependencies
  workflow.nodes.forEach(node => {
    const properties = node.properties || {};
    
    // Database input/output steps
    if (node.stepType?.toLowerCase().includes('table') || 
        node.stepType?.toLowerCase().includes('database') ||
        node.stepType?.toLowerCase().includes('sql')) {
      
      const dbConnection = extractDatabaseConnection(properties);
      if (dbConnection) {
        dependencies.databaseDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          connectionName: dbConnection,
          type: 'database_connection',
          stepType: node.stepType
        });
      }
    }
  });

  // 4. Sub-transformations and jobs called from steps
  workflow.nodes.forEach(node => {
    const properties = node.properties || {};
    
    // Sub-transformation calls
    if (node.stepType === 'Mapping' || 
        node.stepType === 'SubTrans' ||
        node.stepType?.includes('Sub')) {
      
      const subTransName = extractSubTransformationName(properties);
      if (subTransName) {
        dependencies.subWorkflowDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          targetWorkflow: subTransName,
          type: 'sub_transformation',
          stepType: node.stepType
        });
      }
    }

    // Job calls from transformation
    if (node.stepType === 'JobExecutor' || 
        node.stepType?.includes('Job')) {
      
      const jobName = extractJobName(properties);
      if (jobName) {
        dependencies.subWorkflowDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          targetWorkflow: jobName,
          type: 'job_call',
          stepType: node.stepType
        });
      }
    }
  });

  // 5. Variables and parameters dependencies
  workflow.nodes.forEach(node => {
    const properties = node.properties || {};
    
    // Variable setters
    if (node.stepType?.toLowerCase().includes('variable') ||
        node.stepType?.toLowerCase().includes('parameter')) {
      
      const variables = extractVariables(properties);
      variables.forEach(variable => {
        dependencies.variableDependencies.push({
          nodeId: node.id,
          nodeName: node.name,
          variableName: variable.name,
          variableValue: variable.value,
          type: 'variable_setter',
          stepType: node.stepType
        });
      });
    }

    // Steps that use variables (check for ${...} patterns)
    const variableReferences = findVariableReferences(properties);
    variableReferences.forEach(varRef => {
      dependencies.variableDependencies.push({
        nodeId: node.id,
        nodeName: node.name,
        variableName: varRef,
        type: 'variable_user',
        stepType: node.stepType
      });
    });
  });

  return dependencies;
}

/**
 * Extract file path from step properties
 */
function extractFilePath(properties: any): string | null {
  const possiblePaths = [
    'filename', 'file', 'filepath', 'inputfile', 'outputfile',
    'file_name', 'input_file', 'output_file'
  ];
  
  for (const path of possiblePaths) {
    if (properties[path] && properties[path][0]) {
      return properties[path][0];
    }
  }
  return null;
}

/**
 * Extract script path from step properties
 */
function extractScriptPath(properties: any): string | null {
  const possiblePaths = [
    'script', 'scriptfile', 'script_file', 'filename', 'file'
  ];
  
  for (const path of possiblePaths) {
    if (properties[path] && properties[path][0]) {
      const value = properties[path][0];
      // Check if it looks like a script file
      if (value.includes('.js') || value.includes('.py') || value.includes('.sh') || value.includes('.bat')) {
        return value;
      }
    }
  }
  return null;
}

/**
 * Extract database connection from step properties
 */
function extractDatabaseConnection(properties: any): string | null {
  const possibleConnections = [
    'connection', 'database', 'db_connection', 'connection_name'
  ];
  
  for (const conn of possibleConnections) {
    if (properties[conn] && properties[conn][0]) {
      return properties[conn][0];
    }
  }
  return null;
}

/**
 * Extract variables from step properties
 */
function extractVariables(properties: any): Array<{name: string, value: string}> {
  const variables: Array<{name: string, value: string}> = [];
  
  // Check for variable definitions in various formats
  if (properties.field && Array.isArray(properties.field)) {
    properties.field.forEach((field: any) => {
      if (field.name && field.value) {
        variables.push({
          name: field.name[0] || field.name,
          value: field.value[0] || field.value
        });
      }
    });
  }
  
  return variables;
}

/**
 * Find variable references (${...} patterns) in properties
 */
function findVariableReferences(properties: any): string[] {
  const variables: string[] = [];
  const variablePattern = /\$\{([^}]+)\}/g;
  
  // Recursively search through all property values
  function searchObject(obj: any) {
    if (typeof obj === 'string') {
      let match;
      while ((match = variablePattern.exec(obj)) !== null) {
        variables.push(match[1]);
      }
    } else if (Array.isArray(obj)) {
      obj.forEach(searchObject);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.values(obj).forEach(searchObject);
    }
  }
  
  searchObject(properties);
  return [...new Set(variables)]; // Remove duplicates
}
