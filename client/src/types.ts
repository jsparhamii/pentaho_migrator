export interface StepSummary {
  summary: string;
  purpose: string;
  inputs: string[];
  outputs: string[];
  keySettings: Record<string, any>;
}

export interface WorkflowSummary {
  summary: string;
  purpose: string;
  overallInputs: string[];
  overallOutputs: string[];
  keySteps: string[];
  dataFlow: string;
  businessValue: string;
  complexity: 'Low' | 'Medium' | 'High';
  stepCount: number;
  connectionCount: number;
}

export interface PentahoNode {
  id: string;
  name: string;
  type: 'step' | 'job' | 'start' | 'end';
  stepType?: string;
  position?: {
    x: number;
    y: number;
  };
  properties: Record<string, any>;
  description?: string;
  aiSummary?: StepSummary;
}

export interface PentahoConnection {
  id: string;
  from: string;
  to: string;
  type?: 'hop' | 'flow' | 'error';
  enabled?: boolean;
  condition?: string;
}

export interface DatabaseConnection {
  name: string;
  type: string;
  server?: string;
  database?: string;
  port?: string;
  username?: string;
}

export interface PentahoWorkflow {
  name: string;
  description?: string;
  type: 'transformation' | 'job';
  nodes: PentahoNode[];
  connections: PentahoConnection[];
  databaseConnections?: DatabaseConnection[];
  parameters?: Record<string, any>;
  metadata?: {
    created?: string;
    modified?: string;
    version?: string;
    author?: string;
  };
  workflowSummary?: WorkflowSummary;
}

export interface ParseResult {
  success: boolean;
  fileName: string;
  fileType: string;
  workflow?: PentahoWorkflow;
  error?: string;
}

export interface FileReference {
  filePath: string;
  fileName: string;
  referenceType: 'job_entry' | 'transformation_call' | 'sub_transformation' | 'script_reference';
  stepName?: string;
  entryName?: string;
}

export interface PentahoFile {
  fileName: string;
  filePath: string;
  type: 'transformation' | 'job';
  workflow: PentahoWorkflow;
  references: FileReference[];
  referencedBy: FileReference[];
}

export interface FolderWorkflow {
  folderName: string;
  files: PentahoFile[];
  dependencies: FileDependency[];
  metadata: {
    totalFiles: number;
    transformations: number;
    jobs: number;
    dependencies: number;
    parsed: string;
  };
}

export interface FileDependency {
  id: string;
  from: string; // file name
  to: string;   // file name
  type: 'calls' | 'includes' | 'executes';
  details?: string;
}

export interface FolderParseResult {
  success: boolean;
  folderName: string;
  folderWorkflow?: FolderWorkflow;
  individualFiles?: ParseResult[];
  error?: string;
}
