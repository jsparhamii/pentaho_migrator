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
import { FolderWorkflow, PentahoFile } from '../types';
import FolderNode from './FolderNode';
import FilePropertiesPanel from './FilePropertiesPanel';
import { WorkflowSummaryPanel } from './WorkflowSummaryPanel';
import { PySparkViewer } from './PySparkViewer';
import { createHierarchicalLayout, analyzeGraphStructure } from '../utils/layoutUtils';
import { aiService, PySparkConversion } from '../services/aiService';

interface FolderVisualizerProps {
  folderWorkflow: FolderWorkflow;
  onFileSelect: (file: PentahoFile) => void;
}

const nodeTypes = {
  folderNode: FolderNode,
};

const FolderVisualizer: React.FC<FolderVisualizerProps> = ({ folderWorkflow, onFileSelect }) => {
  const [selectedFile, setSelectedFile] = useState<PentahoFile | null>(null);
  const [showWorkflowSummary, setShowWorkflowSummary] = useState<string | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [showPySparkViewer, setShowPySparkViewer] = useState(false);
  const [pySparkConversion, setPySparkConversion] = useState<PySparkConversion | null>(null);
  const [converting, setConverting] = useState(false);

  // Handle PySpark conversion for selected file
  const handleConvertToPySpark = async (file: PentahoFile) => {
    try {
      setConverting(true);
      console.log(`🔄 Converting file to PySpark: ${file.fileName}`);
      
      const conversion = await aiService.convertToPySpark(file.workflow);
      if (conversion) {
        setPySparkConversion(conversion);
        setShowPySparkViewer(true);
        console.log(`✅ PySpark conversion completed for: ${file.fileName}`);
      } else {
        alert('Failed to convert workflow to PySpark. Please try again.');
      }
    } catch (error) {
      console.error('Error converting to PySpark:', error);
      alert('Error occurred during conversion. Please check the console for details.');
    } finally {
      setConverting(false);
    }
  };

  // Create hierarchical layout using Dagre (Sankey-like)
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    const layout = createHierarchicalLayout(folderWorkflow);
    
    // Update node data with callbacks
    const updatedNodes = layout.nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onSelect: (fileData: PentahoFile) => setSelectedFile(fileData),
        onDrillDown: (fileData: PentahoFile) => onFileSelect(fileData),
      },
    }));
    
    return {
      nodes: updatedNodes,
      edges: layout.edges,
    };
  }, [folderWorkflow, onFileSelect]);

  // Analyze graph structure for additional insights
  const graphAnalysis = useMemo(() => {
    return analyzeGraphStructure(folderWorkflow);
  }, [folderWorkflow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when selected file changes
  React.useEffect(() => {
    setNodes(currentNodes => 
      currentNodes.map(node => ({
        ...node,
        selected: selectedFile?.fileName === node.id
      }))
    );
  }, [selectedFile, setNodes]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const fileData = folderWorkflow.files.find(f => f.fileName === node.id);
    if (fileData) {
      setSelectedFile(fileData);
    }
  }, [folderWorkflow.files]);

  const handlePaneClick = useCallback(() => {
    setSelectedFile(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Individual File Workflow Summary */}
      {showWorkflowSummary && (
        <div className="bg-white rounded-lg shadow-lg p-4">
          {(() => {
            const file = folderWorkflow.files.find(f => f.fileName === showWorkflowSummary);
            return file ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <h3 className="text-lg font-semibold text-gray-800">Workflow Summary: {file.fileName}</h3>
                  <button
                    onClick={() => setShowWorkflowSummary(null)}
                    className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-300 rounded hover:bg-red-50 transition-colors"
                  >
                    Close Summary
                  </button>
                </div>
                <WorkflowSummaryPanel
                  workflow={file.workflow}
                  onSummaryGenerated={(summary) => {
                    console.log(`Workflow summary generated for ${file.fileName}:`, summary);
                  }}
                />
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* PySpark Viewer */}
      {showPySparkViewer && pySparkConversion && (
        <PySparkViewer
          conversion={pySparkConversion}
          onClose={() => {
            setShowPySparkViewer(false);
            setPySparkConversion(null);
          }}
        />
      )}

      <div className="h-96 w-full relative">
        {/* Flow Legend & Controls */}
        <div className="absolute top-2 left-2 bg-white rounded-lg shadow-lg border p-3 z-10 text-xs">
          <h4 className="font-semibold text-gray-900 mb-2">Flow Legend</h4>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-red-500"></div>
              <span>Executes</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-blue-500"></div>
              <span>Calls</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-0.5 bg-green-500"></div>
              <span>Includes</span>
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

      {/* Compact Flow Stats */}
      <div className="absolute top-2 right-2 bg-white rounded shadow border p-2 z-10 text-xs">
        <div className="flex items-center space-x-3 text-gray-600">
          <span className="font-medium text-gray-800">📊</span>
          <span><span className="text-green-600">{graphAnalysis?.entryPoints?.length || 0}</span>→<span className="text-blue-600">{graphAnalysis?.intermediateNodes?.length || 0}</span>→<span className="text-red-600">{graphAnalysis?.endPoints?.length || 0}</span></span>
          <span className="text-gray-400">|</span>
          <span>{folderWorkflow.files.length} files</span>
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
          style: { strokeWidth: 2 },
        }}
      >
        <Controls showInteractive={false} />
        {showMiniMap && (
          <MiniMap 
            nodeColor={(node) => {
              const file = folderWorkflow.files.find(f => f.fileName === node.id);
              return file?.type === 'transformation' ? '#7c3aed' : '#2563eb';
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
      
      {selectedFile && (
        <FilePropertiesPanel 
          file={selectedFile} 
          onClose={() => setSelectedFile(null)}
          onViewWorkflow={() => onFileSelect(selectedFile)}
          onShowSummary={() => setShowWorkflowSummary(selectedFile.fileName)}
          onConvertToPySpark={() => handleConvertToPySpark(selectedFile)}
        />
      )}
      </div>
    </div>
  );
};

export default FolderVisualizer;
