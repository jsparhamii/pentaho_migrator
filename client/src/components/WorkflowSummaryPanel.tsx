import React, { useState, useEffect, useRef } from 'react';
import { WorkflowSummary, PentahoWorkflow } from '../types';
import { aiService } from '../services/aiService';
import { FileText, Loader, Maximize2, Minimize2, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface WorkflowSummaryPanelProps {
  workflow: PentahoWorkflow;
  onSummaryGenerated?: (summary: WorkflowSummary) => void;
}

export const WorkflowSummaryPanel: React.FC<WorkflowSummaryPanelProps> = ({
  workflow,
  onSummaryGenerated
}) => {
  const [summary, setSummary] = useState<WorkflowSummary | null>(workflow.workflowSummary || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isScrollable, setIsScrollable] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkScrollable = () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        setIsScrollable(scrollHeight > clientHeight);
      }
    };

    checkScrollable();
    // Check again when content changes
    const timer = setTimeout(checkScrollable, 100);
    
    return () => clearTimeout(timer);
  }, [summary, isExpanded]);

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const generatedSummary = await aiService.generateWorkflowSummary(workflow);
      if (generatedSummary) {
        setSummary(generatedSummary);
        onSummaryGenerated?.(generatedSummary);
      } else {
        setError('Failed to generate workflow summary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'Low': return 'text-green-600 bg-green-50';
      case 'Medium': return 'text-yellow-600 bg-yellow-50';
      case 'High': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
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
    <div className={`bg-white rounded-lg shadow-lg border transition-all duration-300 ${
      isExpanded ? 'max-w-4xl' : 'max-w-2xl'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center space-x-2">
          <FileText className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-800">Workflow Summary</h3>
          <span className="text-sm text-gray-500">({workflow.name})</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-white rounded"
            title={isExpanded ? "Collapse panel" : "Expand panel"}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        <div 
          ref={contentRef}
          className={`p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 ${isExpanded ? 'max-h-[600px]' : 'max-h-96'}`}
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: '#d1d5db #f3f4f6',
            scrollBehavior: 'smooth'
          }}
        >
        {!summary && !isLoading && (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Generate an AI-powered summary of this workflow to understand its purpose, data flow, and business value.</p>
            <button
              onClick={generateSummary}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
            >
              <FileText className="h-4 w-4" />
              <span>Generate Workflow Summary</span>
            </button>
          </div>
        )}

        {isLoading && (
          <div className="text-center py-8">
            <Loader className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Analyzing workflow structure...</p>
            <p className="text-sm text-gray-500 mt-2">
              Large workflows may take longer as they're processed in chunks
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              <p className="text-red-700 font-medium">Error generating summary</p>
            </div>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={generateSummary}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Try again
            </button>
          </div>
        )}

        {summary && (
          <div className="space-y-6">
            {/* Overview */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Executive Summary</h4>
              <p className="text-blue-800 leading-relaxed break-words overflow-wrap-anywhere whitespace-pre-wrap" style={{ wordWrap: 'break-word' }}>
                {summary.summary}
              </p>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{summary.stepCount}</div>
                <div className="text-sm text-gray-600">Steps</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{summary.connectionCount}</div>
                <div className="text-sm text-gray-600">Connections</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{summary.overallInputs.length}</div>
                <div className="text-sm text-gray-600">Inputs</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-gray-700">{summary.overallOutputs.length}</div>
                <div className="text-sm text-gray-600">Outputs</div>
              </div>
            </div>

            {/* Complexity Badge */}
            <div className="flex justify-center">
              <div className={`px-4 py-2 rounded-full flex items-center space-x-2 ${getComplexityColor(summary.complexity)}`}>
                {getComplexityIcon(summary.complexity)}
                <span className="font-semibold">{summary.complexity} Complexity</span>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className={`grid gap-6 ${isExpanded ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* Purpose & Business Value */}
              <div className="space-y-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">Purpose</h4>
                  <p className="text-green-800 break-words overflow-wrap-anywhere whitespace-pre-wrap" style={{ wordWrap: 'break-word' }}>
                    {summary.purpose}
                  </p>
                </div>

                <div className="bg-purple-50 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-2">Business Value</h4>
                  <p className="text-purple-800 break-words overflow-wrap-anywhere whitespace-pre-wrap" style={{ wordWrap: 'break-word' }}>
                    {summary.businessValue}
                  </p>
                </div>
              </div>

              {/* Data Flow */}
              <div className="bg-indigo-50 rounded-lg p-4">
                <h4 className="font-semibold text-indigo-900 mb-2">Data Flow</h4>
                <p className="text-indigo-800 break-words overflow-wrap-anywhere whitespace-pre-wrap" style={{ wordWrap: 'break-word' }}>
                  {summary.dataFlow}
                </p>
              </div>
            </div>

            {/* Inputs & Outputs */}
            <div className={`grid gap-6 ${isExpanded ? 'md:grid-cols-2' : 'grid-cols-1'}`}>
              
              {/* Inputs */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Overall Inputs</h4>
                <div className="space-y-2">
                  {summary.overallInputs.map((input, index) => (
                    <div key={index} className="bg-white rounded px-3 py-2 text-sm border">
                      <span className="text-gray-700 break-words overflow-wrap-anywhere" style={{ wordWrap: 'break-word' }}>
                        {input}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outputs */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Overall Outputs</h4>
                <div className="space-y-2">
                  {summary.overallOutputs.map((output, index) => (
                    <div key={index} className="bg-white rounded px-3 py-2 text-sm border">
                      <span className="text-gray-700 break-words overflow-wrap-anywhere" style={{ wordWrap: 'break-word' }}>
                        {output}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key Steps */}
            <div className="bg-orange-50 rounded-lg p-4">
              <h4 className="font-semibold text-orange-900 mb-3">Key Transformation Steps</h4>
              <div className="space-y-2">
                {summary.keySteps.map((step, index) => (
                  <div key={index} className="bg-white rounded px-3 py-2 text-sm border">
                    <span className="text-orange-800 break-words overflow-wrap-anywhere" style={{ wordWrap: 'break-word' }}>
                      {step}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Regenerate Button */}
            <div className="pt-4 border-t">
              <button
                onClick={generateSummary}
                disabled={isLoading}
                className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Regenerating...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Regenerate Summary</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        </div>
        
        {/* Scroll Indicator */}
        {isScrollable && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none flex items-end justify-center pb-1">
            <div className="text-xs text-gray-400 animate-pulse">↓ Scroll for more ↓</div>
          </div>
        )}
      </div>
    </div>
  );
};
