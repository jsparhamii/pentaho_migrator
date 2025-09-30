import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Play, 
  Square, 
  Database, 
  FileText, 
  Settings, 
  ArrowRight,
  CheckCircle,
  Circle
} from 'lucide-react';
import { PentahoNode as PentahoNodeType } from '../types';

interface PentahoNodeData extends PentahoNodeType {
  onSelect: (node: PentahoNodeType) => void;
}

const getNodeIcon = (node: PentahoNodeType) => {
  const iconClass = "h-4 w-4";
  
  switch (node.type) {
    case 'start':
      return <Play className={iconClass} />;
    case 'end':
      return <CheckCircle className={iconClass} />;
    case 'job':
      return <Settings className={iconClass} />;
    case 'step':
      switch (node.stepType?.toLowerCase()) {
        case 'tableinput':
        case 'tableoutput':
          return <Database className={iconClass} />;
        case 'textfileinput':
        case 'textfileoutput':
          return <FileText className={iconClass} />;
        default:
          return <Square className={iconClass} />;
      }
    default:
      return <Circle className={iconClass} />;
  }
};

const getNodeColor = (node: PentahoNodeType) => {
  switch (node.type) {
    case 'start':
      return 'bg-green-100 border-green-300 text-green-800';
    case 'end':
      return 'bg-red-100 border-red-300 text-red-800';
    case 'job':
      return 'bg-blue-100 border-blue-300 text-blue-800';
    case 'step':
      return 'bg-purple-100 border-purple-300 text-purple-800';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-800';
  }
};

const PentahoNode: React.FC<NodeProps<PentahoNodeData>> = ({ data, selected }) => {
  const handleClick = () => {
    data.onSelect(data);
  };

  return (
    <div 
      className={`px-3 py-2 shadow-md rounded-lg border-2 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200 w-40 h-20 relative group ${getNodeColor(data)} ${
        selected ? 'ring-2 ring-blue-400 ring-offset-2' : ''
      }`}
      onClick={handleClick}
    >
      {/* Input connectors on the left */}
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-blue-500 border-2 border-white" 
        style={{ left: -6 }}
      />
      
      {/* Output connectors on the right */}
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-green-500 border-2 border-white" 
        style={{ right: -6 }}
      />
      
      {/* AI Summary indicator */}
      {data.aiSummary && (
        <div className="absolute -top-1 -left-1 bg-yellow-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
          ✨
        </div>
      )}
      
      {/* Click indicator */}
      <div className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        ℹ
      </div>
      
      <div className="flex items-center space-x-2 h-full">
        <div className="flex-shrink-0">
          {getNodeIcon(data)}
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="text-xs font-medium truncate leading-tight">
            {data.name}
          </div>
          {data.stepType && (
            <div className="text-xs opacity-75 truncate text-gray-600">
              {data.stepType}
            </div>
          )}
        </div>
      </div>
      
      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        Click to view properties{data.aiSummary ? ' & AI summary' : ' (generate AI summary)'}
      </div>
      
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default PentahoNode;
