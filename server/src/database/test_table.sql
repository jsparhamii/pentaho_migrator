-- Simple test to create one table at a time
SET search_path TO migration_app, public;

-- Test creating project_folders first (no dependencies)
CREATE TABLE IF NOT EXISTS project_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    parent_folder_id UUID,
    folder_name VARCHAR(500) NOT NULL,
    folder_path TEXT NOT NULL,
    total_files INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraints after table creation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_folders_project_id_fkey'
        AND table_name = 'project_folders'
        AND table_schema = 'migration_app'
    ) THEN
        ALTER TABLE project_folders 
        ADD CONSTRAINT project_folders_project_id_fkey 
        FOREIGN KEY (project_id) REFERENCES migration_projects(id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'project_folders_parent_folder_id_fkey'
        AND table_name = 'project_folders'
        AND table_schema = 'migration_app'
    ) THEN
        ALTER TABLE project_folders 
        ADD CONSTRAINT project_folders_parent_folder_id_fkey 
        FOREIGN KEY (parent_folder_id) REFERENCES project_folders(id) ON DELETE CASCADE;
    END IF;
END $$;

SELECT 'project_folders table created successfully!' as result;
