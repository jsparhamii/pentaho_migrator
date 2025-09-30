import React, { useState, useEffect } from 'react';
import { PySparkConversion } from '../services/aiService';
import { aiService } from '../services/aiService';
import { 
  Code, 
  Download, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Loader2,
  Maximize2,
  Minimize2,
  FileText,
  Package,
  Lightbulb
} from 'lucide-react';

interface PySparkViewerProps {
  conversion: PySparkConversion;
  onClose?: () => void;
}

export const PySparkViewer: React.FC<PySparkViewerProps> = ({ conversion, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(conversion.pysparkCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const downloadNotebook = async () => {
    try {
      setDownloading(true);
      await aiService.downloadDatabricksNotebook(conversion);
    } catch (error) {
      console.error('Failed to download notebook:', error);
      alert('Failed to download notebook. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'High': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getComplexityIcon = (complexity: string) => {
    switch (complexity) {
      case 'Low': return <CheckCircle className="h-4 w-4" />;
      case 'Medium': return <Clock className="h-4 w-4" />;
      case 'High': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-xl border transition-all duration-300 ${
      isExpanded ? 'fixed inset-4 z-50' : 'max-w-5xl mx-auto'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
        <div className="flex items-center space-x-3">
          <Code className="h-6 w-6 text-purple-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">PySpark Code</h3>
            <p className="text-sm text-gray-600">Converted from: {conversion.originalWorkflow}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Complexity Badge */}
          <div className={`px-3 py-1 rounded-full flex items-center space-x-1 border ${getComplexityColor(conversion.estimatedComplexity)}`}>
            {getComplexityIcon(conversion.estimatedComplexity)}
            <span className="text-sm font-medium">{conversion.estimatedComplexity}</span>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded"
            title={isExpanded ? "Collapse viewer" : "Expand viewer"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-white rounded"
              title="Close viewer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`overflow-y-auto ${isExpanded ? 'h-[calc(100vh-16rem)]' : 'max-h-96'}`}>
        {/* Metadata Panel */}
        <div className="p-4 bg-gray-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required Libraries */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center space-x-1">
                <Package className="h-4 w-4" />
                <span>Required Libraries</span>
              </h4>
              <div className="flex flex-wrap gap-1">
                {conversion.requiredLibraries.map((lib, index) => (
                  <span 
                    key={index}
                    className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-mono"
                  >
                    {lib}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Actions</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded transition-colors"
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
                
                <button
                  onClick={downloadNotebook}
                  disabled={downloading}
                  className="flex items-center space-x-1 px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white text-sm rounded transition-colors"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>{downloading ? 'Downloading...' : 'Download .dbc'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Conversion Notes */}
          {conversion.conversionNotes.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center space-x-1">
                <Lightbulb className="h-4 w-4" />
                <span>Conversion Notes</span>
              </h4>
              <ul className="space-y-1">
                {conversion.conversionNotes.map((note, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Code Display */}
        <div className="p-4">
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm">
              <code className="language-python text-gray-100 whitespace-pre-wrap break-words" style={{ 
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                lineHeight: '1.5'
              }}>
                {conversion.pysparkCode}
              </code>
            </pre>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
        <p>
          Generated PySpark code for Databricks. Review and test before using in production.
          {conversion.success ? ' Conversion completed successfully.' : ' Basic template generated - requires manual review.'}
        </p>
      </div>
    </div>
  );
};
