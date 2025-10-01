-- New tables for persistent file storage
-- Apply these manually to test table creation

SET search_path TO migration_app, public;

-- Project Folders table (for storing uploaded folder structures) - MUST BE FIRST
CREATE TABLE IF NOT EXISTS migration_app.project_folders (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES migration_app.migration_projects(id) ON DELETE CASCADE,
    parent_folder_id TEXT REFERENCES migration_app.project_folders(id) ON DELETE CASCADE, -- NULL for root folders
    
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
CREATE TABLE IF NOT EXISTS migration_app.project_files (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES migration_app.migration_projects(id) ON DELETE CASCADE,
    folder_id TEXT REFERENCES migration_app.project_folders(id) ON DELETE CASCADE, -- NULL for standalone files
    
    -- File metadata
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('transformation', 'job')), -- .ktr, .kjb
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL, -- Relative path from project root
    file_extension VARCHAR(10) NOT NULL,
    
    -- File content and analysis
    workflow_data JSONB NOT NULL, -- Complete parsed PentahoWorkflow
    raw_content TEXT NOT NULL, -- Original file content for re-processing
    
    -- File relationships
    references JSONB DEFAULT '[]', -- Files this file references
    referenced_by JSONB DEFAULT '[]', -- Files that reference this file
    external_dependencies JSONB DEFAULT '[]', -- External resources (DBs, CSVs, etc.)
    
    -- Processing status
    parsing_status VARCHAR(50) DEFAULT 'completed' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
    parsing_error TEXT, -- Error message if parsing failed
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, file_path) -- Prevent duplicate files in same project path
);

-- File Dependencies table (for tracking dependencies between project files)
CREATE TABLE IF NOT EXISTS migration_app.file_dependencies (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES migration_app.migration_projects(id) ON DELETE CASCADE,
    source_file_id TEXT NOT NULL REFERENCES migration_app.project_files(id) ON DELETE CASCADE,
    target_file_id TEXT REFERENCES migration_app.project_files(id) ON DELETE CASCADE, -- NULL for external dependencies
    
    -- Dependency details
    dependency_type VARCHAR(100) NOT NULL, -- 'calls', 'includes', 'executes', 'transformation_call', 'job_call', etc.
    dependency_path TEXT, -- Path to external file/resource if target_file_id is NULL
    dependency_details JSONB DEFAULT '{}', -- Additional metadata about the dependency
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, source_file_id, target_file_id, dependency_type) -- Prevent duplicate dependencies
);

-- Project Uploads table (for tracking upload sessions and batch operations)
CREATE TABLE IF NOT EXISTS migration_app.project_uploads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES migration_app.migration_projects(id) ON DELETE CASCADE,
    
    -- Upload metadata
    upload_type VARCHAR(50) NOT NULL CHECK (upload_type IN ('single_file', 'folder', 'multiple_files')),
    original_name VARCHAR(500) NOT NULL, -- Original file/folder name
    upload_source TEXT NOT NULL, -- Source path or identifier
    
    -- Upload statistics
    total_files INTEGER DEFAULT 0,
    processed_files INTEGER DEFAULT 0,
    failed_files INTEGER DEFAULT 0,
    total_size BIGINT DEFAULT 0, -- Total bytes uploaded
    
    -- Processing status
    upload_status VARCHAR(50) DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
    processing_errors JSONB DEFAULT '[]', -- Array of error messages
    session_metadata JSONB DEFAULT '{}', -- Additional session data
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE, -- When upload fully completed
    uploaded_by VARCHAR(255), -- User identifier if available
    
    -- Indexes for performance
    CONSTRAINT project_uploads_project_id_created_at_idx UNIQUE (project_id, created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON migration_app.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_folder_id ON migration_app.project_files(folder_id);
CREATE INDEX IF NOT EXISTS idx_project_files_file_type ON migration_app.project_files(file_type);
CREATE INDEX IF NOT EXISTS idx_project_folders_project_id ON migration_app.project_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_project_folders_parent_id ON migration_app.project_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_file_dependencies_source ON migration_app.file_dependencies(source_file_id);
CREATE INDEX IF NOT EXISTS idx_file_dependencies_target ON migration_app.file_dependencies(target_file_id);
CREATE INDEX IF NOT EXISTS idx_project_uploads_project_id ON migration_app.project_uploads(project_id);

-- Update triggers
CREATE OR REPLACE FUNCTION update_project_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_project_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_project_uploads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS update_project_files_updated_at ON migration_app.project_files;
CREATE TRIGGER update_project_files_updated_at
    BEFORE UPDATE ON migration_app.project_files
    FOR EACH ROW EXECUTE FUNCTION update_project_files_updated_at();

DROP TRIGGER IF EXISTS update_project_folders_updated_at ON migration_app.project_folders;
CREATE TRIGGER update_project_folders_updated_at
    BEFORE UPDATE ON migration_app.project_folders
    FOR EACH ROW EXECUTE FUNCTION update_project_folders_updated_at();

DROP TRIGGER IF EXISTS update_project_uploads_updated_at ON migration_app.project_uploads;
CREATE TRIGGER update_project_uploads_updated_at
    BEFORE UPDATE ON migration_app.project_uploads
    FOR EACH ROW EXECUTE FUNCTION update_project_uploads_updated_at();

-- Folder statistics update function
CREATE OR REPLACE FUNCTION update_folder_statistics()
RETURNS TRIGGER AS $$
DECLARE
    folder_record RECORD;
BEGIN
    -- Handle both INSERT and DELETE operations
    IF TG_OP = 'INSERT' THEN
        folder_record := NEW;
    ELSE
        folder_record := OLD;
    END IF;
    
    -- Update folder statistics if file belongs to a folder
    IF folder_record.folder_id IS NOT NULL THEN
        UPDATE migration_app.project_folders
        SET 
            total_files = (
                SELECT COUNT(*) 
                FROM migration_app.project_files 
                WHERE folder_id = folder_record.folder_id
            ),
            transformation_files = (
                SELECT COUNT(*) 
                FROM migration_app.project_files 
                WHERE folder_id = folder_record.folder_id 
                AND file_type = 'transformation'
            ),
            job_files = (
                SELECT COUNT(*) 
                FROM migration_app.project_files 
                WHERE folder_id = folder_record.folder_id 
                AND file_type = 'job'
            ),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = folder_record.folder_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update folder statistics when files are added/removed
DROP TRIGGER IF EXISTS update_folder_statistics_on_file_change ON migration_app.project_files;
CREATE TRIGGER update_folder_statistics_on_file_change
    AFTER INSERT OR DELETE ON migration_app.project_files
    FOR EACH ROW EXECUTE FUNCTION update_folder_statistics();

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA migration_app TO CURRENT_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA migration_app TO CURRENT_USER;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA migration_app TO CURRENT_USER;

SELECT 'New persistent file tables created successfully!' as result;
