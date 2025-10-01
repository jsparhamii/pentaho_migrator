import React, { useMemo, useState, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  MiniMap,
} from 'reactflow';
import { PentahoWorkflow, PentahoNode as PentahoNodeType } from '../types';
import PentahoNode from './PentahoNode';
import NodePropertiesPanel from './NodePropertiesPanel';
import { WorkflowTabsPanel } from './WorkflowTabsPanel';
import { createWorkflowLayout, analyzeWorkflowStructure } from '../utils/layoutUtils';

interface WorkflowVisualizerProps {
  workflow: PentahoWorkflow;
  projectId?: string;
}

const nodeTypes = {
  pentaho: PentahoNode,
};

const WorkflowVisualizer: React.FC<WorkflowVisualizerProps> = ({ workflow, projectId }) => {
  const [selectedNode, setSelectedNode] = useState<PentahoNodeType | null>(null);
  const [showWorkflowTabs, setShowWorkflowTabs] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(true);

  // Create hierarchical layout for workflow steps
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const layout = createWorkflowLayout(workflow);
    
    // Update node data with callbacks
    const updatedNodes = layout.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onSelect: (nodeData: PentahoNodeType) => setSelectedNode(nodeData),
      },
    }));
    
    return {
      nodes: updatedNodes,
      edges: layout.edges,
    };
  }, [workflow]);

  // Analyze workflow structure for additional insights
  const workflowAnalysis = useMemo(() => {
    return analyzeWorkflowStructure(workflow);
  }, [workflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Update nodes when layout changes
  React.useEffect(() => {
    setNodes(layoutedNodes);
  }, [layoutedNodes, setNodes]);

  // Update edges when layout changes
  React.useEffect(() => {
    setEdges(layoutedEdges);
  }, [layoutedEdges, setEdges]);

  // Update nodes when selected node changes
  React.useEffect(() => {
    setNodes(currentNodes => 
      currentNodes.map(node => ({
        ...node,
        selected: selectedNode?.id === node.id
      }))
    );
  }, [selectedNode, setNodes]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const nodeData = workflow.nodes.find(n => n.id === node.id);
    if (nodeData) {
      setSelectedNode(nodeData);
    }
  }, [workflow.nodes]);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Workflow Header with Summary Toggle */}
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{workflow.name}</h2>
            {workflow.description && (
              <p className="text-gray-600 mt-2">{workflow.description}</p>
            )}
          </div>
          <button
            onClick={() => setShowWorkflowTabs(!showWorkflowTabs)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-sm flex items-center space-x-2"
          >
            <span>{showWorkflowTabs ? 'Hide' : 'Show'} Analysis & Code</span>
          </button>
        </div>
        
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="font-medium">Type:</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">{workflow.type}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">Nodes:</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">{workflow.nodes.length}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="font-medium">Connections:</span>
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">{workflow.connections.length}</span>
          </div>
        </div>
      </div>

      {/* Workflow Tabs Panel */}
      {showWorkflowTabs && (
        <WorkflowTabsPanel
          workflow={workflow}
          projectId={projectId}
          onSummaryGenerated={(summary) => {
            console.log('Workflow summary generated:', summary);
          }}
          onClose={() => setShowWorkflowTabs(false)}
        />
      )}

      {/* Workflow Visualization */}
      <div className="h-96 w-full relative">
        {/* Hop Legend & Controls */}
        <div className="absolute top-2 left-2 bg-white rounded-lg shadow-lg border p-3 z-10 text-xs">
          <h4 className="font-semibold text-gray-900 mb-2">Hop Types</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span>Data Hops</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-blue-500"></div>
              <span>Conditional</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span>Error Hops</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-gray-400 opacity-50" style={{strokeDasharray: '2,2'}}></div>
              <span>Disabled</span>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t">
            <button
              onClick={() => setShowMiniMap(!showMiniMap)}
              className="text-xs text-gray-600 hover:text-gray-800 transition-colors"
            >
              {showMiniMap ? '📍 Hide Map' : '📍 Show Map'}
            </button>
          </div>
        </div>

      {/* Compact Workflow Stats */}
      <div className="absolute top-2 right-2 bg-white rounded shadow border p-2 z-10 text-xs">
        <div className="flex items-center space-x-3 text-gray-600">
          <span className="font-medium text-gray-800">⚙️</span>
          <span><span className="text-green-600">{workflowAnalysis?.entryPoints?.length || 0}</span>→<span className="text-blue-600">{workflowAnalysis?.isolatedNodes?.length || 0}</span>→<span className="text-red-600">{workflowAnalysis?.endPoints?.length || 0}</span></span>
          <span className="text-gray-400">|</span>
          <span>{workflow.connections.filter(h => h.enabled !== false).length}/{workflow.connections.length} hops</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Strict}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        defaultEdgeOptions={{
          animated: true,
          style: { strokeWidth: 2, stroke: '#10b981' },
        }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        selectNodesOnDrag={false}
        elementsSelectable={true}
        nodesConnectable={false}
        nodesDraggable={false}
        edgesFocusable={true}
        edgesUpdatable={false}
      >
        <Controls showInteractive={false} />
        {showMiniMap && (
          <MiniMap 
            nodeColor={(node) => {
              const workflowNode = workflow.nodes.find(n => n.id === node.id);
              // Use step type for better color differentiation
              const stepType = workflowNode?.stepType?.toLowerCase() || '';
              
              if (stepType.includes('input') || stepType.includes('source')) return '#059669';
              if (stepType.includes('output') || stepType.includes('target')) return '#dc2626';
              if (stepType.includes('filter') || stepType.includes('select')) return '#7c3aed';
              if (stepType.includes('join') || stepType.includes('merge')) return '#ea580c';
              if (stepType.includes('sort') || stepType.includes('group')) return '#0891b2';
              
              // Default colors by type
              switch (workflowNode?.type) {
                case 'start': return '#059669';
                case 'end': return '#dc2626';
                case 'step': return '#2563eb';
                case 'job': return '#7c3aed';
                default: return '#6b7280';
              }
            }}
            nodeStrokeColor="#000000"
            nodeStrokeWidth={2}
            maskColor="rgba(50, 50, 50, 0.3)"
            className="!w-40 !h-32"
            style={{
              backgroundColor: '#f8f9fa',
              border: '2px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
        )}
        <Background variant="dots" gap={20} size={1} className="opacity-30" />
      </ReactFlow>
      
      {selectedNode && (
        <NodePropertiesPanel 
          node={selectedNode} 
          onClose={() => setSelectedNode(null)}
        />
      )}
      </div>
    </div>
  );
};

export default WorkflowVisualizer;
