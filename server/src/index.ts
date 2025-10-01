import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { parseKettleFile, parseFolder } from './parsers';
import { aiSummaryService } from './aiSummaryService';
import { pysparkConversionService } from './pysparkConversionService';
import { dbService } from './database/connection';
import { MigrationProjectModel } from './models/migrationProject';
import { WorkflowConversionModel } from './models/workflowConversion';
import { ProjectFileModel } from './models/projectFile';
import { ProjectFolderModel } from './models/projectFolder';
import { ProjectUploadModel } from './models/projectUpload';
import { lakebaseService } from './services/lakebaseService';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    // Keep original filename with timestamp to avoid conflicts
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { 
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common Pentaho file types and archives
    const allowedExtensions = ['.ktr', '.kjb', '.xml', '.zip'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${fileExtension} not supported. Allowed types: ${allowedExtensions.join(', ')}`));
    }
  }
});

// Basic health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Debug endpoint to check database tables
app.get('/api/debug/tables', async (req, res) => {
  try {
    const result = await dbService.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'migration_app' 
      ORDER BY table_name
    `);
    
    res.json({
      success: true,
      tables: result.rows.map((row: any) => row.table_name),
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error checking tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check database tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to check column types
app.get('/api/debug/columns/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const result = await dbService.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_schema = 'migration_app' 
      AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);
    
    res.json({
      success: true,
      table: table,
      columns: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error checking columns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check table columns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to force schema initialization
app.post('/api/debug/force-schema', async (req, res) => {
  try {
    console.log('🔄 Force initializing database schema...');
    await dbService.initializeSchema();
    
    res.json({
      success: true,
      message: 'Schema initialization forced successfully'
    });
  } catch (error) {
    console.error('Error force initializing schema:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force schema initialization',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to manually apply new tables
app.post('/api/debug/create-new-tables', async (req, res) => {
  try {
    console.log('🔄 Manually creating new persistent file tables...');
    const fs = require('fs');
    const path = require('path');
    
    const newTablesPath = path.join(__dirname, 'database', 'new_tables.sql');
    const newTablesSql = fs.readFileSync(newTablesPath, 'utf-8');
    
    await dbService.query(newTablesSql);
    
    res.json({
      success: true,
      message: 'New persistent file tables created successfully'
    });
  } catch (error) {
    console.error('Error creating new tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create new tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to test simple table creation
app.post('/api/debug/test-table', async (req, res) => {
  try {
    console.log('🔄 Testing simple table creation...');
    const fs = require('fs');
    const path = require('path');
    
    const testTablePath = path.join(__dirname, 'database', 'test_table.sql');
    const testTableSql = fs.readFileSync(testTablePath, 'utf-8');
    
    const result = await dbService.query(testTableSql);
    
    res.json({
      success: true,
      message: 'Test table created successfully',
      result: result.rows
    });
  } catch (error) {
    console.error('Error creating test table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create test table',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to create all remaining tables
app.post('/api/debug/complete-tables', async (req, res) => {
  try {
    console.log('🔄 Creating all remaining persistent file tables...');
    const fs = require('fs');
    const path = require('path');
    
    const completeTablesPath = path.join(__dirname, 'database', 'complete_tables.sql');
    const completeTablesSql = fs.readFileSync(completeTablesPath, 'utf-8');
    
    const result = await dbService.query(completeTablesSql);
    
    res.json({
      success: true,
      message: 'All persistent file storage tables created successfully',
      result: result.rows
    });
  } catch (error) {
    console.error('Error creating complete tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create complete tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to create project_files table
app.post('/api/debug/project-files-table', async (req, res) => {
  try {
    console.log('🔄 Creating project_files table...');
    const fs = require('fs');
    const path = require('path');
    
    const projectFilesPath = path.join(__dirname, 'database', 'project_files_only.sql');
    const projectFilesSql = fs.readFileSync(projectFilesPath, 'utf-8');
    
    const result = await dbService.query(projectFilesSql);
    
    res.json({
      success: true,
      message: 'project_files table created successfully',
      result: result.rows
    });
  } catch (error) {
    console.error('Error creating project_files table:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create project_files table',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to create tables programmatically
app.post('/api/debug/create-tables-step-by-step', async (req, res) => {
  try {
    console.log('🔄 Creating tables step by step...');
    const results = [];
    
    // Step 1: Create the simplest possible project_files table first
    const createSimpleProjectFiles = `
      CREATE TABLE IF NOT EXISTS project_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        file_name VARCHAR(500) NOT NULL,
        file_type VARCHAR(50) NOT NULL,
        file_size BIGINT NOT NULL,
        workflow_data JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`;
    
    await dbService.query(createSimpleProjectFiles);
    results.push('Simple project_files table created');
    
    // Step 2: Create project_uploads table
    const createSimpleProjectUploads = `
      CREATE TABLE IF NOT EXISTS project_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id UUID NOT NULL,
        upload_type VARCHAR(50) NOT NULL,
        total_files INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`;
    
    await dbService.query(createSimpleProjectUploads);
    results.push('Simple project_uploads table created');
    
    res.json({
      success: true,
      message: 'Simple tables created successfully',
      results: results
    });
  } catch (error) {
    console.error('Error creating simple tables:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create simple tables',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug endpoint to add missing columns
app.post('/api/debug/add-missing-columns', async (req, res) => {
  try {
    console.log('🔄 Adding missing columns to tables...');
    const results = [];
    
    // Add missing columns to project_files
    const addColumnQueries = [
      'ALTER TABLE project_files ADD COLUMN IF NOT EXISTS folder_id UUID',
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_path TEXT DEFAULT 'unknown'",
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_extension VARCHAR(10) DEFAULT '.unknown'",
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS raw_content TEXT DEFAULT ''",
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS file_references JSONB DEFAULT '[]'",
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS referenced_by JSONB DEFAULT '[]'",
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS external_dependencies JSONB DEFAULT '[]'",
      "ALTER TABLE project_files ADD COLUMN IF NOT EXISTS parsing_status VARCHAR(50) DEFAULT 'completed'",
      'ALTER TABLE project_files ADD COLUMN IF NOT EXISTS parsing_error TEXT',
      'ALTER TABLE project_files ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE project_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE project_files ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP'
    ];
    
    for (const query of addColumnQueries) {
      try {
        await dbService.query(query);
        results.push(`Added column: ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[0] || 'unknown'}`);
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          results.push(`Column already exists: ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[0] || 'unknown'}`);
        } else {
          console.error('Column add error:', e.message);
        }
      }
    }
    
    // Add missing columns to project_uploads table
    const addUploadsColumnQueries = [
      "ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS original_name VARCHAR(500) DEFAULT 'unknown'",
      "ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS upload_source TEXT DEFAULT 'unknown'",
      'ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS processed_files INTEGER DEFAULT 0',
      'ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS failed_files INTEGER DEFAULT 0',
      'ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS total_size BIGINT DEFAULT 0',
      "ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS upload_status VARCHAR(50) DEFAULT 'completed'",
      "ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS processing_errors JSONB DEFAULT '[]'",
      "ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS session_metadata JSONB DEFAULT '{}'",
      'ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP',
      'ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE',
      'ALTER TABLE project_uploads ADD COLUMN IF NOT EXISTS uploaded_by VARCHAR(255)'
    ];
    
    for (const query of addUploadsColumnQueries) {
      try {
        await dbService.query(query);
        results.push(`Added uploads column: ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[0] || 'unknown'}`);
      } catch (e: any) {
        if (e.message.includes('already exists')) {
          results.push(`Uploads column already exists: ${query.split('ADD COLUMN IF NOT EXISTS')[1]?.split(' ')[0] || 'unknown'}`);
        } else {
          console.error('Uploads column add error:', e.message);
        }
      }
    }
    
    res.json({
      success: true,
      message: 'Missing columns added successfully',
      results: results
    });
  } catch (error) {
    console.error('Error adding missing columns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add missing columns',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// File upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const originalName = req.file.originalname;
    
    console.log(`📁 Processing uploaded file: ${originalName}`);

    // Parse the uploaded file
    const result = await parseKettleFile(filePath, originalName);
    
    // Clean up uploaded file after processing
    try {
      fs.unlinkSync(filePath);
      console.log(`🗑️ Cleaned up uploaded file: ${filePath}`);
    } catch (cleanupError) {
      console.warn(`⚠️ Could not clean up file ${filePath}:`, cleanupError);
    }

    if (result.success) {
      console.log(`✅ Successfully parsed: ${originalName}`);
      res.json(result);
    } else {
      console.error(`❌ Failed to parse: ${originalName} - ${result.error}`);
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).json({ 
      error: 'Failed to process upload', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Folder upload endpoint
app.post('/api/upload-folder', upload.array('files'), async (req, res) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const folderName = req.body.folderName || 'uploaded-folder';
    console.log(`📁 Processing folder upload: ${folderName} (${req.files.length} files)`);

    // Create temporary folder structure
    const tempFolderPath = path.join(__dirname, '../uploads', `folder-${Date.now()}`);
    fs.mkdirSync(tempFolderPath, { recursive: true });

    // Move uploaded files to temporary folder
    const filePaths: string[] = [];
    for (const file of req.files) {
      const newPath = path.join(tempFolderPath, file.originalname);
      fs.renameSync(file.path, newPath);
      filePaths.push(newPath);
    }

    // Parse the folder
    const result = await parseFolder(tempFolderPath, folderName);
    
    // Clean up temporary folder
    try {
      fs.rmSync(tempFolderPath, { recursive: true, force: true });
      console.log(`🗑️ Cleaned up temporary folder: ${tempFolderPath}`);
    } catch (cleanupError) {
      console.warn(`⚠️ Could not clean up folder ${tempFolderPath}:`, cleanupError);
    }

    if (result.success) {
      console.log(`✅ Successfully parsed folder: ${folderName}`);
    res.json(result);
    } else {
      console.error(`❌ Failed to parse folder: ${folderName} - ${result.error}`);
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('Error processing folder upload:', error);
    res.status(500).json({ 
      error: 'Failed to process folder upload', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI Summary endpoint for individual steps
app.post('/api/generate-summary', async (req, res) => {
  try {
    const { step } = req.body;
    
    if (!step) {
      return res.status(400).json({ error: 'Step data is required' });
    }

    console.log(`🤖 Generating AI summary for step: ${step.name}`);
    
    const summary = await aiSummaryService.generateStepSummary(step);
    
    if (!summary) {
      return res.status(500).json({ error: 'Failed to generate summary' });
    }

    res.json({
      success: true,
      summary,
      aiAvailable: aiSummaryService.isAvailable()
    });

  } catch (error) {
    console.error('Error generating AI summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate AI summary', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI Workflow Summary endpoint for entire workflows
app.post('/api/generate-workflow-summary', async (req, res) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      return res.status(400).json({ error: 'Workflow data is required' });
    }

    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      return res.status(400).json({ error: 'Workflow must contain a nodes array' });
    }

    console.log(`🔄 Generating workflow summary for: ${workflow.name} (${workflow.nodes.length} nodes)`);
    
    const summary = await aiSummaryService.generateWorkflowSummary(workflow);
    
    if (!summary) {
      return res.status(500).json({ error: 'Failed to generate workflow summary' });
    }

    res.json({
      success: true,
      workflowSummary: summary,
      aiAvailable: aiSummaryService.isAvailable(),
      chunked: summary.stepCount > 30 // Indicate if chunking was used
    });

  } catch (error) {
    console.error('Error generating workflow AI summary:', error);
    res.status(500).json({ 
      error: 'Failed to generate workflow AI summary', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI capability check endpoint
app.get('/api/ai-status', (req, res) => {
  res.json({
    available: aiSummaryService.isAvailable(),
    provider: 'databricks',
    model: 'databricks-claude-opus-4-1'
  });
});

// PySpark conversion endpoints
app.post('/api/convert-to-pyspark', async (req, res) => {
  try {
    const { workflow } = req.body;
    
    if (!workflow) {
      return res.status(400).json({ error: 'Workflow data required' });
    }

    console.log(`🔄 Converting workflow to PySpark: ${workflow.name}`);
    
    const conversion = await pysparkConversionService.convertToPySpark(workflow);
    
    console.log(`✅ PySpark conversion completed for: ${workflow.name}`);
    
    res.json(conversion);
  } catch (error) {
    console.error('Error in PySpark conversion:', error);
    res.status(500).json({ 
      error: 'Failed to convert to PySpark',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/conversion-status', (req, res) => {
  res.json({
    available: pysparkConversionService.isAvailable(),
    provider: 'databricks',
    model: 'databricks-claude-opus-4-1',
    features: ['pyspark-conversion', 'databricks-notebook-export']
  });
});

app.post('/api/download-databricks-notebook', async (req, res) => {
  try {
    const { conversion } = req.body;
    
    if (!conversion || !conversion.databricksNotebook) {
      return res.status(400).json({ error: 'Conversion data with databricks notebook required' });
    }

    const notebook = conversion.databricksNotebook;
    const filename = `${notebook.title || 'converted_workflow'}.dbc`;
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Send the notebook as JSON
    res.json(notebook);
  } catch (error) {
    console.error('Error generating Databricks notebook:', error);
    res.status(500).json({ 
      error: 'Failed to generate Databricks notebook',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Migration Project API endpoints

// Get all migration projects
app.get('/api/migration-projects', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await MigrationProjectModel.findAll(limit, offset);
    
    res.json({
      success: true,
      projects: result.projects,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching migration projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch migration projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get a specific migration project
app.get('/api/migration-projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await MigrationProjectModel.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Migration project not found'
      });
    }
    
    // Get project statistics
    const stats = await MigrationProjectModel.getProjectStats(id);
    
    // Get recent conversions
    const conversions = await WorkflowConversionModel.findByProjectId(id, 10, 0);
    
    res.json({
      success: true,
      project,
      stats,
      recentConversions: conversions.conversions
    });
  } catch (error) {
    console.error('Error fetching migration project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch migration project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create a new migration project
app.post('/api/migration-projects', async (req, res) => {
  try {
    const { name, description, databricks_workspace_url, databricks_catalog_name, databricks_schema_name, created_by, settings } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Project name is required'
      });
    }
    
    console.log(`🔄 Creating migration project: ${name}`);
    
    const project = await MigrationProjectModel.create({
      name,
      description,
      databricks_workspace_url,
      databricks_catalog_name,
      databricks_schema_name,
      created_by,
      settings
    });
    
    // Create Lakebase project if Databricks integration is available
    let lakebaseProject = null;
    if (lakebaseService.isAvailable() && databricks_workspace_url && databricks_catalog_name && databricks_schema_name) {
      try {
        lakebaseProject = await lakebaseService.createProject({
          name,
          description: description || '',
          workspace_url: databricks_workspace_url,
          catalog_name: databricks_catalog_name,
          schema_name: databricks_schema_name
        });
        
        // Update project with Lakebase ID
        await MigrationProjectModel.update(project.id, {
          lakebase_project_id: lakebaseProject.id
        });
      } catch (lakebaseError) {
        console.warn('⚠️ Failed to create Lakebase project, continuing without it:', lakebaseError);
      }
    }
    
    console.log(`✅ Migration project created: ${project.id}`);
    
    res.status(201).json({
      success: true,
      project,
      lakebaseProject
    });
  } catch (error) {
    console.error('Error creating migration project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create migration project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update a migration project
app.put('/api/migration-projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const project = await MigrationProjectModel.update(id, updateData);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Migration project not found'
      });
    }
    
    res.json({
      success: true,
      project
    });
  } catch (error) {
    console.error('Error updating migration project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update migration project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a migration project
app.delete('/api/migration-projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await MigrationProjectModel.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Migration project not found'
      });
    }
    
    // Delete Lakebase project if it exists
    if (project.lakebase_project_id && lakebaseService.isAvailable()) {
      try {
        await lakebaseService.deleteProject(project.lakebase_project_id);
      } catch (lakebaseError) {
        console.warn('⚠️ Failed to delete Lakebase project:', lakebaseError);
      }
    }
    
    const deleted = await MigrationProjectModel.delete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Migration project not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Migration project deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting migration project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete migration project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get workflow conversions for a project
app.get('/api/migration-projects/:id/conversions', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await WorkflowConversionModel.findByProjectId(id, limit, offset);
    const stats = await WorkflowConversionModel.getProjectConversionStats(id);
    
    res.json({
      success: true,
      conversions: result.conversions,
      total: result.total,
      stats,
      limit,
      offset
    });
  } catch (error) {
    console.error('Error fetching project conversions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project conversions',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get existing conversion for a specific workflow in a project
app.get('/api/migration-projects/:projectId/conversions/by-workflow/:workflowName', async (req, res) => {
  try {
    const { projectId, workflowName } = req.params;
    
    const conversion = await WorkflowConversionModel.findByWorkflowName(projectId, workflowName);
    
    if (!conversion) {
      return res.status(404).json({
        success: false,
        error: 'No conversion found for this workflow'
      });
    }
    
    res.json({
      success: true,
      conversion
    });
  } catch (error) {
    console.error('Error fetching workflow conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch workflow conversion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add workflow to project and convert to PySpark
app.post('/api/migration-projects/:id/convert-workflow', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { workflow, sourceFilePath, sourceFileSize, sourceLastModified } = req.body;
    
    if (!workflow) {
      return res.status(400).json({
        success: false,
        error: 'Workflow data is required'
      });
    }
    
    // Check if project exists
    const project = await MigrationProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Migration project not found'
      });
    }
    
    console.log(`🔄 Converting workflow for project ${projectId}: ${workflow.name}`);
    const startTime = Date.now();
    
    // Create workflow conversion record
    let conversion = await WorkflowConversionModel.create({
      project_id: projectId,
      source_workflow: workflow,
      source_file_path: sourceFilePath,
      source_file_size: sourceFileSize,
      source_last_modified: sourceLastModified ? new Date(sourceLastModified) : undefined
    });
    
    // Update conversion status to processing
    await WorkflowConversionModel.update(conversion.id, {
      conversion_status: 'processing'
    });
    
    try {
      // Perform PySpark conversion
      const pysparkConversion = await pysparkConversionService.convertToPySpark(workflow);
      const processingTime = Date.now() - startTime;
      
      if (pysparkConversion) {
        // Update conversion with results
        conversion = await WorkflowConversionModel.update(conversion.id, {
          conversion_status: pysparkConversion.success ? 'completed' : 'failed',
          generated_code: pysparkConversion.pysparkCode,
          generated_notebook: pysparkConversion.databricksNotebook,
          required_libraries: pysparkConversion.requiredLibraries,
          conversion_notes: pysparkConversion.conversionNotes,
          estimated_complexity: pysparkConversion.estimatedComplexity,
          ai_model_used: 'databricks-claude-opus-4-1',
          ai_processing_time_ms: processingTime,
          error_message: pysparkConversion.success ? undefined : 'Conversion completed but with issues'
        }) || conversion;
        
        // Create Lakebase artifact if available
        if (lakebaseService.isAvailable() && project.lakebase_project_id && pysparkConversion.success) {
          try {
            const artifact = await lakebaseService.createArtifact({
              project_id: project.lakebase_project_id,
              name: `${workflow.name}_converted`,
              type: 'notebook',
              content: JSON.stringify(pysparkConversion.databricksNotebook),
              metadata: {
                original_workflow: workflow.name,
                conversion_id: conversion.id,
                complexity: pysparkConversion.estimatedComplexity
              }
            });
            
            await WorkflowConversionModel.update(conversion.id, {
              lakebase_artifact_id: artifact.id,
              databricks_notebook_path: artifact.path
            });
          } catch (lakebaseError) {
            console.warn('⚠️ Failed to create Lakebase artifact:', lakebaseError);
          }
        }
        
        console.log(`✅ Workflow conversion completed for project ${projectId}: ${workflow.name}`);
      } else {
        // Conversion failed
        await WorkflowConversionModel.update(conversion.id, {
          conversion_status: 'failed',
          error_message: 'PySpark conversion returned null result',
          ai_processing_time_ms: processingTime
        });
      }
    } catch (conversionError) {
      console.error('❌ Error during PySpark conversion:', conversionError);
      
      await WorkflowConversionModel.update(conversion.id, {
        conversion_status: 'failed',
        error_message: conversionError instanceof Error ? conversionError.message : 'Unknown conversion error',
        error_details: { error: String(conversionError) },
        ai_processing_time_ms: Date.now() - startTime
      });
    }
    
    // Get updated conversion with all data
    const finalConversion = await WorkflowConversionModel.findById(conversion.id);
    
    res.json({
      success: true,
      conversion: finalConversion,
      project
    });
  } catch (error) {
    console.error('Error converting workflow for project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to convert workflow for project',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get project dashboard data
app.get('/api/migration-projects/:id/dashboard', async (req, res) => {
  try {
    const { id } = req.params;
    
    const project = await MigrationProjectModel.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Migration project not found'
      });
    }
    
    const stats = await MigrationProjectModel.getProjectStats(id);
    const conversionStats = await WorkflowConversionModel.getProjectConversionStats(id);
    const recentConversions = await WorkflowConversionModel.findByProjectId(id, 5, 0);
    
    res.json({
      success: true,
      project,
      stats,
      conversionStats,
      recentConversions: recentConversions.conversions
    });
  } catch (error) {
    console.error('Error fetching project dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project dashboard',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search migration projects
app.get('/api/migration-projects/search/:term', async (req, res) => {
  try {
    const { term } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const projects = await MigrationProjectModel.search(term, limit);
    
    res.json({
      success: true,
      projects,
      searchTerm: term
    });
  } catch (error) {
    console.error('Error searching migration projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search migration projects',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ===== PROJECT FILE MANAGEMENT ENDPOINTS =====

// Upload files to a specific project
app.post('/api/migration-projects/:id/upload', upload.array('files'), async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const files = req.files as Express.Multer.File[];
    const folderName = req.body.folderName;
    const uploadType = req.body.uploadType || (files.length === 1 ? 'single_file' : 'multiple_files');
    
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files provided'
      });
    }
    
    // Check if project exists
    const project = await MigrationProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    console.log(`🔄 Processing ${files.length} file(s) for project ${projectId}`);
    
    // Create upload session
    const uploadSession = await ProjectUploadModel.create({
      project_id: projectId,
      upload_type: uploadType,
      original_name: folderName || files[0].originalname,
      total_files: files.length,
      total_size: files.reduce((sum, file) => sum + file.size, 0),
      uploaded_by: req.body.uploadedBy || 'anonymous'
    });
    
    const processedFiles: any[] = [];
    const failedFiles: any[] = [];
    let folder: any = null;
    
    // Create folder if this is a folder upload
    if (folderName && uploadType === 'folder') {
      try {
        folder = await ProjectFolderModel.getOrCreateByPath(projectId, folderName);
      } catch (error) {
        console.error('Error creating folder:', error);
        // Continue without folder - files will be stored as standalone
      }
    }
    
    // Process each file
    for (const file of files) {
      try {
        const fileContent = fs.readFileSync(file.path, 'utf8');
        const parseResult = await parseKettleFile(file.path, file.originalname);
        
        if (parseResult.success && parseResult.workflow) {
          try {
            // Determine file path within project
            let filePath = file.originalname;
            if (file.originalname.includes('/')) {
              // Extract relative path from webkitRelativePath-like structure
              filePath = file.originalname;
            }
            
            // Ensure workflow type is valid
            let fileType: 'transformation' | 'job' = 'transformation';
            if (parseResult.workflow.type === 'job' || file.originalname.toLowerCase().endsWith('.kjb')) {
              fileType = 'job';
            }
            
            console.log(`🔄 Creating project file: ${file.originalname}, type: ${fileType}`);
            
            // Create project file record
            const projectFile = await ProjectFileModel.create({
              project_id: projectId,
              folder_id: folder?.id,
              file_name: path.basename(file.originalname),
              file_type: fileType,
              file_size: file.size,
              file_path: filePath,
              file_extension: path.extname(file.originalname),
              workflow_data: parseResult.workflow,
              raw_content: fileContent,
              references: parseResult.workflow.references || [],
              referenced_by: parseResult.workflow.referencedBy || [],
              external_dependencies: parseResult.workflow.dependencies || []
            });
            
            processedFiles.push({
              id: projectFile.id,
              fileName: projectFile.file_name,
              fileType: projectFile.file_type,
              fileSize: projectFile.file_size,
              filePath: projectFile.file_path,
              workflow: parseResult.workflow
            });
            
            console.log(`✅ Successfully saved to database: ${projectFile.file_name}`);
          } catch (dbError) {
            console.error(`❌ Database error for file ${file.originalname}:`, dbError);
            failedFiles.push({
              fileName: file.originalname,
              error: `Database error: ${dbError instanceof Error ? dbError.message : 'Unknown database error'}`
            });
          }
        } else {
          console.log(`❌ Parse failed for file ${file.originalname}: ${parseResult.error}`);
          failedFiles.push({
            fileName: file.originalname,
            error: parseResult.error || 'Failed to parse file'
          });
        }
        
        // Clean up uploaded file
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.warn(`⚠️ Could not clean up file ${file.path}:`, cleanupError);
        }
        
      } catch (error) {
        console.error(`Error processing file ${file.originalname}:`, error);
        failedFiles.push({
          fileName: file.originalname,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        
        // Clean up uploaded file
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
    }
    
    // Update upload session
    await ProjectUploadModel.markCompleted(uploadSession.id, processedFiles.length, failedFiles.length);
    
    console.log(`✅ Upload completed: ${processedFiles.length} successful, ${failedFiles.length} failed`);
    
    res.json({
      success: true,
      uploadSessionId: uploadSession.id,
      processedFiles,
      failedFiles,
      folder: folder,
      summary: {
        totalFiles: files.length,
        processedFiles: processedFiles.length,
        failedFiles: failedFiles.length
      }
    });
    
  } catch (error) {
    console.error('Error uploading files to project:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get all files for a project
app.get('/api/migration-projects/:id/files', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const folderId = req.query.folderId as string;
    const fileType = req.query.fileType as 'transformation' | 'job';
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Check if project exists
    const project = await MigrationProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    const result = await ProjectFileModel.findByProjectId(projectId, {
      folderId: folderId === 'null' ? undefined : folderId,
      fileType,
      limit,
      offset
    });
    
    res.json({
      success: true,
      ...result
    });
    
  } catch (error) {
    console.error('Error fetching project files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get specific file by ID
app.get('/api/migration-projects/:projectId/files/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    
    const projectFile = await ProjectFileModel.findById(fileId);
    
    if (!projectFile) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Verify file belongs to the project
    if (projectFile.project_id !== projectId) {
      return res.status(404).json({
        success: false,
        error: 'File not found in this project'
      });
    }
    
    res.json({
      success: true,
      file: projectFile
    });
    
  } catch (error) {
    console.error('Error fetching project file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Update workflow summary for a project file
app.patch('/api/migration-projects/:projectId/files/:fileId/summary', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    const { summary } = req.body;
    
    if (!summary) {
      return res.status(400).json({
        success: false,
        error: 'Summary is required'
      });
    }
    
    // Get the file to verify it exists and belongs to the project
    const existingFile = await ProjectFileModel.findById(fileId);
    if (!existingFile) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    if (existingFile.project_id !== projectId) {
      return res.status(404).json({
        success: false,
        error: 'File not found in this project'
      });
    }
    
    // Update the workflow summary
    const updatedFile = await ProjectFileModel.update(fileId, {
      workflow_summary: summary
    });
    
    if (!updatedFile) {
      return res.status(500).json({
        success: false,
        error: 'Failed to update workflow summary'
      });
    }
    
    res.json({
      success: true,
      file: updatedFile
    });
    
  } catch (error) {
    console.error('Error updating workflow summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update workflow summary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get folder structure for a project
app.get('/api/migration-projects/:id/folders', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const includeTree = req.query.tree === 'true';
    
    // Check if project exists
    const project = await MigrationProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    if (includeTree) {
      // Get hierarchical folder tree with file counts
      const folderTree = await ProjectFolderModel.getFolderTree(projectId);
      res.json({
        success: true,
        folderTree
      });
    } else {
      // Get flat list of folders
      const result = await ProjectFolderModel.findByProjectId(projectId);
      res.json({
        success: true,
        ...result
      });
    }
    
  } catch (error) {
    console.error('Error fetching project folders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project folders',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get project file and folder statistics
app.get('/api/migration-projects/:id/file-stats', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    
    // Check if project exists
    const project = await MigrationProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    const fileStats = await ProjectFileModel.getProjectFileStats(projectId);
    const uploadStats = await ProjectUploadModel.getProjectUploadStats(projectId);
    
    res.json({
      success: true,
      fileStats,
      uploadStats
    });
    
  } catch (error) {
    console.error('Error fetching project file stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project file statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Search files within a project
app.get('/api/migration-projects/:id/search', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const searchTerm = req.query.q as string;
    const fileType = req.query.fileType as 'transformation' | 'job';
    const folderId = req.query.folderId as string;
    
    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        error: 'Search term is required'
      });
    }
    
    // Check if project exists
    const project = await MigrationProjectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }
    
    const result = await ProjectFileModel.search(projectId, searchTerm, {
      fileType,
      folderId: folderId === 'null' ? undefined : folderId
    });
    
    res.json({
      success: true,
      searchTerm,
      ...result
    });
    
  } catch (error) {
    console.error('Error searching project files:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search project files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete a file from a project
app.delete('/api/migration-projects/:projectId/files/:fileId', async (req, res) => {
  try {
    const { projectId, fileId } = req.params;
    
    // Get file to verify it exists and belongs to project
    const projectFile = await ProjectFileModel.findById(fileId);
    
    if (!projectFile) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }
    
    // Verify file belongs to the project
    if (projectFile.project_id !== projectId) {
      return res.status(404).json({
        success: false,
        error: 'File not found in this project'
      });
    }
    
    const deleted = await ProjectFileModel.delete(fileId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'File not found or could not be deleted'
      });
    }
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting project file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete project file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await dbService.testConnection();
    if (dbConnected) {
      // Initialize database schema
      await dbService.initializeSchema();
    } else {
      console.warn('⚠️ Database connection failed. Migration projects will not be available.');
    }

    // Test Databricks/Lakebase connection
    const lakebaseConnected = await lakebaseService.testConnection();
    
    app.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🤖 AI summaries: ${aiSummaryService.isAvailable() ? 'Available' : 'Disabled (no API key)'}`);
      console.log(`🐍 PySpark conversion: ${pysparkConversionService.isAvailable() ? 'Available' : 'Disabled (no API key)'}`);
      console.log(`📊 Database: ${dbConnected ? 'Connected' : 'Disconnected'}`);
      console.log(`🏢 Lakebase integration: ${lakebaseConnected ? 'Available' : 'Disabled (no Databricks credentials)'}`);
});
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();