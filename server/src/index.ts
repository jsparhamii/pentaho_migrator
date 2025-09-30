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

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`🤖 AI summaries: ${aiSummaryService.isAvailable() ? 'Available' : 'Disabled (no API key)'}`);
  console.log(`🐍 PySpark conversion: ${pysparkConversionService.isAvailable() ? 'Available' : 'Disabled (no API key)'}`);
});