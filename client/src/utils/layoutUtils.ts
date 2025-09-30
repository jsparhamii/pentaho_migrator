import dagre from 'dagre';
import { Node, Edge } from 'reactflow';
import { PentahoWorkflow, FolderWorkflow, PentahoNode, PentahoConnection, FileDependency } from '../types';

export interface LayoutResult {
  nodes: Node[];
  edges: Edge[];
}

export interface WorkflowAnalysis {
  totalSteps: number;
  totalConnections: number;
  stepTypes: { [key: string]: number };
  connectionTypes: { [key: string]: number };
  entryPoints: string[];
  endPoints: string[];
  isolatedNodes: string[];
}

export interface GraphAnalysis {
  totalFiles: number;
  totalDependencies: number;
  dependencyTypes: { [key: string]: number };
  entryPoints: string[];
  endPoints: string[];
  intermediateNodes: string[];
}

const nodeWidth = 180;
const nodeHeight = 40;

// Utility functions for safe positioning
function isValidNumber(value: any): value is number {
  return typeof value === 'number' && isFinite(value) && !isNaN(value);
}

function safePosition(x: number, y: number, fallbackX: number = 0, fallbackY: number = 0): { x: number; y: number } {
  return {
    x: isValidNumber(x) ? x : fallbackX,
    y: isValidNumber(y) ? y : fallbackY
  };
}

function createSimpleGridLayout(folderWorkflow: FolderWorkflow): LayoutResult {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  // Validate input
  if (!folderWorkflow || !folderWorkflow.files || folderWorkflow.files.length === 0) {
    console.warn('No folder files provided, returning empty grid layout');
    return { nodes, edges };
  }
  
  // Separate jobs and transformations for better organization
  const jobs = folderWorkflow.files.filter(f => f && f.type === 'job');
  const transformations = folderWorkflow.files.filter(f => f && f.type === 'transformation');
  
  // Create a more structured layout: jobs on left, transformations on right
  const nodeSpacing = 250; // Wider spacing for folder view
  const verticalSpacing = 150;
  
  // Position jobs on the left
  jobs.forEach((file, index) => {
    const position = safePosition(50, index * verticalSpacing + 50);
    nodes.push({
      id: file.fileName,
      type: 'folderNode',
      position,
      data: { file },
    });
  });
  
  // Position transformations in columns to the right
  const cols = Math.max(1, Math.ceil(Math.sqrt(transformations.length)));
  transformations.forEach((file, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    
    const x = (col + 1) * nodeSpacing + 300;
    const y = row * verticalSpacing + 50;
    const position = safePosition(x, y, 300 + index * 50, 50 + index * 30);
    
    nodes.push({
      id: file.fileName,
      type: 'folderNode',
      position,
      data: { file },
    });
  });
  
  // TODO: Add logic to detect file dependencies and create edges
  // For now, we'll analyze the file names and step properties to infer relationships
  
  return { nodes, edges };
}

export function createWorkflowLayout(workflow: PentahoWorkflow): LayoutResult {
  // Validate input
  if (!workflow || !workflow.nodes || workflow.nodes.length === 0) {
    console.warn('No workflow nodes provided, returning empty layout');
    return { nodes: [], edges: [] };
  }

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Set graph properties for Sankey-like flow layout
  dagreGraph.setGraph({ 
    rankdir: 'LR',      // Left to right flow
    ranksep: 150,       // More space between levels for Sankey look
    nodesep: 80,        // Vertical spacing between nodes
    marginx: 40,        
    marginy: 40,
    align: 'DL'         // Align nodes to the down-left for better flow
  });

  // Add nodes to dagre graph with validation
  workflow.nodes.forEach((node: PentahoNode) => {
    if (node && node.id) {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  // Add edges to dagre graph with validation
  workflow.connections?.forEach((connection: PentahoConnection) => {
    if (connection && connection.from && connection.to && connection.enabled !== false) {
      // Only add edge if both nodes exist
      if (dagreGraph.hasNode(connection.from) && dagreGraph.hasNode(connection.to)) {
        dagreGraph.setEdge(connection.from, connection.to);
      }
    }
  });

  // Calculate layout
  try {
    dagre.layout(dagreGraph);
  } catch (error) {
    console.warn('Dagre layout failed for workflow, using default positions:', error);
    // Continue with default node positions if dagre fails
  }

  // Convert to React Flow nodes
  const nodes: Node[] = workflow.nodes.map((node: PentahoNode, index: number) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Fallback positions if dagre layout failed
    const fallbackX = (index % 4) * (nodeWidth + 60) + 50;
    const fallbackY = Math.floor(index / 4) * (nodeHeight + 80) + 50;
    
    // Calculate safe position
    let x = fallbackX;
    let y = fallbackY;
    
    if (nodeWithPosition && isValidNumber(nodeWithPosition.x) && isValidNumber(nodeWithPosition.y)) {
      x = nodeWithPosition.x - nodeWidth / 2;
      y = nodeWithPosition.y - nodeHeight / 2;
    }
    
    const position = safePosition(x, y, fallbackX, fallbackY);
    
    return {
      id: node.id,
      type: 'pentaho',
      position,
      data: {
        ...node,
        label: node.name,
      },
    };
  });

  // Convert to React Flow edges with Sankey-like styling and validation
  const edges: Edge[] = workflow.connections?.filter((connection: PentahoConnection) => {
    // Only include edges with valid source and target nodes
    return connection && connection.id && connection.from && connection.to &&
           nodes.some(n => n.id === connection.from) &&
           nodes.some(n => n.id === connection.to);
  }).map((connection: PentahoConnection) => {
    const edgeType = connection.type || 'hop';
    const isEnabled = connection.enabled !== false;
    
    return {
      id: connection.id,
      source: connection.from,
      target: connection.to,
      type: 'smoothstep',          // Smooth flowing edges
      animated: edgeType === 'hop',
      style: {
        stroke: getEdgeColor(edgeType),
        strokeWidth: 1.5,          // Elegant, refined thickness
        strokeDasharray: isEnabled ? 'none' : '4,4',
        strokeLinecap: 'round',    // Rounded line caps
        strokeOpacity: 0.8,        // Subtle transparency for elegance
      },
      markerEnd: {                 // Elegant arrow markers
        type: 'arrowclosed',
        width: 12,                 // Smaller, more refined arrows
        height: 12,
        color: getEdgeColor(edgeType),
      },
      label: connection.condition || undefined,
      labelStyle: { 
        fontSize: 10, 
        fontWeight: 400,
        fill: '#6b7280',
        fontFamily: 'system-ui, sans-serif'
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.8,
        rx: 3,
        ry: 3
      },
    };
  }) || [];

  return { nodes, edges };
}

export function createHierarchicalLayout(folderWorkflow: FolderWorkflow): LayoutResult {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Set graph properties for hierarchical (Sankey-like) layout
  dagreGraph.setGraph({ 
    rankdir: 'LR', 
    ranksep: 120, 
    nodesep: 60,
    marginx: 30,
    marginy: 30
  });

  // Add file nodes to dagre graph
  folderWorkflow.files.forEach((file) => {
    dagreGraph.setNode(file.fileName, { width: nodeWidth, height: nodeHeight });
  });

  // Add dependency edges to dagre graph
  folderWorkflow.dependencies.forEach((dependency: FileDependency) => {
    dagreGraph.setEdge(dependency.from, dependency.to);
  });

  // If no dependencies, create a simple grid layout instead of using dagre
  if (folderWorkflow.dependencies.length === 0) {
    return createSimpleGridLayout(folderWorkflow);
  }

  // Calculate layout
  try {
    dagre.layout(dagreGraph);
  } catch (error) {
    console.warn('Dagre layout failed, falling back to grid layout:', error);
    return createSimpleGridLayout(folderWorkflow);
  }

  // Convert to React Flow nodes
  const nodes: Node[] = folderWorkflow.files.map((file) => {
    const nodeWithPosition = dagreGraph.node(file.fileName);
    
    return {
      id: file.fileName,
      type: 'folderNode',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      data: {
        file,
        label: file.fileName,
      },
    };
  });

  // Convert to React Flow edges with elegant styling
  const edges: Edge[] = folderWorkflow.dependencies.map((dependency: FileDependency) => {
    return {
      id: dependency.id,
      source: dependency.from,
      target: dependency.to,
      type: 'smoothstep',
      animated: false,
      style: {
        stroke: getDependencyColor(dependency.type),
        strokeWidth: 1.5,          // Elegant, refined thickness
        strokeOpacity: 0.8,        // Subtle transparency
        strokeLinecap: 'round',
      },
      markerEnd: {                 // Elegant arrow markers
        type: 'arrowclosed',
        width: 12,
        height: 12,
        color: getDependencyColor(dependency.type),
      },
      label: dependency.type,
      labelStyle: { 
        fontSize: 10, 
        fontWeight: 400,
        fill: '#6b7280',
        fontFamily: 'system-ui, sans-serif'
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.9,
        rx: 3,
        ry: 3
      },
    };
  });

  return { nodes, edges };
}

export function analyzeWorkflowStructure(workflow: PentahoWorkflow): WorkflowAnalysis {
  const stepTypes: { [key: string]: number } = {};
  const connectionTypes: { [key: string]: number } = {};
  const incomingConnections = new Set<string>();
  const outgoingConnections = new Set<string>();
  const allNodes = new Set(workflow.nodes.map(n => n.id));

  // Analyze step types
  workflow.nodes.forEach((node: PentahoNode) => {
    const type = node.stepType || node.type;
    stepTypes[type] = (stepTypes[type] || 0) + 1;
  });

  // Analyze connections
  workflow.connections.forEach((connection: PentahoConnection) => {
    const type = connection.type || 'hop';
    connectionTypes[type] = (connectionTypes[type] || 0) + 1;
    incomingConnections.add(connection.to);
    outgoingConnections.add(connection.from);
  });

  // Find entry points (nodes with no incoming connections)
  const entryPoints = Array.from(allNodes).filter(nodeId => !incomingConnections.has(nodeId));
  
  // Find end points (nodes with no outgoing connections)
  const endPoints = Array.from(allNodes).filter(nodeId => !outgoingConnections.has(nodeId));
  
  // Find isolated nodes (nodes with no connections at all)
  const connectedNodes = new Set([...incomingConnections, ...outgoingConnections]);
  const isolatedNodes = Array.from(allNodes).filter(nodeId => !connectedNodes.has(nodeId));

  return {
    totalSteps: workflow.nodes.length,
    totalConnections: workflow.connections.length,
    stepTypes,
    connectionTypes,
    entryPoints,
    endPoints,
    isolatedNodes,
  };
}

export function analyzeGraphStructure(folderWorkflow: FolderWorkflow): GraphAnalysis {
  const dependencyTypes: { [key: string]: number } = {};
  const incomingDeps = new Set<string>();
  const outgoingDeps = new Set<string>();
  const allFiles = new Set(folderWorkflow.files.map(f => f.fileName));

  // Analyze dependency types
  folderWorkflow.dependencies.forEach((dependency: FileDependency) => {
    dependencyTypes[dependency.type] = (dependencyTypes[dependency.type] || 0) + 1;
    incomingDeps.add(dependency.to);
    outgoingDeps.add(dependency.from);
  });

  // Find entry points (files with no incoming dependencies)
  const entryPoints = Array.from(allFiles).filter(fileName => !incomingDeps.has(fileName));
  
  // Find end points (files with no outgoing dependencies)
  const endPoints = Array.from(allFiles).filter(fileName => !outgoingDeps.has(fileName));
  
  // Find intermediate nodes (files with both incoming and outgoing dependencies)
  const intermediateNodes = Array.from(allFiles).filter(fileName => 
    incomingDeps.has(fileName) && outgoingDeps.has(fileName)
  );

  return {
    totalFiles: folderWorkflow.files.length,
    totalDependencies: folderWorkflow.dependencies.length,
    dependencyTypes,
    entryPoints,
    endPoints,
    intermediateNodes,
  };
}

function getEdgeColor(type: string): string {
  switch (type) {
    case 'hop':
    case 'flow':
      return '#2563eb'; // Refined blue for main data flow
    case 'error':
      return '#dc2626'; // Clean red for error paths
    case 'conditional':
      return '#7c3aed'; // Elegant purple for conditional logic
    case 'success':
      return '#059669'; // Professional green for success paths
    default:
      return '#6b7280'; // Sophisticated gray for default connections
  }
}

function getDependencyColor(type: string): string {
  switch (type) {
    case 'transformation_call':
      return '#3b82f6'; // Blue for transformation calls
    case 'job_call':
      return '#059669'; // Professional green for job calls
    case 'sub_transformation':
      return '#7c3aed'; // Elegant purple for sub-transformations
    case 'calls':
      return '#3b82f6'; // Blue for generic calls
    case 'includes':
      return '#059669'; // Green for includes
    case 'executes':
      return '#dc2626'; // Clean red for executes
    default:
      return '#6b7280'; // Sophisticated gray for unknown
  }
}
