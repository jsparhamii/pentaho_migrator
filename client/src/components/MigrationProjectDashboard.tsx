import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Database,
  FileText,
  Code,
  Download,
  RefreshCw,
  Calendar,
  User,
  Settings,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Files,
  BarChart
} from 'lucide-react';
import { 
  migrationProjectService, 
  MigrationProject, 
  WorkflowConversion,
  ProjectDashboard,
  ProjectStats,
  ConversionStats 
} from '../services/migrationProjectService';
import { ProjectFileBrowser } from './ProjectFileBrowser';

interface MigrationProjectDashboardProps {
  projectId: string;
  onBack?: () => void;
  onConvertWorkflow?: (projectId: string) => void;
}

type TabType = 'overview' | 'files';

export const MigrationProjectDashboard: React.FC<MigrationProjectDashboardProps> = ({ 
  projectId, 
  onBack,
  onConvertWorkflow 
}) => {
  const [dashboard, setDashboard] = useState<ProjectDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  useEffect(() => {
    loadDashboard();
  }, [projectId]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const dashboardData = await migrationProjectService.getProjectDashboard(projectId);
      setDashboard(dashboardData);
    } catch (err) {
      setError('Failed to load project dashboard');
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'processing': return <Clock className="h-4 w-4 text-yellow-600 animate-pulse" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending': return <Clock className="h-4 w-4 text-gray-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Dashboard</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { project, stats, conversionStats, recentConversions } = dashboard;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to projects"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${migrationProjectService.getStatusColor(project.status)}`}>
                <span className="capitalize">{project.status}</span>
              </div>
            </div>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          
          {onConvertWorkflow && (
            <button
              onClick={() => onConvertWorkflow(projectId)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Code className="h-4 w-4" />
              <span>Convert Workflow</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              activeTab === 'overview'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <BarChart className="h-4 w-4" />
              <span>Dashboard</span>
            </div>
          </button>
          
          <button
            onClick={() => setActiveTab('files')}
            className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
              activeTab === 'files'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center space-x-2">
              <Files className="h-4 w-4" />
              <span>Files & Workflows</span>
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'files' ? (
        <ProjectFileBrowser projectId={projectId} />
      ) : (
        <div>
          {/* Project Metadata */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-center space-x-3">
            <Calendar className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Created</div>
              <div className="font-medium">{formatDate(project.created_at)}</div>
            </div>
          </div>
          
          {project.created_by && (
            <div className="flex items-center space-x-3">
              <User className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Created By</div>
                <div className="font-medium">{project.created_by}</div>
              </div>
            </div>
          )}
          
          {project.databricks_catalog_name && (
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Databricks Catalog</div>
                <div className="font-medium">{project.databricks_catalog_name}</div>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            <div>
              <div className="text-sm text-gray-500">Last Updated</div>
              <div className="font-medium">{formatDate(project.updated_at)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats?.totalWorkflows || 0}</div>
              <div className="text-sm text-gray-500">Total Workflows</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats?.completedWorkflows || 0}</div>
              <div className="text-sm text-gray-500">Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats?.failedWorkflows || 0}</div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats?.pendingWorkflows || 0}</div>
              <div className="text-sm text-gray-500">Pending</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Conversion Progress</span>
          </h3>
          
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Overall Progress</span>
              <span className="text-sm font-bold text-gray-900">{Number(stats?.progressPercentage || 0).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Number(stats?.progressPercentage || 0)}%` }}
              ></div>
            </div>
          </div>

          {conversionStats && (
            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{conversionStats.completed}</div>
                <div className="text-xs text-gray-500">Completed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-bold text-red-600">{conversionStats.failed}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
            </div>
          )}
        </div>

        {/* Complexity Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
            <PieChart className="h-5 w-5" />
            <span>Complexity Distribution</span>
          </h3>
          
          {conversionStats && (
            <div className="space-y-3">
              {Object.entries(conversionStats.byComplexity).map(([complexity, count]) => (
                <div key={complexity} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 rounded-full ${migrationProjectService.getComplexityColor(complexity).includes('green') ? 'bg-green-500' : 
                      migrationProjectService.getComplexityColor(complexity).includes('yellow') ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                    <span className="text-sm text-gray-600">{complexity}</span>
                  </div>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
              
              {conversionStats.averageProcessingTime > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Avg Processing Time</span>
                    <span className="font-medium">{migrationProjectService.formatProcessingTime(conversionStats.averageProcessingTime)}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Conversions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Recent Conversions</span>
          </h3>
        </div>
        
        <div className="divide-y divide-gray-200">
          {recentConversions && recentConversions.length > 0 ? (
            recentConversions.map((conversion) => (
              <div key={conversion.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h4 className="font-medium text-gray-900">{conversion.source_workflow_name}</h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {conversion.source_workflow_type}
                      </span>
                      {conversion.estimated_complexity && (
                        <span className={`text-xs px-2 py-1 rounded-full border ${migrationProjectService.getComplexityColor(conversion.estimated_complexity)}`}>
                          {conversion.estimated_complexity}
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>Updated {formatDate(conversion.updated_at)}</span>
                      {conversion.ai_processing_time_ms && (
                        <span>Processed in {migrationProjectService.formatProcessingTime(conversion.ai_processing_time_ms)}</span>
                      )}
                      {conversion.generated_code_size > 0 && (
                        <span>Code: {migrationProjectService.formatFileSize(conversion.generated_code_size)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${migrationProjectService.getConversionStatusColor(conversion.conversion_status)}`}>
                      {getStatusIcon(conversion.conversion_status)}
                      <span className="ml-1 capitalize">{conversion.conversion_status}</span>
                    </div>
                    
                    {conversion.conversion_status === 'completed' && conversion.generated_code && (
                      <button
                        onClick={() => {
                          // TODO: Show code viewer or download
                        }}
                        className="text-blue-600 hover:text-blue-800"
                        title="View generated code"
                      >
                        <Code className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                {conversion.error_message && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                    <strong>Error:</strong> {conversion.error_message}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
              <p>No conversions yet</p>
              <p className="text-sm">Start by converting your first workflow</p>
            </div>
          )}
        </div>
        
        {recentConversions && recentConversions.length > 0 && (
          <div className="p-4 border-t border-gray-200 text-center">
            <button
              onClick={() => {
                // TODO: Navigate to full conversions list
              }}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              View All Conversions
            </button>
          </div>
        )}
      </div>
        </div>
      )}
    </div>
  );
};
