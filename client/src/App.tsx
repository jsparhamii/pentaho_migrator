import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import WorkflowVisualizer from './components/WorkflowVisualizer';
import FolderVisualizer from './components/FolderVisualizer';
import { PentahoWorkflow, FolderWorkflow, PentahoFile } from './types';
import { ArrowLeft, Folder, File } from 'lucide-react';

type ViewMode = 'upload' | 'single-file' | 'folder' | 'drill-down';

function App() {
  const [workflow, setWorkflow] = useState<PentahoWorkflow | null>(null);
  const [folderWorkflow, setFolderWorkflow] = useState<FolderWorkflow | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [folderName, setFolderName] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  const [selectedFile, setSelectedFile] = useState<PentahoFile | null>(null);

  const handleWorkflowParsed = (parsedWorkflow: PentahoWorkflow, name: string) => {
    setWorkflow(parsedWorkflow);
    setFileName(name);
    setViewMode('single-file');
  };

  const handleFolderParsed = (parsedFolderWorkflow: FolderWorkflow, name: string) => {
    setFolderWorkflow(parsedFolderWorkflow);
    setFolderName(name);
    setViewMode('folder');
  };

  const handleFileSelect = (file: PentahoFile) => {
    setSelectedFile(file);
    setWorkflow(file.workflow);
    setFileName(file.fileName);
    setViewMode('drill-down');
  };

  const handleBackToFolder = () => {
    setSelectedFile(null);
    setWorkflow(null);
    setFileName('');
    setViewMode('folder');
  };

  const handleReset = () => {
    setWorkflow(null);
    setFolderWorkflow(null);
    setSelectedFile(null);
    setFileName('');
    setFolderName('');
    setViewMode('upload');
  };

  const renderBreadcrumb = () => {
    if (viewMode === 'upload') return null;
    
    return (
      <div className="flex items-center space-x-2 text-sm text-gray-600 mb-4">
        <button onClick={handleReset} className="hover:text-gray-900">Home</button>
        {viewMode === 'folder' && (
          <>
            <span>→</span>
            <span className="flex items-center space-x-1">
              <Folder className="h-4 w-4" />
              <span>{folderName}</span>
            </span>
          </>
        )}
        {viewMode === 'single-file' && (
          <>
            <span>→</span>
            <span className="flex items-center space-x-1">
              <File className="h-4 w-4" />
              <span>{fileName}</span>
            </span>
          </>
        )}
        {viewMode === 'drill-down' && (
          <>
            <span>→</span>
            <button onClick={handleBackToFolder} className="hover:text-gray-900 flex items-center space-x-1">
              <Folder className="h-4 w-4" />
              <span>{folderName}</span>
            </button>
            <span>→</span>
            <span className="flex items-center space-x-1">
              <File className="h-4 w-4" />
              <span>{fileName}</span>
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">
                Pentaho Workflow Visualizer
              </h1>
              {viewMode === 'folder' && folderWorkflow && (
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium">{folderWorkflow.metadata.totalFiles} files</span> 
                  <span className="mx-2">•</span>
                  <span>{folderWorkflow.metadata.dependencies} dependencies</span>
                </p>
              )}
              {(viewMode === 'single-file' || viewMode === 'drill-down') && fileName && (
                <p className="mt-2 text-sm text-gray-600">
                  Current file: <span className="font-medium">{fileName}</span>
                </p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {viewMode === 'drill-down' && (
                <button
                  onClick={handleBackToFolder}
                  className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Folder
                </button>
              )}
              {(workflow || folderWorkflow) && (
                <button
                  onClick={handleReset}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  Upload New
                </button>
              )}
            </div>
          </div>
          {renderBreadcrumb()}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {viewMode === 'upload' && (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Upload Pentaho Files
            </h2>
            <p className="text-gray-600 mb-8">
              Upload a single KTR/KTJ/KJB file or an entire folder to visualize workflows and dependencies
            </p>
            <FileUpload 
              onWorkflowParsed={handleWorkflowParsed} 
              onFolderParsed={handleFolderParsed}
            />
          </div>
        )}

        {viewMode === 'folder' && folderWorkflow && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <Folder className="h-5 w-5 text-blue-600" />
                    <span>{folderWorkflow.folderName}</span>
                  </h2>
                  <div className="mt-2 flex space-x-4 text-sm text-gray-500">
                    <span>Files: {folderWorkflow.metadata.totalFiles}</span>
                    <span>Transformations: {folderWorkflow.metadata.transformations}</span>
                    <span>Jobs: {folderWorkflow.metadata.jobs}</span>
                    <span>Dependencies: {folderWorkflow.metadata.dependencies}</span>
                  </div>
                </div>
                <div className="hidden md:block bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">📊</div>
                    <span className="font-medium">Folder View:</span>
                  </div>
                  <p className="mt-1 text-xs">Click files for details • 👁 to view internal workflow</p>
                </div>
              </div>
            </div>
            <FolderVisualizer 
              folderWorkflow={folderWorkflow} 
              onFileSelect={handleFileSelect}
            />
          </div>
        )}

        {(viewMode === 'single-file' || viewMode === 'drill-down') && workflow && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center space-x-2">
                    <File className="h-5 w-5 text-purple-600" />
                    <span>{workflow.name}</span>
                    {viewMode === 'drill-down' && (
                      <span className="text-sm text-gray-500">({selectedFile?.type})</span>
                    )}
                  </h2>
                  {workflow.description && (
                    <p className="text-gray-600 mt-1">{workflow.description}</p>
                  )}
                  <div className="mt-2 flex space-x-4 text-sm text-gray-500">
                    <span>Type: {workflow.type}</span>
                    <span>Nodes: {workflow.nodes.length}</span>
                    <span>Connections: {workflow.connections.length}</span>
                  </div>
                </div>
                <div className="hidden md:block bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  <div className="flex items-center space-x-2">
                    <div className="bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">ℹ</div>
                    <span className="font-medium">Tip:</span>
                  </div>
                  <p className="mt-1 text-xs">Click on any node to view its detailed properties and configuration</p>
                </div>
              </div>
            </div>
            <WorkflowVisualizer workflow={workflow} />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
