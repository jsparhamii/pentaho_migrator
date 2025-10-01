-- Minimal Migration Projects Schema
-- Only the essential tables needed for basic project functionality

-- Migration Projects table (core functionality)
CREATE TABLE IF NOT EXISTS migration_projects (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived', 'failed')),
    source_system VARCHAR(100) DEFAULT 'pentaho',
    target_system VARCHAR(100) DEFAULT 'pyspark',
    
    -- Project metadata
    total_workflows INTEGER DEFAULT 0,
    converted_workflows INTEGER DEFAULT 0,
    failed_conversions INTEGER DEFAULT 0,
    conversion_progress DECIMAL(5,2) DEFAULT 0.00,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- User tracking
    created_by VARCHAR(255),
    
    -- Project settings
    settings JSONB DEFAULT '{}'
);

-- Workflow Conversions table (essential for tracking conversions)
CREATE TABLE IF NOT EXISTS workflow_conversions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT NOT NULL REFERENCES migration_projects(id) ON DELETE CASCADE,
    
    -- Source workflow info
    source_workflow_name VARCHAR(500) NOT NULL,
    source_workflow_type VARCHAR(50) NOT NULL CHECK (source_workflow_type IN ('transformation', 'job')),
    
    -- Conversion details
    conversion_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (conversion_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    conversion_type VARCHAR(50) DEFAULT 'pyspark',
    
    -- Generated code
    generated_code TEXT,
    required_libraries JSONB DEFAULT '[]',
    conversion_notes JSONB DEFAULT '[]',
    estimated_complexity VARCHAR(20) CHECK (estimated_complexity IN ('Low', 'Medium', 'High')),
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    conversion_completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Performance metrics
    source_node_count INTEGER DEFAULT 0,
    source_connection_count INTEGER DEFAULT 0,
    ai_processing_time_ms INTEGER
);

-- Basic indexes for performance
CREATE INDEX IF NOT EXISTS idx_migration_projects_status ON migration_projects(status);
CREATE INDEX IF NOT EXISTS idx_workflow_conversions_project_id ON workflow_conversions(project_id);
CREATE INDEX IF NOT EXISTS idx_workflow_conversions_status ON workflow_conversions(conversion_status);

-- Simple trigger to update project progress
CREATE OR REPLACE FUNCTION update_project_progress_simple()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE migration_projects
    SET 
        total_workflows = (SELECT COUNT(*) FROM workflow_conversions WHERE project_id = NEW.project_id),
        converted_workflows = (SELECT COUNT(*) FROM workflow_conversions WHERE project_id = NEW.project_id AND conversion_status = 'completed'),
        failed_conversions = (SELECT COUNT(*) FROM workflow_conversions WHERE project_id = NEW.project_id AND conversion_status = 'failed'),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.project_id;
    
    -- Update progress percentage
    UPDATE migration_projects
    SET conversion_progress = CASE 
        WHEN total_workflows > 0 THEN ROUND((converted_workflows::DECIMAL / total_workflows::DECIMAL) * 100, 2)
        ELSE 0.00
    END
    WHERE id = NEW.project_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER IF NOT EXISTS update_project_progress_on_conversion_change
    AFTER INSERT OR UPDATE OR DELETE ON workflow_conversions
    FOR EACH ROW EXECUTE FUNCTION update_project_progress_simple();

GRANT SELECT, INSERT, UPDATE, DELETE ON migration_projects TO CURRENT_USER;
GRANT SELECT, INSERT, UPDATE, DELETE ON workflow_conversions TO CURRENT_USER;
