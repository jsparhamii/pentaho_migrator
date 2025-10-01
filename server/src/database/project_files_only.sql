-- Create just the project_files table
SET search_path TO migration_app, public;

-- Project Files table (for storing complete uploaded files)
CREATE TABLE IF NOT EXISTS project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    folder_id UUID,
    
    -- File metadata
    file_name VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('transformation', 'job')),
    file_size BIGINT NOT NULL,
    file_path TEXT NOT NULL,
    file_extension VARCHAR(10) NOT NULL,
    
    -- File content and analysis
    workflow_data JSONB NOT NULL,
    raw_content TEXT NOT NULL,
    
    -- File relationships
    references JSONB DEFAULT '[]',
    referenced_by JSONB DEFAULT '[]',
    external_dependencies JSONB DEFAULT '[]',
    
    -- Processing status
    parsing_status VARCHAR(50) DEFAULT 'completed' CHECK (parsing_status IN ('pending', 'processing', 'completed', 'failed')),
    parsing_error TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    UNIQUE(project_id, file_path)
);

-- Add foreign key constraints after table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_files_project_id_fkey'
        AND table_name = 'project_files'
        AND table_schema = 'migration_app'
    ) THEN
        ALTER TABLE project_files 
        ADD CONSTRAINT project_files_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES migration_projects(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_files_folder_id_fkey'
        AND table_name = 'project_files'
        AND table_schema = 'migration_app'
    ) THEN
        ALTER TABLE project_files 
        ADD CONSTRAINT project_files_folder_id_fkey 
        FOREIGN KEY (folder_id) REFERENCES project_folders(id) ON DELETE CASCADE;
    END IF;
END $$;

SELECT 'project_files table created successfully!' as result;

