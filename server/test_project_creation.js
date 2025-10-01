// Test if project creation is working after admin fixes the schema
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
});

async function testProjectCreation() {
  try {
    console.log('🧪 Testing project creation...');
    
    // Test project creation
    const testProject = await pool.query(`
      INSERT INTO migration_projects (name, description, created_by) 
      VALUES ($1, $2, $3) RETURNING id, name, created_at
    `, [`Test Project ${Date.now()}`, 'Testing project creation after schema setup', 'system']);
    
    console.log('✅ SUCCESS! Project created:', {
      id: testProject.rows[0].id,
      name: testProject.rows[0].name,
      created_at: testProject.rows[0].created_at
    });
    
    console.log('🎉 PROJECT CREATION IS NOW WORKING!');
    console.log('👉 You can now create projects in the UI');
    
    return true;
  } catch (error) {
    if (error.message.includes('does not exist')) {
      console.log('❌ Tables still don\'t exist');
      console.log('⏳ Waiting for admin to create the schema...');
    } else if (error.code === '42501') {
      console.log('❌ Still no permissions');
      console.log('⏳ Waiting for admin to grant privileges...');
    } else {
      console.error('❌ Unexpected error:', error.message);
    }
    return false;
  } finally {
    await pool.end();
  }
}

testProjectCreation();
