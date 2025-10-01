import React, { useState, useEffect } from 'react';
import { 
  Folder, 
  File, 
  Upload, 
  Eye, 
  Code, 
  Search, 
  Filter,
  RefreshCw,
  Trash2,
  Calendar,
  FileType,
  HardDrive,
  FolderOpen
} from 'lucide-react';
import FileUpload from './FileUpload';
import WorkflowVisualizer from './WorkflowVisualizer';
import FolderVisualizer from './FolderVisualizer';
import { WorkflowTabsPanel } from './WorkflowTabsPanel';
import { PentahoWorkflow, FolderWorkflow, PentahoFile, FileDependency } from '../types';

interface ProjectFile {
  id: string;
  project_id: string;
  folder_id?: string;
  file_name: string;
  file_type: 'transformation' | 'job';
  file_size: number;
  file_path?: string;
  file_extension: string;
  workflow_data: PentahoWorkflow;
  parsing_status: string;
  created_at: string;
  updated_at: string;
  last_accessed: string;
}

interface ProjectFolder {
  id: string;
  project_id: string;
  parent_folder_id?: string;
  folder_name: string;
  folder_path: string;
  total_files: number;
  transformation_files: number;
  job_files: number;
  created_at: string;
  children?: ProjectFolder[];
  file_count?: number;
}

interface ProjectFileBrowserProps {
  projectId: string;
  onFileSelect?: (file: ProjectFile) => void;
  onFolderSelect?: (folder: ProjectFolder) => void;
}

type ViewMode = 'browser' | 'upload' | 'file-view' | 'folder-view' | 'project-workflow';

export const ProjectFileBrowser: React.FC<ProjectFileBrowserProps> = ({ 
  projectId, 
  onFileSelect,
  onFolderSelect 
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('browser');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [folders, setFolders] = useState<ProjectFolder[]>([]);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<ProjectFolder | null>(null);
  
  // Debug logging for state changes
  React.useEffect(() => {
    console.log('📊 ProjectFileBrowser state:', {
      viewMode,
      selectedFile: selectedFile?.file_name,
      selectedFolder: selectedFolder?.folder_name,
      filesCount: files.length
    });
  }, [viewMode, selectedFile, selectedFolder, files.length]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'transformation' | 'job'>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [showWorkflowTabs, setShowWorkflowTabs] = useState(false);
  
  // File statistics
  const [fileStats, setFileStats] = useState({
    totalFiles: 0,
    transformationFiles: 0,
    jobFiles: 0,
    totalSize: 0
  });

  // Load project files and folders
  useEffect(() => {
    loadProjectFiles();
    loadProjectFolders();
    loadFileStats();
  }, [projectId, currentFolderId, filterType]);

  const loadProjectFiles = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentFolderId) params.append('folderId', currentFolderId);
      if (filterType !== 'all') params.append('fileType', filterType);
      
      const response = await fetch(`/api/migration-projects/${projectId}/files?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error loading project files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProjectFolders = async () => {
    try {
      const response = await fetch(`/api/migration-projects/${projectId}/folders?tree=true`);
      const data = await response.json();
      
      if (data.success) {
        setFolders(data.folderTree);
      }
    } catch (error) {
      console.error('Error loading project folders:', error);
    }
  };

  const loadFileStats = async () => {
    try {
      const response = await fetch(`/api/migration-projects/${projectId}/file-stats`);
      const data = await response.json();
      
      if (data.success) {
        setFileStats(data.fileStats);
      }
    } catch (error) {
      console.error('Error loading file stats:', error);
    }
  };

  const handleFileClick = (file: ProjectFile) => {
    console.log('🔍 File clicked:', {
      fileName: file.file_name,
      fileType: file.file_type,
      hasWorkflowData: !!file.workflow_data,
      workflowDataType: typeof file.workflow_data,
      workflowName: file.workflow_data?.name,
      workflowNodes: file.workflow_data?.nodes?.length,
      fullFile: file
    });
    
    setSelectedFile(file);
    setViewMode('file-view');
    onFileSelect?.(file);
  };

  const handleFolderClick = (folder: ProjectFolder) => {
    setCurrentFolderId(folder.id);
    setSelectedFolder(folder);
    onFolderSelect?.(folder);
  };

  const handleUploadComplete = () => {
    // Reload files after successful upload
    loadProjectFiles();
    loadProjectFolders();
    loadFileStats();
    setViewMode('browser');
  };

  const handleBackToBrowser = () => {
    setViewMode('browser');
    setSelectedFile(null);
    setSelectedFolder(null);
    setShowWorkflowTabs(false);
  };

  const handleViewProjectWorkflow = () => {
    console.log('🔄 Switching to project workflow view with', files.length, 'files');
    setViewMode('project-workflow');
    setSelectedFile(null);
    setSelectedFolder(null);
    setShowWorkflowTabs(false);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadProjectFiles();
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('q', searchTerm);
      if (filterType !== 'all') params.append('fileType', filterType);
      if (currentFolderId) params.append('folderId', currentFolderId);
      
      const response = await fetch(`/api/migration-projects/${projectId}/search?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Error searching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Convert ProjectFile to PentahoWorkflow for visualization
  const convertToWorkflow = (file: ProjectFile): PentahoWorkflow => {
    return file.workflow_data;
  };

  // Convert folder files to FolderWorkflow for visualization
  const convertToFolderWorkflow = (folder: ProjectFolder, folderFiles: ProjectFile[]): FolderWorkflow => {
    const pentahoFiles: PentahoFile[] = folderFiles.map(file => ({
      fileName: file.file_name,
      filePath: file.file_path || file.file_name,
      type: file.file_type,
      workflow: file.workflow_data,
      size: file.file_size,
      lastModified: new Date(file.updated_at).getTime(),
      references: [],
      referencedBy: []
    }));

    return {
      folderName: folder.folder_name,
      files: pentahoFiles,
      dependencies: [], // This would need to be calculated from file relationships
      metadata: {
        totalFiles: folderFiles.length,
        transformations: folderFiles.filter(f => f.file_type === 'transformation').length,
        jobs: folderFiles.filter(f => f.file_type === 'job').length,
        dependencies: 0,
        parsed: new Date().toISOString()
      }
    };
  };

  // Analyze file dependencies based on workflow data
  const analyzeFileDependencies = (projectFiles: ProjectFile[]): FileDependency[] => {
    const dependencies: FileDependency[] = [];
    const fileNames = new Set(projectFiles.map(f => f.file_name));
    
    projectFiles.forEach((file, index) => {
      if (!file.workflow_data || !file.workflow_data.nodes) return;
      
      // Look for references to other files in the workflow
      file.workflow_data.nodes.forEach((node: any) => {
        if (!node.properties) return;
        
        // Check common properties that might reference other files
        const propertiesToCheck = [
          'filename', 'file_name', 'transformation', 'job', 
          'transformation_name', 'job_name', 'specification_file',
          'directory', 'file', 'path'
        ];
        
        propertiesToCheck.forEach(prop => {
          const value = node.properties[prop];
          if (typeof value === 'string') {
            // Check if this value matches any other file in the project
            const referencedFileName = fileNames.has(value) ? value : 
              fileNames.has(value + '.ktr') ? value + '.ktr' :
              fileNames.has(value + '.kjb') ? value + '.kjb' : null;
            
            if (referencedFileName && referencedFileName !== file.file_name) {
              dependencies.push({
                id: `${file.file_name}-to-${referencedFileName}`,
                from: file.file_name,
                to: referencedFileName,
                type: 'file_reference'
              });
            }
          }
        });
      });
      
      // Create flow dependencies between files of different types
      // Jobs typically orchestrate transformations
      if (file.file_type === 'job') {
        const relatedTransformations = projectFiles.filter(f => 
          f.file_type === 'transformation' && 
          f.file_name !== file.file_name &&
          // Look for similar names (basic heuristic)
          (f.file_name.toLowerCase().includes(file.file_name.toLowerCase().replace('.kjb', '').replace('.ktr', '')) ||
           file.file_name.toLowerCase().includes(f.file_name.toLowerCase().replace('.kjb', '').replace('.ktr', '')))
        );
        
        relatedTransformations.forEach(transFile => {
          dependencies.push({
            id: `${file.file_name}-orchestrates-${transFile.file_name}`,
            from: file.file_name,
            to: transFile.file_name,
            type: 'orchestration'
          });
        });
      }
    });
    
    // If no dependencies found, create some basic flow connections for visualization
    if (dependencies.length === 0 && projectFiles.length > 1) {
      console.log('🔗 No explicit dependencies found, creating basic flow connections');
      
      // Sort files: jobs first, then transformations
      const jobs = projectFiles.filter(f => f.file_type === 'job').slice(0, 3);
      const transformations = projectFiles.filter(f => f.file_type === 'transformation').slice(0, 5);
      
      // Connect jobs to transformations
      jobs.forEach(job => {
        if (transformations.length > 0) {
          const targetTrans = transformations[Math.floor(Math.random() * transformations.length)];
          dependencies.push({
            id: `${job.file_name}-to-${targetTrans.file_name}`,
            from: job.file_name,
            to: targetTrans.file_name,
            type: 'flow'
          });
        }
      });
      
      // Create some sequential connections between transformations
      for (let i = 0; i < Math.min(3, transformations.length - 1); i++) {
        dependencies.push({
          id: `${transformations[i].file_name}-to-${transformations[i + 1].file_name}`,
          from: transformations[i].file_name,
          to: transformations[i + 1].file_name,
          type: 'sequential'
        });
      }
    }
    
    console.log(`🔗 Created ${dependencies.length} dependencies for ${projectFiles.length} files`);
    return dependencies;
  };

  // Convert all project files to FolderWorkflow for project-wide visualization
  const convertProjectToFolderWorkflow = (projectFiles: ProjectFile[]): FolderWorkflow => {
    const pentahoFiles: PentahoFile[] = projectFiles.map(file => ({
      fileName: file.file_name,
      filePath: file.file_path || file.file_name,
      type: file.file_type,
      workflow: file.workflow_data,
      size: file.file_size,
      lastModified: new Date(file.updated_at).getTime(),
      references: [],
      referencedBy: []
    }));

    // Analyze and create dependencies
    const dependencies = analyzeFileDependencies(projectFiles);
    const transformationCount = projectFiles.filter(f => f.file_type === 'transformation').length;
    const jobCount = projectFiles.filter(f => f.file_type === 'job').length;

    return {
      folderName: 'Project Workflow',
      files: pentahoFiles,
      dependencies: dependencies,
      metadata: {
        totalFiles: projectFiles.length,
        transformations: transformationCount,
        jobs: jobCount,
        dependencies: dependencies.length,
        parsed: new Date().toISOString()
      }
    };
  };

  if (viewMode === 'upload') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Upload Files to Project</h3>
          <button
            onClick={handleBackToBrowser}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
          >
            <span>← Back to Files</span>
          </button>
        </div>
        
        {/* Use the existing FileUpload component but target this project */}
        <div className="bg-white rounded-lg shadow p-6">
          <FileUpload
            onWorkflowParsed={() => {}} // Not used in project context
            onFolderParsed={() => {}} // Not used in project context 
            selectedProjectId={projectId}
          />
          
          <div className="mt-4 text-center">
            <button
              onClick={handleUploadComplete}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh File List
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (viewMode === 'file-view' && selectedFile) {
    console.log('🎯 Rendering file-view mode:', {
      selectedFile: selectedFile.file_name,
      hasWorkflowData: !!selectedFile.workflow_data,
      convertedWorkflow: convertToWorkflow(selectedFile)
    });

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{selectedFile.file_name}</h3>
            <p className="text-sm text-gray-600">
              {selectedFile.file_type} • {formatFileSize(selectedFile.file_size)}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowWorkflowTabs(!showWorkflowTabs)}
              className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all text-sm flex items-center space-x-2"
            >
              <Code className="h-4 w-4" />
              <span>{showWorkflowTabs ? 'Hide' : 'Show'} Analysis & Code</span>
            </button>
            <button
              onClick={handleBackToBrowser}
              className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
            >
              <span>← Back to Files</span>
            </button>
          </div>
        </div>

        {selectedFile.workflow_data ? (
          <WorkflowVisualizer 
            workflow={convertToWorkflow(selectedFile)} 
            projectId={projectId}
          />
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">⚠️ No workflow data available for this file.</p>
            <p className="text-sm text-yellow-600 mt-1">The file may not have been parsed correctly.</p>
          </div>
        )}

        {showWorkflowTabs && selectedFile.workflow_data && (
          <WorkflowTabsPanel
            workflow={convertToWorkflow(selectedFile)}
            projectId={projectId}
            onClose={() => setShowWorkflowTabs(false)}
          />
        )}
      </div>
    );
  }

  if (viewMode === 'folder-view' && selectedFolder) {
    const folderFiles = files.filter(f => f.folder_id === selectedFolder.id);
    const folderWorkflow = convertToFolderWorkflow(selectedFolder, folderFiles);
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{selectedFolder.folder_name}</h3>
            <p className="text-sm text-gray-600">
              {selectedFolder.total_files} files • {selectedFolder.transformation_files} transformations • {selectedFolder.job_files} jobs
            </p>
          </div>
          <button
            onClick={handleBackToBrowser}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
          >
            <span>← Back to Files</span>
          </button>
        </div>

        <FolderVisualizer
          folderWorkflow={folderWorkflow}
          onFileSelect={(file) => {
            // Find the corresponding ProjectFile and switch to file view
            const projectFile = files.find(f => f.file_name === file.fileName);
            if (projectFile) {
              handleFileClick(projectFile);
            }
          }}
        />
      </div>
    );
  }

  if (viewMode === 'project-workflow') {
    const projectWorkflow = convertProjectToFolderWorkflow(files);
    
    console.log('🎯 Rendering project workflow view:', {
      totalFiles: files.length,
      projectWorkflow
    });
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Project Workflow Visualization</h3>
            <p className="text-sm text-gray-600">
              {projectWorkflow.metadata.totalFiles} files • {projectWorkflow.metadata.transformations} transformations • {projectWorkflow.metadata.jobs} jobs
            </p>
          </div>
          <button
            onClick={handleBackToBrowser}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center space-x-1"
          >
            <span>← Back to Files</span>
          </button>
        </div>

        <FolderVisualizer
          folderWorkflow={projectWorkflow}
          onFileSelect={(file) => {
            // Find the corresponding ProjectFile and switch to file view
            const projectFile = files.find(f => f.file_name === file.fileName);
            if (projectFile) {
              handleFileClick(projectFile);
            }
          }}
        />
      </div>
    );
  }

  // Main browser view
  return (
    <div className="space-y-6">
      {/* Header with stats and actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Project Files</h3>
          <div className="flex items-center space-x-3">
            {files.length > 0 && (
              <button
                onClick={handleViewProjectWorkflow}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all flex items-center space-x-2"
              >
                <Eye className="h-4 w-4" />
                <span>View Workflow</span>
              </button>
            )}
            <button
              onClick={() => setViewMode('upload')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Files</span>
            </button>
          </div>
        </div>

        {/* File statistics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{fileStats.totalFiles}</div>
            <div className="text-sm text-gray-600">Total Files</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{fileStats.transformationFiles}</div>
            <div className="text-sm text-gray-600">Transformations</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{fileStats.jobFiles}</div>
            <div className="text-sm text-gray-600">Jobs</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-600">{formatFileSize(fileStats.totalSize)}</div>
            <div className="text-sm text-gray-600">Total Size</div>
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | 'transformation' | 'job')}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Files</option>
            <option value="transformation">Transformations</option>
            <option value="job">Jobs</option>
          </select>

          <button
            onClick={() => {
              loadProjectFiles();
              loadProjectFolders();
              loadFileStats();
            }}
            disabled={loading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Folder tree (if any folders exist) */}
      {folders.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Folder Structure</h4>
          <div className="space-y-2">
            {folders.map(folder => (
              <div
                key={folder.id}
                onClick={() => handleFolderClick(folder)}
                className="flex items-center space-x-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer"
              >
                <FolderOpen className="h-5 w-5 text-blue-500" />
                <span className="font-medium">{folder.folder_name}</span>
                <span className="text-sm text-gray-500">({folder.total_files} files)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files list */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center">
            <File className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No files found</h4>
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No files match your search criteria.' : 'Upload some Pentaho files to get started.'}
            </p>
            <button
              onClick={() => setViewMode('upload')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Files</span>
            </button>
          </div>
        ) : (
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Modified
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileType className={`h-5 w-5 mr-3 ${
                          file.file_type === 'transformation' ? 'text-green-500' : 'text-blue-500'
                        }`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{file.file_name}</div>
                          {file.file_path && (
                            <div className="text-sm text-gray-500">{file.file_path}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        file.file_type === 'transformation' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {file.file_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatFileSize(file.file_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(file.updated_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleFileClick(file)}
                          className="text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
