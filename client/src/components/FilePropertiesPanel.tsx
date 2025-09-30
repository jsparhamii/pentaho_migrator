import React, { useState } from 'react';
import { X, FileText, Settings, Database, Link, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { PentahoFile } from '../types';

interface FilePropertiesPanelProps {
  file: PentahoFile;
  onClose: () => void;
  onViewWorkflow: () => void;
  onShowSummary?: () => void;
  onConvertToPySpark?: () => void;
}

const FilePropertiesPanel: React.FC<FilePropertiesPanelProps> = ({ file, onClose, onViewWorkflow, onShowSummary, onConvertToPySpark }) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'stats']));

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const getFileTypeIcon = () => {
    switch (file.type) {
      case 'transformation':
        return <Settings className="h-5 w-5 text-purple-600" />;
      case 'job':
        return <FileText className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const renderSection = (title: string, sectionKey: string, content: React.ReactNode, icon?: React.ReactNode) => {
    const isExpanded = expandedSections.has(sectionKey);
    
    return (
      <div className="mb-3">
        <button
          onClick={() => toggleSection(sectionKey)}
          className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-50 rounded transition-colors"
        >
          <div className="flex items-center space-x-2">
            {icon}
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
          </div>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        
        {isExpanded && (
          <div className="p-2 border-l-2 border-gray-100 ml-2">
            {content}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="absolute top-4 right-4 w-96 bg-white rounded-lg shadow-xl border z-10 max-h-[85vh] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center space-x-3">
          {getFileTypeIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">File Details</h3>
            <p className="text-xs text-gray-600">{file.fileName}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={onViewWorkflow}
            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="View internal workflow"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 overflow-y-auto max-h-96">
        {/* Basic Information */}
        {renderSection('Basic Information', 'basic', (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">File Name:</span>
              <span className="text-gray-900 font-mono text-xs">{file.fileName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">Type:</span>
              <span className="text-gray-900 capitalize">{file.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-gray-700">Path:</span>
              <span className="text-gray-900 font-mono text-xs">{file.filePath}</span>
            </div>
            {file.workflow.description && (
              <div>
                <span className="font-medium text-gray-700">Description:</span>
                <div className="text-gray-900 mt-1 text-xs bg-gray-50 p-2 rounded border">
                  {file.workflow.description}
                </div>
              </div>
            )}
          </div>
        ), getFileTypeIcon())}

        {/* Statistics */}
        {renderSection('Workflow Statistics', 'stats', (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-purple-50 p-3 rounded border">
              <div className="text-purple-700 font-medium">Steps/Entries</div>
              <div className="text-purple-900 text-lg font-bold">{file.workflow.nodes.length}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded border">
              <div className="text-blue-700 font-medium">Connections</div>
              <div className="text-blue-900 text-lg font-bold">{file.workflow.connections.length}</div>
            </div>
            <div className="bg-green-50 p-3 rounded border">
              <div className="text-green-700 font-medium">DB Connections</div>
              <div className="text-green-900 text-lg font-bold">
                {file.workflow.databaseConnections?.length || 0}
              </div>
            </div>
            <div className="bg-yellow-50 p-3 rounded border">
              <div className="text-yellow-700 font-medium">Parameters</div>
              <div className="text-yellow-900 text-lg font-bold">
                {Object.keys(file.workflow.parameters || {}).length}
              </div>
            </div>
          </div>
        ), <Database className="h-4 w-4 text-gray-600" />)}

        {/* File References */}
        {file.references.length > 0 && renderSection('File References', 'references', (
          <div className="space-y-2">
            {file.references.map((ref, index) => (
              <div key={index} className="bg-orange-50 p-2 rounded border border-orange-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-orange-900 text-sm">{ref.fileName}</div>
                    <div className="text-orange-700 text-xs">{ref.filePath}</div>
                  </div>
                  <span className="text-xs bg-orange-200 text-orange-800 px-2 py-1 rounded">
                    {ref.referenceType}
                  </span>
                </div>
                {(ref.stepName || ref.entryName) && (
                  <div className="text-xs text-orange-600 mt-1">
                    Via: {ref.stepName || ref.entryName}
                  </div>
                )}
              </div>
            ))}
          </div>
        ), <Link className="h-4 w-4 text-orange-600" />)}

        {/* Referenced By */}
        {file.referencedBy.length > 0 && renderSection('Referenced By', 'referencedBy', (
          <div className="space-y-2">
            {file.referencedBy.map((ref, index) => (
              <div key={index} className="bg-indigo-50 p-2 rounded border border-indigo-200">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium text-indigo-900 text-sm">{ref.fileName}</div>
                    <div className="text-indigo-700 text-xs">{ref.filePath}</div>
                  </div>
                  <span className="text-xs bg-indigo-200 text-indigo-800 px-2 py-1 rounded">
                    {ref.referenceType}
                  </span>
                </div>
                {(ref.stepName || ref.entryName) && (
                  <div className="text-xs text-indigo-600 mt-1">
                    Via: {ref.stepName || ref.entryName}
                  </div>
                )}
              </div>
            ))}
          </div>
        ), <Link className="h-4 w-4 text-indigo-600" />)}

        {/* Database Connections */}
        {file.workflow.databaseConnections && file.workflow.databaseConnections.length > 0 && 
          renderSection('Database Connections', 'databases', (
            <div className="space-y-2">
              {file.workflow.databaseConnections.map((conn, index) => (
                <div key={index} className="bg-green-50 p-2 rounded border border-green-200">
                  <div className="font-medium text-green-900 text-sm">{conn.name}</div>
                  <div className="text-green-700 text-xs">{conn.type}</div>
                  {conn.server && (
                    <div className="text-green-600 text-xs">{conn.server}:{conn.port}</div>
                  )}
                  {conn.database && (
                    <div className="text-green-600 text-xs">DB: {conn.database}</div>
                  )}
                </div>
              ))}
            </div>
          ), <Database className="h-4 w-4 text-green-600" />)
        }

        {/* Metadata */}
        {file.workflow.metadata && renderSection('Metadata', 'metadata', (
          <div className="space-y-2 text-sm">
            {file.workflow.metadata.author && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Author:</span>
                <span className="text-gray-900">{file.workflow.metadata.author}</span>
              </div>
            )}
            {file.workflow.metadata.version && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Version:</span>
                <span className="text-gray-900">{file.workflow.metadata.version}</span>
              </div>
            )}
            {file.workflow.metadata.created && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Created:</span>
                <span className="text-gray-900 text-xs">{file.workflow.metadata.created}</span>
              </div>
            )}
            {file.workflow.metadata.modified && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Modified:</span>
                <span className="text-gray-900 text-xs">{file.workflow.metadata.modified}</span>
              </div>
            )}
          </div>
        ), <FileText className="h-4 w-4 text-gray-600" />)}
      </div>

      {/* Action Bar */}
      <div className="border-t p-3 bg-gray-50">
        <div className="space-y-2">
          {onShowSummary && (
            <button
              onClick={onShowSummary}
              className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
            >
              <FileText className="h-4 w-4" />
              <span>AI Summary</span>
            </button>
          )}
          {onConvertToPySpark && (
            <button
              onClick={onConvertToPySpark}
              className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center space-x-2"
            >
              <span>🐍</span>
              <span>Convert to PySpark</span>
            </button>
          )}
          <button
            onClick={onViewWorkflow}
            className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Eye className="h-4 w-4" />
            <span>View Internal Workflow</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FilePropertiesPanel;
