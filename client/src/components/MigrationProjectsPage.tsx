import React, { useState } from 'react';
import { MigrationProjectsList } from './MigrationProjectsList';
import { MigrationProjectDashboard } from './MigrationProjectDashboard';
import { WorkflowTabsPanel } from './WorkflowTabsPanel';
import { MigrationProject } from '../services/migrationProjectService';
import { PentahoWorkflow } from '../types';

interface MigrationProjectsPageProps {}

type ViewMode = 'list' | 'dashboard' | 'convert';

export const MigrationProjectsPage: React.FC<MigrationProjectsPageProps> = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedProject, setSelectedProject] = useState<MigrationProject | null>(null);
  const [workflowToConvert, setWorkflowToConvert] = useState<PentahoWorkflow | null>(null);

  const handleProjectSelect = (project: MigrationProject) => {
    setSelectedProject(project);
    setViewMode('dashboard');
  };

  const handleBackToList = () => {
    setSelectedProject(null);
    setWorkflowToConvert(null);
    setViewMode('list');
  };

  const handleConvertWorkflow = (projectId: string) => {
    // This will be handled by the project dashboard's file browser
    // The workflow conversion will happen directly from the file list
    console.log(`Convert workflow requested for project: ${projectId}`);
  };

  const handleCreateProject = () => {
    // Refresh the list view after creating a project
    // The MigrationProjectsList component handles this internally
  };

  switch (viewMode) {
    case 'dashboard':
      return selectedProject ? (
        <MigrationProjectDashboard
          projectId={selectedProject.id}
          onBack={handleBackToList}
          onConvertWorkflow={handleConvertWorkflow}
        />
      ) : (
        <div>Error: No project selected</div>
      );

    case 'convert':
      return workflowToConvert && selectedProject ? (
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setViewMode('dashboard')}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              ← Back to Dashboard
            </button>
            <h2 className="text-xl font-semibold">Convert Workflow: {workflowToConvert.name}</h2>
          </div>
          
          <WorkflowTabsPanel
            workflow={workflowToConvert}
            projectId={selectedProject?.id}
            onClose={() => setViewMode('dashboard')}
          />
        </div>
      ) : (
        <div>Error: No workflow selected for conversion</div>
      );

    default:
      return (
        <MigrationProjectsList
          onProjectSelect={handleProjectSelect}
          onCreateProject={handleCreateProject}
        />
      );
  }
};
