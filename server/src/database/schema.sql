-- Migration Projects Database Schema  
-- PostgreSQL schema for Pentaho to PySpark migration tracking

-- Note: Using gen_random_uuid() instead of uuid-ossp extension
-- gen_random_uuid() is available in PostgreSQL 13+ without extensions

-- Migration Projects table
CREATE TABLE IF NOT EXISTS migration_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'failed')),
    source_system VARCHAR(100) DEFAULT 'pentaho',
    target_system VARCHAR(100) DEFAULT 'pyspark',
    
    -- Databricks integration
    databricks_workspace_url VARCHAR(500),
    databricks_catalog_name VARCHAR(255),
    databricks_schema_name VARCHAR(255),
    lakebase_project_id VARCHAR(255),
    
    -- Project metadata
    total_workflows INTEGER DEFAULT 0,
    converted_workflows INTEGER DEFAULT 0,
    failed_conversions INTEGER DEFAULT 0,
    conversion_progress DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    
    -- User tracking (optional)
    created_by VARCHAR(255),
    
    -- Project settings
    settings JSONB DEFAULT '{}',
    
    CONSTRAINT valid_progress CHECK (conversion_progress >= 0 AND conversion_progress <= 100)
);

-- Workflow Conversions table
CREATE TABLE IF NOT EXISTS workflow_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    
    -- Source workflow info
    source_workflow_name VARCHAR(500) NOT NULL,
    source_workflow_type VARCHAR(50) NOT NULL CHECK (source_workflow_type IN ('transformation', 'job')),
    source_file_path TEXT,
    source_file_size BIGINT,
    source_last_modified TIMESTAMP WITH TIME ZONE,
    
    -- Conversion details
    conversion_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (conversion_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    conversion_type VARCHAR(50) DEFAULT 'pyspark' CHECK (conversion_type IN ('pyspark', 'sql', 'scala')),
    
    -- Generated code
    generated_code TEXT,
    generated_notebook JSONB,
    required_libraries JSONB DEFAULT '[]',
    conversion_notes JSONB DEFAULT '[]',
    estimated_complexity VARCHAR(20) CHECK (estimated_complexity IN ('Low', 'Medium', 'High')),
    
    -- AI/LLM details
    ai_model_used VARCHAR(100),
    ai_tokens_used INTEGER,
    ai_processing_time_ms INTEGER,
    
    -- Databricks integration
    databricks_notebook_path VARCHAR(1000),
    databricks_notebook_id VARCHAR(255),
    lakebase_artifact_id VARCHAR(255),
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    conversion_started_at TIMESTAMP WITH TIME ZONE,
    conversion_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance metrics
    source_node_count INTEGER DEFAULT 0,
    source_connection_count INTEGER DEFAULT 0,
    generated_code_size INTEGER DEFAULT 0
);

-- Project Dependencies table (for tracking file dependencies within projects)
CREATE TABLE IF NOT EXISTS project_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    source_conversion_id UUID NOT NULL REFERENCES workflow_conversions(id) ON DELETE CASCADE,
    target_conversion_id UUID NOT NULL REFERENCES workflow_conversions(id) ON DELETE CASCADE,
    dependency_type VARCHAR(50) NOT NULL CHECK (dependency_type IN ('file', 'database', 'variable', 'sub_transformation', 'job_call')),
    dependency_details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(source_conversion_id, target_conversion_id, dependency_type)
);

-- Project Sessions table (for tracking user sessions and progress)
CREATE TABLE IF NOT EXISTS project_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    session_data JSONB DEFAULT '{}',
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days')
);

-- Conversion History table (for audit trail)
CREATE TABLE IF NOT EXISTS conversion_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversion_id UUID NOT NULL REFERENCES workflow_conversions(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_migration_projects_status ON migration_projects(status);
CREATE INDEX IF NOT EXISTS idx_migration_projects_created_at ON migration_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_migration_projects_lakebase ON migration_projects(lakebase_project_id);

CREATE INDEX IF NOT EXISTS idx_workflow_conversions_project_id ON workflow_conversions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_conversions_status ON workflow_conversions(conversion_status);
CREATE INDEX IF NOT EXISTS idx_workflow_conversions_type ON workflow_conversions(source_workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_conversions_created_at ON workflow_conversions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_conversions_lakebase ON workflow_conversions(lakebase_artifact_id);

CREATE INDEX IF NOT EXISTS idx_project_dependencies_project_id ON project_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_source ON project_dependencies(source_conversion_id);
CREATE INDEX IF NOT EXISTS idx_project_dependencies_target ON project_dependencies(target_conversion_id);

CREATE INDEX IF NOT EXISTS idx_project_sessions_project_id ON project_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_sessions_expires ON project_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_conversion_history_conversion_id ON conversion_history(conversion_id);
CREATE INDEX IF NOT EXISTS idx_conversion_history_created_at ON conversion_history(created_at DESC);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic updated_at updates
CREATE TRIGGER update_migration_projects_updated_at 
    BEFORE UPDATE ON migration_projects 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflow_conversions_updated_at 
    BEFORE UPDATE ON workflow_conversions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update project progress
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
DECLARE
    project_uuid UUID;
    total_count INTEGER;
    completed_count INTEGER;
    failed_count INTEGER;
    progress_percentage DECIMAL(5,2);
BEGIN
    -- Get the project_id from either NEW or OLD record
    project_uuid := COALESCE(NEW.project_id, OLD.project_id);
    
    -- Count total workflows
    SELECT COUNT(*) INTO total_count
    FROM workflow_conversions
    WHERE project_id = project_uuid;
    
    -- Count completed workflows
    SELECT COUNT(*) INTO completed_count
    FROM workflow_conversions
    WHERE project_id = project_uuid AND conversion_status = 'completed';
    
    -- Count failed workflows
    SELECT COUNT(*) INTO failed_count
    FROM workflow_conversions
    WHERE project_id = project_uuid AND conversion_status = 'failed';
    
    -- Calculate progress percentage
    IF total_count > 0 THEN
        progress_percentage := ROUND((completed_count::DECIMAL / total_count::DECIMAL) * 100, 2);
    ELSE
        progress_percentage := 0.00;
    END IF;
    
    -- Update the project
    UPDATE migration_projects
    SET 
        total_workflows = total_count,
        converted_workflows = completed_count,
        failed_conversions = failed_count,
        conversion_progress = progress_percentage,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = project_uuid;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Triggers to automatically update project progress
CREATE TRIGGER update_project_progress_on_conversion_change
    AFTER INSERT OR UPDATE OR DELETE ON workflow_conversions
    FOR EACH ROW EXECUTE FUNCTION update_project_progress();

-- Project Folders table (for storing uploaded folder structures) - MUST BE FIRST
CREATE TABLE IF NOT EXISTS project_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    parent_folder_id UUID REFERENCES project_folders(id) ON DELETE CASCADE, -- NULL for root folders
    
    -- Folder metadata
    folder_name VARCHAR(500) NOT NULL,
    folder_path TEXT NOT NULL, -- Full path from project root
    
    -- Folder statistics (calculated from contained files)
    total_files INTEGER DEFAULT 0,
    transformation_files INTEGER DEFAULT 0,
    job_files INTEGER DEFAULT 0,
    total_dependencies INTEGER DEFAULT 0,
    
    -- Folder analysis data
    folder_metadata JSONB DEFAULT '{}', -- Contains analysis results
    dependency_graph JSONB DEFAULT '{}', -- Inter-file dependencies within folder
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, folder_path) -- Prevent duplicate folder paths in same project
);

-- Project Files table (for storing complete uploaded files)
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES project_folders(id) ON DELETE CASCADE, -- NULL for standalone files
    
    -- File metadata
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('transformation', 'job')), -- .ktr, .kjb
    file_size BIGINT NOT NULL,
    file_path TEXT, -- Original path within uploaded folder
    file_extension VARCHAR(10) NOT NULL, -- .ktr, .kjb, .ktj
    
    -- Complete workflow data (parsed from file)
    workflow_data JSONB NOT NULL, -- Complete PentahoWorkflow object
    workflow_summary JSONB, -- AI-generated workflow summary
    raw_content TEXT, -- Original file content (XML/JSON)
    
    -- File references and dependencies
    file_references JSONB DEFAULT '[]', -- Files this file references
    referenced_by JSONB DEFAULT '[]', -- Files that reference this file
    external_dependencies JSONB DEFAULT '[]', -- External files, databases, etc.
    
    -- Processing status
    parsing_status VARCHAR(50) DEFAULT 'completed' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
    parsing_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, file_path) -- Prevent duplicate files in same project path
);

-- File Dependencies table (for tracking dependencies between project files)
CREATE TABLE IF NOT EXISTS file_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    source_file_id UUID NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    target_file_id UUID REFERENCES project_files(id) ON DELETE CASCADE, -- NULL for external dependencies
    
    -- Dependency details
    dependency_type VARCHAR(100) NOT NULL, -- 'calls', 'includes', 'executes', 'transformation_call', 'job_call', etc.
    dependency_path TEXT, -- Path to external file/resource if target_file_id is NULL
    dependency_details JSONB DEFAULT '{}', -- Additional metadata about the dependency
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(source_file_id, target_file_id, dependency_type), -- Prevent duplicate dependencies
    CHECK (target_file_id IS NOT NULL OR dependency_path IS NOT NULL) -- Must have either internal or external target
);

-- Project Uploads table (for tracking upload sessions and batches)
CREATE TABLE IF NOT EXISTS project_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    
    -- Upload metadata
    upload_type VARCHAR(50) NOT NULL CHECK (upload_type IN ('single_file', 'folder', 'multiple_files')),
    original_name VARCHAR(500) NOT NULL, -- Original file/folder name
    upload_source VARCHAR(100) DEFAULT 'web_interface', -- 'web_interface', 'api', 'bulk_import'
    
    -- Upload statistics
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0,
    
    -- Upload status
    upload_status VARCHAR(50) DEFAULT 'completed' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    processing_errors JSONB DEFAULT '[]',
    
    -- Upload session data
    session_metadata JSONB DEFAULT '{}', -- Browser info, user details, etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- User tracking
    uploaded_by VARCHAR(255)
);

-- Additional indexes for the new tables
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_folder_id ON project_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_project_files_type ON project_files(file_type);
CREATE INDEX IF NOT EXISTS idx_project_files_created_at ON project_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_files_last_accessed ON project_files(last_accessed DESC);

CREATE INDEX IF NOT EXISTS idx_project_folders_project_id ON project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent ON project_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_path ON project_folders(folder_path);

CREATE INDEX IF NOT EXISTS idx_file_dependencies_project_id ON file_dependencies(project_id);
CREATE INDEX IF NOT EXISTS idx_file_dependencies_source ON file_dependencies(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_dependencies_target ON file_dependencies(target_file_id);
CREATE INDEX IF NOT EXISTS idx_file_dependencies_type ON file_dependencies(dependency_type);

CREATE INDEX IF NOT EXISTS idx_project_uploads_project_id ON project_uploads(project_id);
CREATE INDEX IF NOT EXISTS idx_project_uploads_status ON project_uploads(upload_status);
CREATE INDEX IF NOT EXISTS idx_project_uploads_created_at ON project_uploads(created_at DESC);

-- Triggers for automatic updated_at updates on new tables
CREATE TRIGGER update_project_files_updated_at 
    BEFORE UPDATE ON project_files 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_folders_updated_at 
    BEFORE UPDATE ON project_folders 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_uploads_updated_at 
    BEFORE UPDATE ON project_uploads 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update folder statistics when files are added/removed
CREATE OR REPLACE FUNCTION update_folder_statistics()
RETURNS TRIGGER AS $$
DECLARE
    folder_uuid UUID;
    total_count INTEGER;
    transformation_count INTEGER;
    job_count INTEGER;
    dep_count INTEGER;
BEGIN
    -- Get the folder_id from either NEW or OLD record
    folder_uuid := COALESCE(NEW.folder_id, OLD.folder_id);
    
    -- Only update if there's a folder
    IF folder_uuid IS NOT NULL THEN
        -- Count files in folder
        SELECT COUNT(*) INTO total_count
        FROM project_files
        WHERE folder_id = folder_uuid;
        
        -- Count transformations
        SELECT COUNT(*) INTO transformation_count
        FROM project_files
        WHERE folder_id = folder_uuid AND file_type = 'transformation';
        
        -- Count jobs
        SELECT COUNT(*) INTO job_count
        FROM project_files
        WHERE folder_id = folder_uuid AND file_type = 'job';
        
        -- Count dependencies involving files in this folder
        SELECT COUNT(*) INTO dep_count
        FROM file_dependencies fd
        JOIN project_files pf ON fd.source_file_id = pf.id
        WHERE pf.folder_id = folder_uuid;
        
        -- Update the folder
        UPDATE project_folders
        SET 
            total_files = total_count,
            transformation_files = transformation_count,
            job_files = job_count,
            total_dependencies = dep_count,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = folder_uuid;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger to automatically update folder statistics
CREATE TRIGGER update_folder_statistics_on_file_change
    AFTER INSERT OR UPDATE OR DELETE ON project_files
    FOR EACH ROW EXECUTE FUNCTION update_folder_statistics();

-- Initial data or example projects (optional)
-- INSERT INTO migration_projects (name, description, created_by) 
-- VALUES ('Sample Migration Project', 'Example project for Pentaho to PySpark migration', 'system');
