import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  FolderOpen, 
  Calendar, 
  TrendingUp, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Archive, 
  Trash2, 
  Edit,
  Database,
  BarChart3,
  Filter
} from 'lucide-react';
import { 
  migrationProjectService, 
  MigrationProject, 
  CreateMigrationProjectRequest 
} from '../services/migrationProjectService';

interface MigrationProjectsListProps {
  onProjectSelect?: (project: MigrationProject) => void;
  onCreateProject?: () => void;
}

export const MigrationProjectsList: React.FC<MigrationProjectsListProps> = ({ 
  onProjectSelect,
  onCreateProject 
}) => {
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [total, setTotal] = useState(0);
  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  // Create project form state
  const [createForm, setCreateForm] = useState<CreateMigrationProjectRequest>({
    name: '',
    description: '',
    databricks_workspace_url: '',
    databricks_catalog_name: '',
    databricks_schema_name: '',
    created_by: 'user'
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [offset, statusFilter]);

  useEffect(() => {
    // Search with debounce
    const timer = setTimeout(() => {
      if (searchTerm.length > 2) {
        searchProjects();
      } else if (searchTerm.length === 0) {
        loadProjects();
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await migrationProjectService.getAllProjects(limit, offset);
      let filteredProjects = response.projects;
      
      if (statusFilter !== 'all') {
        filteredProjects = response.projects.filter(p => p.status === statusFilter);
      }
      
      setProjects(filteredProjects);
      setTotal(response.total);
    } catch (err) {
      setError('Failed to load migration projects');
      console.error('Error loading projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const searchProjects = async () => {
    if (!searchTerm.trim()) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await migrationProjectService.searchProjects(searchTerm, limit);
      let filteredProjects = response.projects;
      
      if (statusFilter !== 'all') {
        filteredProjects = response.projects.filter(p => p.status === statusFilter);
      }
      
      setProjects(filteredProjects);
    } catch (err) {
      setError('Failed to search migration projects');
      console.error('Error searching projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!createForm.name.trim()) {
      alert('Project name is required');
      return;
    }

    try {
      setCreating(true);
      
      const response = await migrationProjectService.createProject(createForm);
      
      // Add the new project to the list
      setProjects(prev => [response.project, ...prev]);
      
      // Reset form and close modal
      setCreateForm({
        name: '',
        description: '',
        databricks_workspace_url: '',
        databricks_catalog_name: '',
        databricks_schema_name: '',
        created_by: 'user'
      });
      setShowCreateModal(false);
      
      // Call the callback if provided
      onCreateProject?.();
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Failed to create project. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (project: MigrationProject) => {
    if (!confirm(`Are you sure you want to delete "${project.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await migrationProjectService.deleteProject(project.id);
      setProjects(prev => prev.filter(p => p.id !== project.id));
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Failed to delete project. Please try again.');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <TrendingUp className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      case 'archived': return <Archive className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading migration projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Migration Projects</h2>
          <p className="text-gray-600">Manage your Pentaho to PySpark migration projects</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        
        <div className="relative">
          <Filter className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      )}

      {/* Projects List */}
      {projects.length === 0 && !loading ? (
        <div className="text-center py-12">
          <FolderOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No migration projects found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'No projects match your search criteria.' : 'Get started by creating your first migration project.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>Create Project</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <div 
              key={project.id} 
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onProjectSelect?.(project)}
            >
              {/* Project Card Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">{project.name}</h3>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center space-x-1 ${migrationProjectService.getStatusColor(project.status)}`}>
                    {getStatusIcon(project.status)}
                    <span className="capitalize">{project.status}</span>
                  </div>
                </div>
                
                {project.description && (
                  <p className="text-gray-600 text-sm line-clamp-2">{project.description}</p>
                )}
                
                <div className="flex items-center text-xs text-gray-500 mt-2">
                  <Calendar className="h-3 w-3 mr-1" />
                  <span>Created {formatDate(project.created_at)}</span>
                </div>
              </div>

              {/* Project Metrics */}
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{project.total_workflows}</div>
                    <div className="text-xs text-gray-500">Total Workflows</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{project.converted_workflows}</div>
                    <div className="text-xs text-gray-500">Converted</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Progress</span>
                    <span>{Number(project.conversion_progress).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Number(project.conversion_progress)}%` }}
                    ></div>
                  </div>
                </div>

                {/* Databricks Info */}
                {project.databricks_catalog_name && (
                  <div className="flex items-center text-xs text-gray-500 mb-2">
                    <Database className="h-3 w-3 mr-1" />
                    <span className="truncate">{project.databricks_catalog_name}</span>
                  </div>
                )}

                {/* Failed Conversions */}
                {project.failed_conversions > 0 && (
                  <div className="flex items-center text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    <span>{project.failed_conversions} failed conversion{project.failed_conversions !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onProjectSelect?.(project);
                  }}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center space-x-1"
                >
                  <BarChart3 className="h-3 w-3" />
                  <span>View Dashboard</span>
                </button>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: Implement edit functionality
                    }}
                    className="text-gray-500 hover:text-gray-700"
                    title="Edit project"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project);
                    }}
                    className="text-red-500 hover:text-red-700"
                    title="Delete project"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - limit))}
            disabled={offset === 0}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total}
          </span>
          <button
            onClick={() => setOffset(offset + limit)}
            disabled={offset + limit >= total}
            className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900">Create Migration Project</h3>
              <p className="text-gray-600 text-sm mt-1">Set up a new Pentaho to PySpark migration project</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Basic Information */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Q4 ETL Migration"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe the purpose and scope of this migration project"
                />
              </div>

              {/* Databricks Configuration */}
              <div className="border-t border-gray-200 pt-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center space-x-2">
                  <Database className="h-4 w-4" />
                  <span>Databricks Configuration (Optional)</span>
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Workspace URL</label>
                    <input
                      type="url"
                      value={createForm.databricks_workspace_url}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, databricks_workspace_url: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="https://your-workspace.cloud.databricks.com"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Catalog Name</label>
                      <input
                        type="text"
                        value={createForm.databricks_catalog_name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, databricks_catalog_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="migration_catalog"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Schema Name</label>
                      <input
                        type="text"
                        value={createForm.databricks_schema_name}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, databricks_schema_name: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="pentaho_migration"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 p-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating || !createForm.name.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
              >
                {creating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                <span>{creating ? 'Creating...' : 'Create Project'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
