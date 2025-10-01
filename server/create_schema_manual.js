// Manual schema creation script for Databricks PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000
};

async function createSchema() {
  const pool = new Pool(config);
  
  try {
    console.log('🔄 Attempting manual schema creation...');
    
    // Read and execute schema
    const schemaPath = path.join(__dirname, 'src', 'database', 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    
    await pool.query(schemaSql);
    console.log('✅ Schema created successfully!');
    
  } catch (error) {
    console.error('❌ Schema creation failed:', error.message);
    console.log('📋 You may need to create the schema manually with proper permissions');
  } finally {
    await pool.end();
  }
}

createSchema();
