import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  FileText, 
  Settings, 
  ArrowRight,
  Eye,
  Database,
  Link
} from 'lucide-react';
import { PentahoFile } from '../types';

interface FolderNodeData {
  file: PentahoFile;
  onSelect: (file: PentahoFile) => void;
  onDrillDown: (file: PentahoFile) => void;
}

const getFileIcon = (file: PentahoFile) => {
  const iconClass = "h-5 w-5";
  
  switch (file.type) {
    case 'transformation':
      return <Settings className={iconClass} />;
    case 'job':
      return <FileText className={iconClass} />;
    default:
      return <FileText className={iconClass} />;
  }
};

const getFileColor = (file: PentahoFile) => {
  switch (file.type) {
    case 'transformation':
      return 'bg-purple-100 border-purple-300 text-purple-800';
    case 'job':
      return 'bg-blue-100 border-blue-300 text-blue-800';
    default:
      return 'bg-gray-100 border-gray-300 text-gray-800';
  }
};

const FolderNode: React.FC<NodeProps<FolderNodeData>> = ({ data, selected }) => {
  const handleClick = () => {
    data.onSelect(data.file);
  };

  const handleDrillDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    data.onDrillDown(data.file);
  };

  const { file } = data;

  return (
    <div 
      className={`px-3 py-3 shadow-lg rounded-lg border-2 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200 w-48 h-24 relative group ${getFileColor(file)} ${
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
      
      {/* File Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-1">
          {getFileIcon(file)}
          <span className="text-xs font-medium uppercase tracking-wide">
            {file.type === 'transformation' ? 'TRANS' : 'JOB'}
          </span>
        </div>
        <button
          onClick={handleDrillDown}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-white rounded-full shadow hover:bg-gray-50"
          title="View internal workflow"
        >
          <Eye className="h-3 w-3" />
        </button>
      </div>

      {/* File Name */}
      <div className="mb-2">
        <h3 className="text-xs font-semibold truncate" title={file.fileName}>
          {file.fileName}
        </h3>
      </div>

      {/* Compact Statistics */}
      <div className="flex justify-between text-xs">
        <div className="flex items-center space-x-2">
          <span className="opacity-75">Nodes:</span>
          <span className="font-medium">{file.workflow.nodes.length}</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="opacity-75">Edges:</span>
          <span className="font-medium">{file.workflow.connections.length}</span>
        </div>
        {(file.references.length > 0 || file.referencedBy.length > 0) && (
          <div className="flex items-center space-x-1">
            <Link className="h-3 w-3 opacity-75" />
            <span className="font-medium">{file.references.length + file.referencedBy.length}</span>
          </div>
        )}
      </div>

      {/* Output connectors on the right */}
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-green-500 border-2 border-white" 
        style={{ right: -6 }}
      />

      {/* Hover tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        Click for details • 👁 to view workflow
      </div>
    </div>
  );
};

export default FolderNode;
