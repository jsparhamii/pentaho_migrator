// Fix Project Creation - Multiple Approaches
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
});

async function fixProjectCreation() {
  console.log('🔧 Attempting to fix project creation...\n');
  
  try {
    // Approach 1: Try minimal schema
    console.log('📋 Approach 1: Minimal Schema Creation');
    try {
      const minimalSchema = fs.readFileSync('create_minimal_schema.sql', 'utf-8');
      await pool.query(minimalSchema);
      console.log('✅ Minimal schema created successfully!');
      
      // Test project creation
      const testProject = await pool.query(`
        INSERT INTO migration_projects (name, description, created_by) 
        VALUES ($1, $2, $3) RETURNING id, name
      `, ['Test Project', 'Testing project creation', 'system']);
      
      console.log('✅ Test project created:', testProject.rows[0]);
      console.log('🎉 PROJECT CREATION IS NOW WORKING!\n');
      return true;
      
    } catch (error) {
      console.log('❌ Minimal schema failed:', error.message);
    }
    
    // Approach 2: Check permissions
    console.log('📋 Approach 2: Permission Check');
    try {
      const permCheck = await pool.query(`
        SELECT 
          has_schema_privilege(current_user, 'public', 'CREATE') as can_create_tables,
          has_schema_privilege(current_user, 'public', 'USAGE') as can_use_schema,
          current_user as user_name,
          session_user as session_user
      `);
      
      console.log('🔍 Current permissions:');
      console.log('   User:', permCheck.rows[0].user_name);
      console.log('   Can create tables:', permCheck.rows[0].can_create_tables);
      console.log('   Can use schema:', permCheck.rows[0].can_use_schema);
      
      if (!permCheck.rows[0].can_create_tables) {
        console.log('❌ No CREATE permission on public schema');
        console.log('💡 Need to request elevated permissions from Databricks admin');
      }
      
    } catch (error) {
      console.log('❌ Permission check failed:', error.message);
    }
    
    // Approach 3: Try creating in user schema
    console.log('\n📋 Approach 3: User Schema Creation');
    try {
      const userName = process.env.DB_USER.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      console.log('🔍 Trying user schema:', userName);
      
      // Try to create or use user schema
      await pool.query(\`CREATE SCHEMA IF NOT EXISTS "\${userName}"\`);
      await pool.query(\`SET search_path TO "\${userName}", public\`);
      
      // Try minimal schema in user schema
      const minimalSchema = fs.readFileSync('create_minimal_schema.sql', 'utf-8');
      await pool.query(minimalSchema);
      
      console.log('✅ Tables created in user schema!');
      console.log('⚠️ Note: You\\'ll need to update the app to use this schema');
      
    } catch (error) {
      console.log('❌ User schema approach failed:', error.message);
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Critical error:', error.message);
    return false;
  } finally {
    await pool.end();
  }
}

fixProjectCreation().then(success => {
  if (success) {
    console.log('\n🎊 SUCCESS: Project creation should now work!');
    console.log('🔄 Try creating a project in the UI now.');
  } else {
    console.log('\n❌ Unable to automatically fix the issue.');
    console.log('📞 Contact your Databricks admin to:');
    console.log('   1. Grant CREATE privileges on public schema');
    console.log('   2. Or pre-create the required tables');
    console.log('   3. Or provide a dedicated schema for the app');
  }
});
