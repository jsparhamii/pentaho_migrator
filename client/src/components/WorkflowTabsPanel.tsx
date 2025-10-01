import React, { useState, useEffect, useRef } from 'react';
import { PentahoWorkflow, WorkflowSummary } from '../types';
import { aiService, PySparkConversion } from '../services/aiService';
import { MigrationProjectService } from '../services/migrationProjectService';
import { 
  FileText, 
  Code,
  Loader2, 
  Brain, 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  GitBranch, 
  Layers, 
  Maximize2, 
  Minimize2, 
  Info,
  AlertCircle, 
  CheckCircle, 
  Clock,
  Copy,
  Download,
  Package,
  Lightbulb
} from 'lucide-react';

interface WorkflowTabsPanelProps {
  workflow: PentahoWorkflow;
  projectId?: string; // Optional project to link conversions to
  onSummaryGenerated?: (summary: WorkflowSummary) => void;
  onClose?: () => void;
}

type TabType = 'summary' | 'pyspark';

export const WorkflowTabsPanel: React.FC<WorkflowTabsPanelProps> = ({ 
  workflow, 
  projectId,
  onSummaryGenerated,
  onClose 
}) => {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [isExpanded, setIsExpanded] = useState(false);

  // Summary state
  const [summary, setSummary] = useState<WorkflowSummary | null>(workflow.workflowSummary || null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(false);

  // PySpark state
  const [pySparkConversion, setPySparkConversion] = useState<PySparkConversion | null>(null);
  const [pySparkLoading, setPySparkLoading] = useState(false);
  const [pySparkError, setPySparkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Scroll state
  const [isScrollable, setIsScrollable] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Services
  const migrationService = new MigrationProjectService();

  useEffect(() => {
    const checkAIStatus = async () => {
      const status = await aiService.getAIStatus();
      setAiAvailable(status.available);
    };
    checkAIStatus();
  }, []);

  // Check for existing conversion and summary on mount
  useEffect(() => {
    if (projectId && workflow?.name) {
      console.log(`🔍 Checking for existing conversion/summary for workflow: ${workflow.name}`);
      checkExistingData();
    }
  }, [projectId, workflow?.name]);

  const checkExistingData = async () => {
    if (!projectId || !workflow?.name) return;

    try {
      // Check for existing PySpark conversion
      const existingConversion = await migrationService.getExistingConversion(projectId, workflow.name);
      if (existingConversion && existingConversion.conversion_status === 'completed') {
        console.log(`✅ Found existing PySpark conversion for: ${workflow.name}`);
        setPySparkConversion({
          success: true,
          pysparkCode: existingConversion.generated_code || '',
          originalWorkflow: workflow.name,
          conversionNotes: existingConversion.conversion_notes || [],
          estimatedComplexity: existingConversion.estimated_complexity || 'Medium',
          requiredLibraries: existingConversion.required_libraries || [],
          databricksNotebook: existingConversion.generated_notebook || null
        });
      }

      // Check if workflow already has a summary
      if (workflow.workflowSummary) {
        console.log(`✅ Found existing workflow summary for: ${workflow.name}`);
        setSummary(workflow.workflowSummary);
      }
    } catch (error) {
      console.error('Error checking existing data:', error);
      // Don't show error to user - just proceed without existing data
    }
  };

  useEffect(() => {
    // Reset summary when workflow changes
    setSummary(workflow.workflowSummary || null);
  }, [workflow]);

  useEffect(() => {
    const checkScrollable = () => {
      if (contentRef.current) {
        const { scrollHeight, clientHeight } = contentRef.current;
        setIsScrollable(scrollHeight > clientHeight);
      }
    };

    checkScrollable();
    const timer = setTimeout(checkScrollable, 100);
    
    return () => clearTimeout(timer);
  }, [summary, pySparkConversion, isExpanded, activeTab]);

  // Summary functions
  const generateSummary = async () => {
    // Check if summary already exists
    if (summary) {
      console.log(`ℹ️ Summary already exists for workflow: ${workflow.name}`);
      return;
    }

    setSummaryLoading(true);
    setSummaryError(null);
    
    try {
      console.log(`🧠 Generating new summary for workflow: ${workflow.name}`);
      const generatedSummary = await aiService.generateWorkflowSummary(workflow);
      if (generatedSummary) {
        setSummary(generatedSummary);
        onSummaryGenerated?.(generatedSummary);

        // Save summary to database if we have project context
        // Note: Summary persistence would require workflow to have fileId - this is a limitation
        // For full persistence, we'd need to pass the fileId as a prop from ProjectFileBrowser
        console.log(`✅ Summary generated for workflow: ${workflow.name}`);
      } else {
        setSummaryError('Failed to generate workflow summary');
      }
    } catch (err) {
      console.error('Error generating summary:', err);
      setSummaryError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setSummaryLoading(false);
    }
  };

  // PySpark functions
  const convertToPySpark = async () => {
    // Check if conversion already exists
    if (pySparkConversion) {
      console.log(`ℹ️ PySpark conversion already exists for workflow: ${workflow.name}`);
      return;
    }

    setPySparkLoading(true);
    setPySparkError(null);
    
    try {
      console.log(`🔧 Starting new PySpark conversion for workflow: ${workflow.name}`);
      let conversion: PySparkConversion | null = null;
      
      if (projectId) {
        // Convert through project API to link to migration project
        console.log(`🔄 Converting workflow through project ${projectId}: ${workflow.name}`);
        const response = await migrationService.convertWorkflow(
          projectId,
          workflow,
          `${workflow.name}.${workflow.type === 'transformation' ? 'ktr' : 'kjb'}`,
          JSON.stringify(workflow).length,
          new Date().toISOString()
        );
        
        if (response.conversion && response.conversion.generated_code) {
          conversion = {
            success: true,
            pysparkCode: response.conversion.generated_code,
            originalWorkflow: workflow.name,
            conversionNotes: response.conversion.conversion_notes || [],
            estimatedComplexity: response.conversion.estimated_complexity || 'Medium',
            requiredLibraries: response.conversion.required_libraries || [],
            databricksNotebook: response.conversion.generated_notebook || null
          };
          console.log(`✅ Workflow converted through project: ${response.conversion.id}`);
        } else {
          throw new Error('Failed to convert through project API - no generated code received');
        }
      } else {
        // Convert directly without project linking
        console.log(`🔄 Converting workflow directly: ${workflow.name}`);
        conversion = await aiService.convertToPySpark(workflow);
      }
      
      if (conversion) {
        setPySparkConversion(conversion);
      } else {
        setPySparkError('Failed to convert to PySpark');
      }
    } catch (err) {
      console.error('Conversion error:', err);
      setPySparkError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setPySparkLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!pySparkConversion) return;
    
    try {
      await navigator.clipboard.writeText(pySparkConversion.pysparkCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const downloadNotebook = async () => {
    if (!pySparkConversion) return;
    
    try {
      setDownloading(true);
      await aiService.downloadDatabricksNotebook(pySparkConversion);
    } catch (error) {
      console.error('Failed to download notebook:', error);
      alert('Failed to download notebook. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // Utility functions
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

  const renderSummaryTab = () => {
    if (!aiAvailable) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 flex items-center space-x-2">
          <Info className="h-5 w-5" />
          <p className="text-sm">AI summaries are not available. Please configure an API key in `server/.env` to enable AI features.</p>
        </div>
      );
    }

    if (summaryLoading) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Analyzing workflow structure...</p>
          <p className="text-sm text-gray-500 mt-2">
            Large workflows may take longer as they're processed in chunks
          </p>
        </div>
      );
    }

    if (summaryError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700 font-medium">Error generating summary</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{summaryError}</p>
          <button
            onClick={generateSummary}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      );
    }

    if (!summary) {
      return (
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
      );
    }

    return (
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
          <div className={`px-4 py-2 rounded-full flex items-center space-x-2 border ${getComplexityColor(summary.complexity)}`}>
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
            disabled={summaryLoading}
            className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {summaryLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
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
    );
  };

  const renderPySparkTab = () => {
    if (!aiAvailable) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 text-yellow-700 p-4 flex items-center space-x-2">
          <Info className="h-5 w-5" />
          <p className="text-sm">PySpark conversion is not available. Please configure an API key in `server/.env` to enable AI features.</p>
        </div>
      );
    }

    if (pySparkLoading) {
      return (
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Converting workflow to PySpark...</p>
          <p className="text-sm text-gray-500 mt-2">
            This may take a moment for complex workflows
          </p>
        </div>
      );
    }

    if (pySparkError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-red-700 font-medium">Error converting to PySpark</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{pySparkError}</p>
          <button
            onClick={convertToPySpark}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      );
    }

    if (!pySparkConversion) {
      return (
        <div className="text-center py-8">
          <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">Convert this workflow to PySpark code that can run on Databricks.</p>
          <button
            onClick={convertToPySpark}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <span>🐍</span>
            <span>Convert to PySpark</span>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Metadata Panel */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Required Libraries */}
            <div>
              <h4 className="font-medium text-gray-900 mb-2 flex items-center space-x-1">
                <Package className="h-4 w-4" />
                <span>Required Libraries</span>
              </h4>
              <div className="flex flex-wrap gap-1">
                {pySparkConversion.requiredLibraries.map((lib, index) => (
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
          {pySparkConversion.conversionNotes.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2 flex items-center space-x-1">
                <Lightbulb className="h-4 w-4" />
                <span>Conversion Notes</span>
              </h4>
              <ul className="space-y-1">
                {pySparkConversion.conversionNotes.map((note, index) => (
                  <li key={index} className="text-sm text-gray-600 flex items-start space-x-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Complexity Badge */}
          <div className="mt-4 flex justify-center">
            <div className={`px-3 py-1 rounded-full flex items-center space-x-1 border ${getComplexityColor(pySparkConversion.estimatedComplexity)}`}>
              {getComplexityIcon(pySparkConversion.estimatedComplexity)}
              <span className="text-sm font-medium">{pySparkConversion.estimatedComplexity} Complexity</span>
            </div>
          </div>
        </div>

        {/* Code Display */}
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm">
            <code className="language-python text-gray-100 whitespace-pre-wrap break-words" style={{ 
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              lineHeight: '1.5'
            }}>
              {pySparkConversion.pysparkCode}
            </code>
          </pre>
        </div>

        {/* Regenerate Button */}
        <div className="pt-4 border-t">
          <button
            onClick={convertToPySpark}
            disabled={pySparkLoading}
            className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {pySparkLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <span>🐍</span>
                <span>Regenerate PySpark Code</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg shadow-xl border transition-all duration-300 ${
      isExpanded ? 'max-w-6xl' : 'max-w-4xl'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1">
            {activeTab === 'summary' ? (
              <Brain className="h-5 w-5 text-blue-600" />
            ) : (
              <Code className="h-5 w-5 text-purple-600" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {activeTab === 'summary' ? 'AI Workflow Summary' : 'PySpark Conversion'}
            </h3>
            <p className="text-sm text-gray-600">{workflow.name}</p>
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
          
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-red-600 transition-colors p-1 hover:bg-white rounded"
              title="Close panel"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'summary'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>AI Summary</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('pyspark')}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'pyspark'
                ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center space-x-2">
              <span>🐍</span>
              <span>PySpark Code</span>
            </div>
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
          {activeTab === 'summary' ? renderSummaryTab() : renderPySparkTab()}
        </div>
        
        {/* Scroll Indicator */}
        {isScrollable && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none flex items-end justify-center pb-1">
            <div className="text-xs text-gray-400 animate-pulse">↓ Scroll for more ↓</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t bg-gray-50 text-xs text-gray-500">
        <p>
          {activeTab === 'summary' 
            ? 'AI-generated workflow analysis to help understand data flow and business logic.'
            : 'Generated PySpark code for Databricks. Review and test before using in production.'
          }
        </p>
      </div>
    </div>
  );
};
