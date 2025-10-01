import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, AlertCircle, Folder, File, FolderOpen } from 'lucide-react';
import axios from 'axios';
import { PentahoWorkflow, ParseResult, FolderWorkflow, FolderParseResult } from '../types';
import { MigrationProjectService, MigrationProject } from '../services/migrationProjectService';

interface FileUploadProps {
  onWorkflowParsed: (workflow: PentahoWorkflow, fileName: string) => void;
  onFolderParsed: (folderWorkflow: FolderWorkflow, folderName: string) => void;
  selectedProjectId?: string; // Optional project to link files to
  onProjectChange?: (projectId: string | null) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ 
  onWorkflowParsed, 
  onFolderParsed, 
  selectedProjectId,
  onProjectChange 
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadMode, setUploadMode] = useState<'file' | 'folder'>('file');
  
  // Project selection state
  const [projects, setProjects] = useState<MigrationProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [localSelectedProjectId, setLocalSelectedProjectId] = useState<string | null>(selectedProjectId || null);

  const migrationService = new MigrationProjectService();

  // Load projects on mount
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true);
        const projectsResponse = await migrationService.getAllProjects();
        setProjects(projectsResponse.projects);
      } catch (error) {
        console.warn('Failed to load projects:', error);
      } finally {
        setProjectsLoading(false);
      }
    };

    loadProjects();
  }, []);

  // Handle project selection change
  const handleProjectChange = useCallback((projectId: string | null) => {
    setLocalSelectedProjectId(projectId);
    onProjectChange?.(projectId);
  }, [onProjectChange]);

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.ktr') && !fileName.endsWith('.ktj') && !fileName.endsWith('.kjb')) {
      setError('Please upload a valid KTR, KTJ, or KJB file');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Use persistent project upload if project is selected
      if (localSelectedProjectId) {
        const formData = new FormData();
        formData.append('files', file);
        formData.append('uploadType', 'single_file');

        const response = await axios.post(`http://localhost:3001/api/migration-projects/${localSelectedProjectId}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          console.log('✅ File uploaded and persisted to database!', response.data);
          // Still call the callback for backward compatibility
          if (response.data.processedFiles && response.data.processedFiles.length > 0) {
            onWorkflowParsed(response.data.processedFiles[0].workflow || {}, response.data.processedFiles[0].fileName || file.name);
          }
        } else {
          setError(response.data.error || 'Failed to upload file to project');
        }
      } else {
        // Fallback to old non-persistent endpoint (for backward compatibility)
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post<ParseResult>('/api/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success && response.data.workflow) {
          onWorkflowParsed(response.data.workflow, response.data.fileName);
        } else {
          setError(response.data.error || 'Failed to parse file');
        }
      }
    } catch (err) {
      console.error('Upload error:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsUploading(false);
    }
  }, [onWorkflowParsed, localSelectedProjectId]);

  const handleFolder = useCallback(async (files: FileList) => {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(file => {
      const fileName = file.name.toLowerCase();
      return fileName.endsWith('.ktr') || fileName.endsWith('.ktj') || fileName.endsWith('.kjb');
    });

    if (validFiles.length === 0) {
      setError('No valid KTR, KTJ, or KJB files found in the selected folder');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get folder name from the first file's path
      const firstFile = files[0];
      const folderPath = firstFile.webkitRelativePath || firstFile.name;
      const folderName = folderPath.split('/')[0] || 'Uploaded Folder';

      // Use persistent project upload if project is selected
      if (localSelectedProjectId) {
        const formData = new FormData();
        
        validFiles.forEach(file => {
          formData.append('files', file);
        });
        formData.append('folderName', folderName);
        formData.append('uploadType', 'folder');

        const response = await axios.post(`http://localhost:3001/api/migration-projects/${localSelectedProjectId}/upload`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success) {
          console.log('✅ Folder uploaded and persisted to database!', response.data);
          // Still call the callback for backward compatibility
          if (response.data.processedFiles && response.data.processedFiles.length > 0) {
            // Create a mock folder workflow from the processed files
            const folderWorkflow = {
              folderName: folderName,
              files: response.data.processedFiles.map((file: any) => ({
                fileName: file.fileName,
                filePath: file.filePath,
                type: file.fileType,
                workflow: file.workflow || {},
                size: file.fileSize,
                lastModified: Date.now(),
                references: [],
                referencedBy: [],
                dependencies: []
              })),
              dependencies: [],
              metadata: {
                totalFiles: response.data.processedFiles.length,
                transformations: response.data.processedFiles.filter((f: any) => f.fileType === 'transformation').length,
                jobs: response.data.processedFiles.filter((f: any) => f.fileType === 'job').length,
                dependencies: 0,
                parsed: new Date().toISOString()
              }
            };
            onFolderParsed(folderWorkflow, folderName);
          }
        } else {
          setError(response.data.error || 'Failed to upload folder to project');
        }
      } else {
        // Fallback to old non-persistent endpoint (for backward compatibility)
        const formData = new FormData();
        
        validFiles.forEach(file => {
          formData.append('files', file);
        });
        formData.append('folderName', folderName);

        const response = await axios.post<FolderParseResult>('/api/upload-folder', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.data.success && response.data.folderWorkflow) {
          onFolderParsed(response.data.folderWorkflow, response.data.folderName);
        } else {
          setError(response.data.error || 'Failed to parse folder');
        }
      }
    } catch (err) {
      console.error('Folder upload error:', err);
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.error || err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsUploading(false);
    }
  }, [onFolderParsed, localSelectedProjectId]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files) {
      if (uploadMode === 'folder') {
        handleFolder(e.dataTransfer.files);
      } else if (e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    }
  }, [handleFile, handleFolder, uploadMode]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      if (uploadMode === 'folder') {
        handleFolder(e.target.files);
      } else if (e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    }
  }, [handleFile, handleFolder, uploadMode]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Project Selection */}
      {projects.length > 0 && (
        <div className="mb-6">
          <label htmlFor="project-select" className="block text-sm font-medium text-gray-700 mb-2">
            Link to Migration Project (Optional)
          </label>
          <div className="flex items-center space-x-2">
            <select
              id="project-select"
              value={localSelectedProjectId || ''}
              onChange={(e) => handleProjectChange(e.target.value || null)}
              className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              disabled={projectsLoading}
            >
              <option value="">Select a project (or upload without linking)</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.total_workflows} workflows)
                </option>
              ))}
            </select>
            {localSelectedProjectId && (
              <button
                onClick={() => handleProjectChange(null)}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                title="Clear selection"
              >
                Clear
              </button>
            )}
          </div>
          {localSelectedProjectId && (
            <p className="mt-1 text-sm text-green-600 flex items-center">
              <FolderOpen className="h-4 w-4 mr-1" />
              Files will be added to: {projects.find(p => p.id === localSelectedProjectId)?.name}
            </p>
          )}
        </div>
      )}

      {/* Mode Toggle */}
      <div className="mb-6 flex justify-center">
        <div className="bg-gray-100 rounded-lg p-1 flex">
          <button
            onClick={() => setUploadMode('file')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
              uploadMode === 'file' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <File className="h-4 w-4" />
            <span>Single File</span>
          </button>
          <button
            onClick={() => setUploadMode('folder')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
              uploadMode === 'folder' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Folder className="h-4 w-4" />
            <span>Folder</span>
          </button>
        </div>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg p-8 transition-colors ${
          dragActive
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".ktr,.ktj,.kjb"
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
          {...(uploadMode === 'folder' ? { webkitdirectory: '', directory: '', multiple: true } : {})}
        />
        
        <div className="text-center">
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-sm text-gray-600">
                {uploadMode === 'folder' ? 'Parsing folder...' : 'Parsing file...'}
              </p>
            </div>
          ) : (
            <>
              {uploadMode === 'folder' ? (
                <Folder className="mx-auto h-12 w-12 text-gray-400" />
              ) : (
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
              )}
              <p className="mt-2 text-lg font-medium text-gray-900">
                {uploadMode === 'folder' 
                  ? 'Drop your folder here' 
                  : 'Drop your file here'
                }
              </p>
              <p className="mt-1 text-sm text-gray-600">
                or click to browse
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {uploadMode === 'folder'
                  ? 'Supports folders containing KTR, KTJ, and KJB files'
                  : 'Supports KTR, KTJ, and KJB files'
                }
              </p>
              {uploadMode === 'folder' && (
                <p className="mt-1 text-xs text-blue-600 bg-blue-50 rounded px-2 py-1 inline-block">
                  📊 Folder mode creates dependency graphs between files
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Upload Error
              </h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            <span>KTR (XML)</span>
          </div>
          <div className="flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            <span>KTJ (JSON)</span>
          </div>
          <div className="flex items-center">
            <FileText className="h-4 w-4 mr-1" />
            <span>KJB (XML)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
