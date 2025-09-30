import React, { useState, useMemo, useEffect } from 'react';
import { X, Database, FileText, Settings, Info, Search, Copy, ChevronDown, ChevronRight, Sparkles, Loader, Maximize2, Minimize2 } from 'lucide-react';
import { PentahoNode, StepSummary } from '../types';
import { aiService } from '../services/aiService';

interface NodePropertiesPanelProps {
  node: PentahoNode;
  onClose: () => void;
}

const NodePropertiesPanel: React.FC<NodePropertiesPanelProps> = ({ node, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic', 'key', 'ai-summary']));
  const [copied, setCopied] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<StepSummary | null>(node.aiSummary || null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Check AI availability on component mount
  useEffect(() => {
    const checkAIStatus = async () => {
      const status = await aiService.getAIStatus();
      setAiAvailable(status.available);
    };
    checkAIStatus();
  }, []);

  // Generate AI summary
  const generateAISummary = async () => {
    if (isGeneratingSummary || !aiAvailable) return;
    
    setIsGeneratingSummary(true);
    try {
      const summary = await aiService.generateSummary(node);
      if (summary) {
        setAiSummary(summary);
      }
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const renderPropertyValue = (key: string, value: any): React.ReactNode => {
    if (value === null || value === undefined || value === '') {
      return <span className="text-gray-400 italic">Not set</span>;
    }
    
    if (typeof value === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            value ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {value ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      );
    }
    
    if (typeof value === 'object') {
      const jsonStr = JSON.stringify(value, null, 2);
      return (
        <div className="relative">
          <pre className="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-32 font-mono border">
            {jsonStr}
          </pre>
          <button
            onClick={() => copyToClipboard(jsonStr, `${key}_object`)}
            className="absolute top-2 right-2 p-1 bg-white rounded shadow hover:bg-gray-50"
            title="Copy JSON"
          >
            <Copy className="h-3 w-3" />
          </button>
        </div>
      );
    }
    
    const stringValue = String(value);
    const isLongText = stringValue.length > 100;
    const isSQL = key.toLowerCase().includes('sql') || stringValue.trim().toLowerCase().startsWith('select');
    const isPath = stringValue.includes('/') || stringValue.includes('\\');
    
    return (
      <div className="relative group">
        <div className={`${isLongText ? 'max-h-32 overflow-auto' : ''} ${
          isSQL ? 'bg-blue-50 p-2 rounded border font-mono text-sm' : 
          isPath ? 'bg-green-50 p-2 rounded border font-mono text-sm' : ''
        }`}>
          <span className={`break-all word-break-all whitespace-pre-wrap ${isLongText ? 'text-sm' : ''} ${
            isSQL ? 'text-blue-900' : isPath ? 'text-green-900' : ''
          }`} style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
            {stringValue}
          </span>
        </div>
        <button
          onClick={() => copyToClipboard(stringValue, key)}
          className="absolute top-1 right-1 p-1 bg-white rounded shadow opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-50"
          title={`Copy ${key}`}
        >
          {copied === key ? (
            <span className="text-green-600 text-xs">✓</span>
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </button>
      </div>
    );
  };

  const categorizeProperties = (properties: Record<string, any>) => {
    const categories = {
      connection: ['connection', 'server', 'database', 'port', 'username', 'schema'],
      data: ['sql', 'table', 'filename', 'filepath', 'file', 'field', 'fields'],
      configuration: ['type', 'stepType', 'enabled', 'parallel', 'lazy', 'distribute'],
      ui: ['xloc', 'yloc', 'draw', 'GUI'],
      other: [] as string[]
    };

    const categorized: Record<string, Record<string, any>> = {
      connection: {},
      data: {},
      configuration: {},
      ui: {},
      other: {}
    };

    Object.entries(properties).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') return;
      
      let assigned = false;
      for (const [category, keywords] of Object.entries(categories)) {
        if (category === 'other') continue;
        if (keywords.some(keyword => key.toLowerCase().includes(keyword.toLowerCase()))) {
          categorized[category][key] = value;
          assigned = true;
          break;
        }
      }
      
      if (!assigned) {
        categorized.other[key] = value;
      }
    });

    return categorized;
  };

  const getNodeTypeIcon = () => {
    switch (node.type) {
      case 'step':
        return <Settings className="h-5 w-5 text-purple-600" />;
      case 'job':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'start':
        return <div className="h-5 w-5 bg-green-500 rounded-full flex items-center justify-center">
          <div className="h-2 w-2 bg-white rounded-full"></div>
        </div>;
      case 'end':
        return <div className="h-5 w-5 bg-red-500 rounded-full flex items-center justify-center">
          <div className="h-2 w-2 bg-white rounded-full"></div>
        </div>;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const categorizedProps = categorizeProperties(node.properties);
  
  const filteredProperties = useMemo(() => {
    if (!searchTerm) return categorizedProps;
    
    const filtered: typeof categorizedProps = {
      connection: {},
      data: {},
      configuration: {},
      ui: {},
      other: {}
    };

    Object.entries(categorizedProps).forEach(([category, props]) => {
      Object.entries(props).forEach(([key, value]) => {
        const searchString = `${key} ${String(value)}`.toLowerCase();
        if (searchString.includes(searchTerm.toLowerCase())) {
          filtered[category as keyof typeof filtered][key] = value;
        }
      });
    });

    return filtered;
  }, [categorizedProps, searchTerm]);

  const renderSection = (title: string, sectionKey: string, properties: Record<string, any>, icon?: React.ReactNode) => {
    if (Object.keys(properties).length === 0) return null;
    
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
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {Object.keys(properties).length}
            </span>
          </div>
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        
        {isExpanded && (
          <div className="space-y-3 p-2 border-l-2 border-gray-100 ml-2">
            {Object.entries(properties).map(([key, value]) => (
              <div key={key} className="text-sm">
                <div className="flex items-start justify-between mb-1">
                  <span className="font-medium text-gray-700 capitalize text-xs bg-gray-50 px-2 py-1 rounded">
                    {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                </div>
                <div className="ml-0">
                  {renderPropertyValue(key, value)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`absolute top-4 right-4 ${isExpanded ? 'w-[600px]' : 'w-96'} bg-white rounded-lg shadow-xl border z-10 max-h-[85vh] overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-gray-50 to-gray-100">
        <div className="flex items-center space-x-3">
          {getNodeTypeIcon()}
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Node Properties</h3>
            <p className="text-xs text-gray-600 break-all">{node.name}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded"
            title={isExpanded ? "Collapse panel" : "Expand panel"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search properties..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 overflow-y-auto max-h-96">
        {/* Basic Information - Always shown */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            Basic Information
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium text-blue-700">Name:</span>
              <span className="text-blue-900 font-mono break-all overflow-wrap-anywhere">{node.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium text-blue-700">Type:</span>
              <span className="text-blue-900">{node.type}</span>
            </div>
            {node.stepType && (
              <div className="flex justify-between">
                <span className="font-medium text-blue-700">Step Type:</span>
                <span className="text-blue-900">{node.stepType}</span>
              </div>
            )}
            {node.description && (
              <div>
                <span className="font-medium text-blue-700">Description:</span>
                <div className="text-blue-900 mt-1 text-xs bg-white p-2 rounded border break-all overflow-wrap-anywhere whitespace-pre-wrap">
                  {node.description}
                </div>
              </div>
            )}
            {node.position && (
              <div className="flex justify-between text-xs pt-2 border-t border-blue-200">
                <span className="font-medium text-blue-700">Position:</span>
                <span className="text-blue-900">({node.position.x}, {node.position.y})</span>
              </div>
            )}
          </div>
        </div>

        {/* AI Summary Section */}
        <div className="mb-3">
          <button
            onClick={() => toggleSection('ai-summary')}
            className="flex items-center justify-between w-full p-2 text-left hover:bg-gray-50 rounded transition-colors"
          >
            <div className="flex items-center space-x-2">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              <h4 className="text-sm font-semibold text-gray-900">AI Summary</h4>
              {aiSummary && (
                <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  Generated
                </span>
              )}
              {!aiAvailable && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Unavailable
                </span>
              )}
            </div>
            {expandedSections.has('ai-summary') ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          
          {expandedSections.has('ai-summary') && (
            <div className="space-y-3 p-2 border-l-2 border-yellow-100 ml-2">
              {aiSummary ? (
                <div className="space-y-3">
                  <div className="bg-yellow-50 p-3 rounded-lg">
                    <h5 className="font-medium text-yellow-800 mb-2">Summary</h5>
                    <p className="text-sm text-yellow-700 break-all word-break-all leading-relaxed" style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{aiSummary.summary}</p>
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <h5 className="font-medium text-blue-800 mb-2">Purpose</h5>
                    <p className="text-sm text-blue-700 break-all word-break-all leading-relaxed" style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{aiSummary.purpose}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="bg-green-50 p-3 rounded-lg">
                      <h5 className="font-medium text-green-800 mb-2">Inputs</h5>
                      <ul className="text-sm text-green-700 space-y-2">
                        {aiSummary.inputs.map((input, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="w-1 h-1 bg-green-500 rounded-full mr-2 mt-2 flex-shrink-0"></span>
                            <span className="break-all word-break-all" style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{input}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <h5 className="font-medium text-purple-800 mb-2">Outputs</h5>
                      <ul className="text-sm text-purple-700 space-y-2">
                        {aiSummary.outputs.map((output, idx) => (
                          <li key={idx} className="flex items-start">
                            <span className="w-1 h-1 bg-purple-500 rounded-full mr-2 mt-2 flex-shrink-0"></span>
                            <span className="break-all word-break-all" style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{output}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  
                  {Object.keys(aiSummary.keySettings).length > 0 && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h5 className="font-medium text-gray-800 mb-2">Key Settings</h5>
                      <div className="space-y-3">
                        {Object.entries(aiSummary.keySettings).map(([key, value]) => (
                          <div key={key} className="text-sm">
                            <div className="text-gray-600 font-medium mb-1">{key}:</div>
                            <div className="text-gray-800 break-all word-break-all bg-white p-2 rounded border whitespace-pre-wrap" style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>{String(value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  {aiAvailable ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">Generate an AI-powered summary of this step</p>
                      <button
                        onClick={generateAISummary}
                        disabled={isGeneratingSummary}
                        className="flex items-center justify-center space-x-2 mx-auto px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isGeneratingSummary ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" />
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            <span>Generate Summary</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      <p>AI summaries are not available.</p>
                      <p className="text-xs mt-1">Configure an API key to enable AI features.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Categorized Properties */}
        {renderSection('Database Connection', 'connection', filteredProperties.connection, 
          <Database className="h-4 w-4 text-green-600" />)}
        
        {renderSection('Data & Files', 'data', filteredProperties.data, 
          <FileText className="h-4 w-4 text-blue-600" />)}
        
        {renderSection('Configuration', 'configuration', filteredProperties.configuration, 
          <Settings className="h-4 w-4 text-purple-600" />)}
        
        {renderSection('UI Properties', 'ui', filteredProperties.ui, 
          <div className="h-4 w-4 bg-gray-400 rounded"></div>)}
        
        {renderSection('Other Properties', 'other', filteredProperties.other, 
          <Info className="h-4 w-4 text-gray-600" />)}

        {/* No results message */}
        {searchTerm && Object.values(filteredProperties).every(category => Object.keys(category).length === 0) && (
          <div className="text-center py-8 text-gray-500">
            <Search className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No properties found matching "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodePropertiesPanel;
