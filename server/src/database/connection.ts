import { Pool, Client, PoolConfig } from 'pg';
import fs from 'fs';
import path from 'path';

/**
 * PostgreSQL Database Connection Service
 * Handles database connections, initialization, and query execution
 */
export class DatabaseService {
  private pool: Pool;
  private static instance: DatabaseService;

  constructor() {
    const config: PoolConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'pentaho_migration',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'password',
      max: parseInt(process.env.DB_POOL_MAX || '10'),
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000'),
      // SSL configuration for Databricks PostgreSQL
      ssl: process.env.DB_SSL_MODE === 'require' ? { rejectUnauthorized: false } : false,
      // Set default schema to migration_app
      options: '-c search_path=migration_app,public',
    };

    this.pool = new Pool(config);

    // Handle pool errors
    this.pool.on('error', (err: Error) => {
      console.error('Unexpected error on idle client', err);
    });

    console.log(`📊 Database connection initialized: ${config.host}:${config.port}/${config.database}`);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Initialize database schema
   */
  public async initializeSchema(): Promise<void> {
    try {
      console.log('🔄 Checking migration_app schema...');
      
      // First ensure the migration_app schema exists
      try {
        await this.pool.query('CREATE SCHEMA IF NOT EXISTS migration_app');
        console.log('✅ migration_app schema ensured');
      } catch (schemaError) {
        console.warn('⚠️ Could not create migration_app schema, it may already exist');
      }
      
      // Set search path for this session
      await this.pool.query('SET search_path TO migration_app, public');
      
      // Check if tables already exist in migration_app schema
      const checkTablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'migration_app' 
        AND table_name IN ('migration_projects', 'workflow_conversions', 'project_files', 'project_folders', 'project_uploads', 'file_dependencies')
      `;
      
      const existingTables = await this.pool.query(checkTablesQuery);
      
      // Only skip if ALL required tables exist (including new ones)
      if (existingTables.rows.length >= 6) {
        console.log('✅ Database tables already exist in migration_app schema, skipping initialization');
        return;
      } else if (existingTables.rows.length > 0) {
        console.log(`🔄 Found ${existingTables.rows.length}/6 tables, updating schema...`);
      }
      
      console.log('🔄 Creating database schema in migration_app...');
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      
      await this.pool.query(schemaSql);
      console.log('✅ Database schema initialized successfully in migration_app schema');
    } catch (error) {
      console.error('❌ Error initializing database schema:', error);
      console.warn('⚠️ Continuing without schema initialization - database features may be limited');
      // Don't throw error - allow server to start without database schema
      // throw error;
    }
  }

  /**
   * Test database connection
   */
  public async testConnection(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      console.log('✅ Database connection test successful');
      return true;
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Execute a query
   */
  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    const client = await this.pool.connect();
    
    try {
      // Ensure we're using the migration_app schema for this query
      await client.query('SET search_path TO migration_app, public');
      
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 Database query executed', {
          duration: `${duration}ms`,
          rows: result.rowCount,
          query: text.substring(0, 100) + (text.length > 100 ? '...' : '')
        });
      }
      
      return result;
    } catch (error) {
      console.error('❌ Database query error:', error);
      console.error('Query:', text);
      console.error('Params:', params);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('SET search_path TO migration_app, public');
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a client from the pool
   */
  public async getClient() {
    const client = await this.pool.connect();
    await client.query('SET search_path TO migration_app, public');
    return client;
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    await this.pool.end();
    console.log('🔒 Database connections closed');
  }

  /**
   * Get connection pool status
   */
  public getPoolStatus() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }
}

// Export singleton instance
export const dbService = DatabaseService.getInstance();
