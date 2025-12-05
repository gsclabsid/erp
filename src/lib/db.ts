import pg from 'pg';
const { Pool } = pg;

// Database connection pool
let pool: pg.Pool | null = null;

// Get database connection string from environment
const getDatabaseUrl = (): string | null => {
  // Check for DATABASE_URL (for server-side)
  if (typeof process !== 'undefined' && process.env?.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  // Check for VITE_DATABASE_URL (for client-side, though we'll use API)
  if (typeof window !== 'undefined' && import.meta.env?.VITE_DATABASE_URL) {
    return import.meta.env.VITE_DATABASE_URL as string;
  }
  return null;
};

// Initialize database connection pool
export function getDbPool(): pg.Pool {
  if (pool) {
    return pool;
  }

  const databaseUrl = getDatabaseUrl();
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
}

// Execute a query
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<pg.QueryResult<T>> {
  const dbPool = getDbPool();
  const start = Date.now();
  try {
    const res = await dbPool.query<T>(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn('Slow query', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
}

// Close database connection
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Check if database is available
export async function checkDbConnection(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// Helper to convert snake_case to camelCase
export function toCamelCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (typeof obj !== 'object') return obj;
  
  const camelObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      camelObj[camelKey] = toCamelCase(obj[key]);
    }
  }
  return camelObj;
}

// Helper to convert camelCase to snake_case
export function toSnakeCase(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (typeof obj !== 'object') return obj;
  
  const snakeObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      snakeObj[snakeKey] = toSnakeCase(obj[key]);
    }
  }
  return snakeObj;
}

