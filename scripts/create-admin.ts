// Script to create admin user with password
// Run with: npx tsx scripts/create-admin.ts

import { getDbPool, query } from '../src/lib/db';
import { createPasswordHash } from '../src/services/auth';

async function createAdmin() {
  const email = 'admin@sams.local';
  const password = 'admin123';
  const name = 'Admin User';

  try {
    // Check if admin exists
    const checkResult = await query('SELECT id FROM app_users WHERE email = $1', [email]);
    
    if (checkResult.rows.length > 0) {
      // Update existing admin
      const hash = await createPasswordHash(password);
      if (!hash) {
        throw new Error('Failed to create password hash');
      }
      
      await query(
        `UPDATE app_users 
         SET password_hash = $1, 
             password_changed_at = CURRENT_TIMESTAMP,
             must_change_password = false
         WHERE email = $2`,
        [hash, email]
      );
      
      console.log('✅ Admin password updated successfully!');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      // Create new admin
      const hash = await createPasswordHash(password);
      if (!hash) {
        throw new Error('Failed to create password hash');
      }
      
      await query(
        `INSERT INTO app_users (id, name, email, role, status, password_hash, password_changed_at)
         VALUES (uuid_generate_v4(), $1, $2, 'admin', 'active', $3, CURRENT_TIMESTAMP)`,
        [name, email, hash]
      );
      
      console.log('✅ Admin user created successfully!');
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    const pool = getDbPool();
    await pool.end();
  }
}

createAdmin();

