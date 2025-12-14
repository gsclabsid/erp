import express from 'express';
import cors from 'cors';
import { getDbPool, query, toCamelCase, toSnakeCase } from '../src/lib/db';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// Users endpoints
app.get('/api/users', async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role, department, phone, last_login, status, avatar_url, must_change_password, password_changed_at, active_session_id FROM app_users ORDER BY name');
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM app_users WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const user = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO app_users (name, email, role, department, phone, password_hash, status, avatar_url, must_change_password, password_changed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        user.name,
        user.email,
        user.role || 'user',
        user.department || null,
        user.phone || null,
        user.password_hash || null,
        user.status || 'active',
        user.avatar_url || null,
        user.must_change_password || false,
        user.password_changed_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const user = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(user)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE app_users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM app_users WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Auth endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await query(
      'SELECT * FROM app_users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    // Return user with password_hash for client-side verification
    // Client will verify password hash using the same logic as auth.ts
    res.json(toCamelCase({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
      status: user.status,
      avatar_url: user.avatar_url,
      must_change_password: user.must_change_password,
      password_hash: user.password_hash, // Client-side verification
    }));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assets endpoints
app.get('/api/assets', async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, type, property, property_id, department, quantity, 
             purchase_date, expiry_date, po_number, condition, status, location, 
             description, serial_number, created_at, created_by, created_by_name, 
             created_by_email, amc_enabled, amc_start_date, amc_end_date
      FROM assets 
      ORDER BY created_at DESC
    `);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/assets', async (req, res) => {
  try {
    const asset = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO assets (id, name, type, property, property_id, department, quantity, 
                          purchase_date, expiry_date, po_number, condition, status, location, 
                          description, serial_number, created_by, created_by_name, created_by_email,
                          amc_enabled, amc_start_date, amc_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [
        asset.id,
        asset.name,
        asset.type,
        asset.property,
        asset.property_id,
        asset.department,
        asset.quantity || 1,
        asset.purchase_date,
        asset.expiry_date,
        asset.po_number,
        asset.condition,
        asset.status || 'active',
        asset.location,
        asset.description,
        asset.serial_number,
        asset.created_by,
        asset.created_by_name,
        asset.created_by_email,
        asset.amc_enabled || false,
        asset.amc_start_date,
        asset.amc_end_date,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/assets/:id', async (req, res) => {
  try {
    const asset = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(asset)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE assets SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/assets/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM assets WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Properties endpoints
app.get('/api/properties', async (req, res) => {
  try {
    const result = await query('SELECT * FROM properties ORDER BY name');
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM properties WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/properties', async (req, res) => {
  try {
    const property = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO properties (id, name, address, type, status, manager)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        property.id,
        property.name,
        property.address,
        property.type,
        property.status || 'active',
        property.manager,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/properties/:id', async (req, res) => {
  try {
    const property = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(property)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE properties SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/properties/:id', async (req, res) => {
  try {
    // Delete related records first to avoid FK constraints
    await query('DELETE FROM assets WHERE property_id = $1', [req.params.id]);
    // Note: Add other related table deletes as needed (audit_incharge, audit_sessions, etc.)
    
    const result = await query('DELETE FROM properties WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Tickets endpoints
app.get('/api/tickets', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM tickets WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (req.query.status) {
      queryText += ` AND status = $${paramCount}`;
      params.push(req.query.status);
      paramCount++;
    }
    if (req.query.assignee) {
      queryText += ` AND assignee = $${paramCount}`;
      params.push(req.query.assignee);
      paramCount++;
    }
    if (req.query.targetRole) {
      queryText += ` AND target_role = $${paramCount}`;
      params.push(req.query.targetRole);
      paramCount++;
    }
    if (req.query.createdBy) {
      queryText += ` AND created_by = $${paramCount}`;
      params.push(req.query.createdBy);
      paramCount++;
    }

    queryText += ' ORDER BY created_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tickets/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM tickets WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tickets', async (req, res) => {
  try {
    const ticket = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO tickets (id, title, description, status, priority, assignee, target_role, created_by, property_id, sla_due_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.status || 'open',
        ticket.priority || 'medium',
        ticket.assignee,
        ticket.target_role,
        ticket.created_by,
        ticket.property_id,
        ticket.sla_due_at,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tickets/:id', async (req, res) => {
  try {
    const ticket = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(ticket)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE tickets SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ticket Events endpoints
app.get('/api/ticket-events', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM ticket_comments WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (req.query.ticketId) {
      queryText += ` AND ticket_id = $${paramCount}`;
      params.push(req.query.ticketId);
      paramCount++;
    }

    queryText += ' ORDER BY created_at DESC';
    const result = await query(queryText, params);
    // Map ticket_comments to ticket_events format
    const events = result.rows.map((row: any) => ({
      id: row.id,
      ticket_id: row.ticket_id,
      event_type: 'comment', // Default, could be enhanced
      author: row.user_name || row.user_id,
      message: row.comment,
      created_at: row.created_at,
    }));
    res.json(toCamelCase(events));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ticket-events', async (req, res) => {
  try {
    const event = toSnakeCase(req.body);
    // Store as ticket_comment for now (can be enhanced with separate events table)
    const result = await query(
      `INSERT INTO ticket_comments (ticket_id, user_id, user_name, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        event.ticket_id,
        event.author,
        event.author,
        event.message || event.comment || '',
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Item Types endpoints
app.get('/api/item-types', async (req, res) => {
  try {
    const result = await query('SELECT * FROM item_types ORDER BY name');
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/item-types', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const result = await query(
      'INSERT INTO item_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING RETURNING *',
      [name]
    );
    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Item type already exists' });
    }
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/item-types/:name', async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    const result = await query('DELETE FROM item_types WHERE name = $1 RETURNING name', [name]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item type not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User Property Access endpoints
app.get('/api/user-property-access', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM user_property_access WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (req.query.propertyId) {
      queryText += ` AND property_id = $${paramCount}`;
      params.push(req.query.propertyId);
      paramCount++;
    }
    if (req.query.userId) {
      queryText += ` AND user_id = $${paramCount}`;
      params.push(req.query.userId);
      paramCount++;
    }

    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-property-access', async (req, res) => {
  try {
    const { userId, propertyIds } = req.body;
    if (!userId || !Array.isArray(propertyIds)) {
      return res.status(400).json({ error: 'userId and propertyIds array are required' });
    }

    // Delete existing access for this user
    await query('DELETE FROM user_property_access WHERE user_id = $1', [userId]);

    // Insert new access records
    if (propertyIds.length > 0) {
      const values = propertyIds.map((pid: string, idx: number) => 
        `($${idx * 2 + 1}, $${idx * 2 + 2})`
      ).join(', ');
      const params = propertyIds.flatMap((pid: string) => [userId, pid]);
      await query(
        `INSERT INTO user_property_access (user_id, property_id) VALUES ${values}`,
        params
      );
    }

    const result = await query(
      'SELECT property_id FROM user_property_access WHERE user_id = $1',
      [userId]
    );
    res.json(toCamelCase(result.rows.map((r: any) => r.property_id)));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/user-property-access', async (req, res) => {
  try {
    const { userId, propertyId } = req.query;
    if (!userId || !propertyId) {
      return res.status(400).json({ error: 'userId and propertyId are required' });
    }
    const result = await query(
      'DELETE FROM user_property_access WHERE user_id = $1 AND property_id = $2 RETURNING id',
      [userId, propertyId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Access record not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Departments endpoints
app.get('/api/departments', async (req, res) => {
  try {
    const result = await query('SELECT * FROM departments ORDER BY name');
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/departments', async (req, res) => {
  try {
    const dept = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO departments (id, name, code, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        dept.id,
        dept.name,
        dept.code,
        dept.is_active ?? true,
        dept.created_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/departments/:id', async (req, res) => {
  try {
    const dept = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(dept)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE departments SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/departments/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// QR Codes endpoints
app.get('/api/qr-codes', async (req, res) => {
  try {
    const result = await query(`
      SELECT qr.*, a.name as asset_name
      FROM qr_codes qr
      LEFT JOIN assets a ON qr.asset_id = a.id
      ORDER BY qr.created_at DESC
    `);
    const rows = result.rows.map((row: any) => ({
      ...row,
      assets: row.asset_name ? { name: row.asset_name } : null,
    }));
    res.json(toCamelCase(rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/qr-codes', async (req, res) => {
  try {
    const qr = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO qr_codes (id, asset_id, qr_data, format, size, property, generated_date, status, printed, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        qr.id,
        qr.asset_id,
        qr.qr_data || '',
        qr.format || 'png',
        qr.size || 200,
        qr.property,
        qr.generated_date,
        qr.status || 'active',
        qr.printed || false,
        qr.image_url,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/qr-codes/:id', async (req, res) => {
  try {
    const qr = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(qr)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE qr_codes SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'QR Code not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/qr-codes/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM qr_codes WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'QR Code not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Notifications endpoints
app.get('/api/notifications', async (req, res) => {
  try {
    const userId = req.query.user_id as string;
    const limit = parseInt(req.query.limit as string) || 50;
    
    let queryStr = 'SELECT id, user_id, title, message, type, read, created_at FROM notifications';
    const params: any[] = [];
    
    if (userId) {
      queryStr += ' WHERE user_id = $1';
      params.push(userId);
    }
    
    queryStr += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await query(queryStr, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const notification = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO notifications (id, user_id, title, message, type, read)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, title, message, type, read, created_at`,
      [
        notification.id,
        notification.user_id || null,
        notification.title,
        notification.message,
        notification.type || 'system',
        notification.read || false,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/:id', async (req, res) => {
  try {
    const notification = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(notification)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE notifications SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING id, user_id, title, message, type, read, created_at`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const userId = req.body.user_id as string;
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await query(
      'UPDATE notifications SET read = true WHERE user_id = $1 AND read = false RETURNING id',
      [userId]
    );
    res.json({ success: true, updated: result.rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM notifications WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notifications', async (req, res) => {
  try {
    const userId = req.query.user_id as string;
    if (!userId) {
      return res.status(400).json({ error: 'user_id is required' });
    }
    
    const result = await query('DELETE FROM notifications WHERE user_id = $1 RETURNING id', [userId]);
    res.json({ success: true, deleted: result.rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approvals endpoints
app.get('/api/approvals', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM approvals WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (req.query.status) {
      queryText += ` AND status = $${paramCount}`;
      params.push(req.query.status);
      paramCount++;
    }
    if (req.query.department) {
      queryText += ` AND department = $${paramCount}`;
      params.push(req.query.department);
      paramCount++;
    }
    if (req.query.requestedBy) {
      queryText += ` AND requested_by = $${paramCount}`;
      params.push(req.query.requestedBy);
      paramCount++;
    }
    if (req.query.assetId) {
      queryText += ` AND asset_id = $${paramCount}`;
      params.push(req.query.assetId);
      paramCount++;
    }

    queryText += ' ORDER BY requested_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/approvals/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM approvals WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/approvals', async (req, res) => {
  try {
    const approval = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO approvals (id, asset_id, action, status, requested_by, requested_at, notes, patch, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        approval.id,
        approval.asset_id,
        approval.action,
        approval.status || 'pending_manager',
        approval.requested_by,
        approval.requested_at || new Date().toISOString(),
        approval.notes || null,
        approval.patch ? JSON.stringify(approval.patch) : null,
        approval.department || null,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/approvals/:id', async (req, res) => {
  try {
    const approval = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(approval)) {
      if (key !== 'id' && value !== undefined) {
        if (key === 'patch' && value !== null) {
          fields.push(`${key} = $${paramCount}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          fields.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE approvals SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Approval not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approval Events endpoints
app.get('/api/approval-events', async (req, res) => {
  try {
    let queryText = 'SELECT * FROM approval_events WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (req.query.approvalId) {
      queryText += ` AND approval_id = $${paramCount}`;
      params.push(req.query.approvalId);
      paramCount++;
    }

    queryText += ' ORDER BY created_at ASC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/approval-events', async (req, res) => {
  try {
    const event = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO approval_events (id, approval_id, event_type, author, message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        event.id,
        event.approval_id,
        event.event_type,
        event.author || null,
        event.message || null,
        event.created_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User Permissions endpoints
app.get('/api/user-permissions', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const result = await query(
      'SELECT * FROM user_permissions WHERE user_id = $1',
      [userId]
    );
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-permissions', async (req, res) => {
  try {
    const { userId, permissions } = req.body;
    if (!userId || !Array.isArray(permissions)) {
      return res.status(400).json({ error: 'userId and permissions array are required' });
    }

    // Delete existing permissions for this user
    await query('DELETE FROM user_permissions WHERE user_id = $1', [userId]);

    // Insert new permissions
    if (permissions.length > 0) {
      const values = permissions.map((p: any, idx: number) => 
        `($${idx * 3 + 1}, $${idx * 3 + 2}, $${idx * 3 + 3}, $${idx * 3 + 4})`
      ).join(', ');
      const params = permissions.flatMap((p: any) => [userId, p.page, p.v || false, p.e || false]);
      await query(
        `INSERT INTO user_permissions (user_id, page, can_view, can_edit) VALUES ${values}`,
        params
      );
    }

    const result = await query(
      'SELECT * FROM user_permissions WHERE user_id = $1',
      [userId]
    );
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User Department Access endpoints
app.get('/api/user-department-access', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const result = await query(
      'SELECT department FROM user_department_access WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows.map((r: any) => r.department));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-department-access', async (req, res) => {
  try {
    const { userId, departments } = req.body;
    if (!userId || !Array.isArray(departments)) {
      return res.status(400).json({ error: 'userId and departments array are required' });
    }

    // Delete existing access for this user
    await query('DELETE FROM user_department_access WHERE user_id = $1', [userId]);

    // Insert new access records
    if (departments.length > 0) {
      const values = departments.map((dept: string, idx: number) => 
        `($${idx * 2 + 1}, $${idx * 2 + 2})`
      ).join(', ');
      const params = departments.flatMap((dept: string) => [userId, dept]);
      await query(
        `INSERT INTO user_department_access (user_id, department) VALUES ${values}`,
        params
      );
    }

    const result = await query(
      'SELECT department FROM user_department_access WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows.map((r: any) => r.department));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User Preferences endpoints
app.get('/api/user-preferences', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const result = await query(
      'SELECT key, value FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    // Convert key-value pairs to object
    const prefs: any = {};
    result.rows.forEach((row: any) => {
      try {
        prefs[row.key] = JSON.parse(row.value);
      } catch {
        prefs[row.key] = row.value;
      }
    });
    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-preferences', async (req, res) => {
  try {
    const { userId, preferences } = req.body;
    if (!userId || !preferences) {
      return res.status(400).json({ error: 'userId and preferences are required' });
    }
    // Upsert each preference
    for (const [key, value] of Object.entries(preferences)) {
      await query(
        `INSERT INTO user_preferences (user_id, key, value, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, key) 
         DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, key, typeof value === 'string' ? value : JSON.stringify(value)]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// User Settings endpoints
app.get('/api/user-settings', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const result = await query(
      'SELECT key, value FROM user_settings WHERE user_id = $1',
      [userId]
    );
    const settings: any = {};
    result.rows.forEach((row: any) => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user-settings', async (req, res) => {
  try {
    const { userId, settings } = req.body;
    if (!userId || !settings) {
      return res.status(400).json({ error: 'userId and settings are required' });
    }
    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO user_settings (user_id, key, value, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id, key) 
         DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP`,
        [userId, key, typeof value === 'string' ? value : JSON.stringify(value)]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// System Settings endpoints
app.get('/api/system-settings', async (req, res) => {
  try {
    const result = await query('SELECT key, value, description FROM system_settings');
    const settings: any = {};
    result.rows.forEach((row: any) => {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch {
        settings[row.key] = row.value;
      }
    });
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/system-settings', async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings) {
      return res.status(400).json({ error: 'settings are required' });
    }
    for (const [key, value] of Object.entries(settings)) {
      await query(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (key) 
         DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, typeof value === 'string' ? value : JSON.stringify(value)]
      );
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Reports endpoints
app.get('/api/reports', async (req, res) => {
  try {
    const result = await query('SELECT * FROM reports ORDER BY created_at DESC');
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const report = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO reports (id, name, type, format, status, date_from, date_to, file_url, 
        filter_session_id, filter_department, filter_property, filter_asset_type, 
        created_by, created_by_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        report.id,
        report.name,
        report.type,
        report.format || 'csv',
        report.status || 'completed',
        report.date_from || null,
        report.date_to || null,
        report.file_url || null,
        report.filter_session_id || null,
        report.filter_department || null,
        report.filter_property || null,
        report.filter_asset_type || null,
        report.created_by || null,
        report.created_by_id || null,
        report.created_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/reports', async (req, res) => {
  try {
    await query('DELETE FROM reports');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Activity Log endpoints
app.get('/api/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await query(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM activity_log al
       LEFT JOIN app_users u ON al.user_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/activity', async (req, res) => {
  try {
    const activity = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        activity.user_id || null,
        activity.action,
        activity.entity_type || null,
        activity.entity_id || null,
        activity.details ? JSON.stringify(activity.details) : null,
        activity.created_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Newsletter Posts endpoints
app.get('/api/newsletter-posts', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const published = req.query.published;
    let queryText = 'SELECT * FROM newsletter_posts';
    const params: any[] = [];
    if (published !== undefined) {
      queryText += ' WHERE published = $1';
      params.push(published === 'true');
    }
    queryText += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(limit);
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/newsletter-posts', async (req, res) => {
  try {
    const post = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO newsletter_posts (id, title, body, category, published, author, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        post.id,
        post.title,
        post.body,
        post.category || 'release_notes',
        post.published ?? true,
        post.author || null,
        post.created_at || new Date().toISOString(),
        post.updated_at || null,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/newsletter-posts/:id', async (req, res) => {
  try {
    const post = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(post)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE newsletter_posts SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Newsletter post not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/newsletter-posts/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM newsletter_posts WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Newsletter post not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ticket Comments endpoints (using existing ticket_comments table)
app.get('/api/ticket-comments', async (req, res) => {
  try {
    const ticketId = req.query.ticketId as string;
    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }
    const result = await query(
      'SELECT * FROM ticket_comments WHERE ticket_id = $1 ORDER BY created_at ASC',
      [ticketId]
    );
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ticket-comments', async (req, res) => {
  try {
    const comment = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO ticket_comments (ticket_id, user_id, user_name, comment, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        comment.ticket_id,
        comment.user_id || null,
        comment.user_name || null,
        comment.comment,
        comment.created_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Ticket Attachments endpoints
app.get('/api/ticket-attachments', async (req, res) => {
  try {
    const ticketId = req.query.ticketId as string;
    if (!ticketId) {
      return res.status(400).json({ error: 'ticketId is required' });
    }
    const result = await query(
      'SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY uploaded_at DESC',
      [ticketId]
    );
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ticket-attachments', async (req, res) => {
  try {
    const attachment = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO ticket_attachments (id, ticket_id, name, url, uploaded_at, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        attachment.id,
        attachment.ticket_id,
        attachment.name,
        attachment.url,
        attachment.uploaded_at || new Date().toISOString(),
        attachment.uploaded_by || null,
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ticket-attachments/:id', async (req, res) => {
  try {
    const result = await query('DELETE FROM ticket_attachments WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Sessions endpoints
app.get('/api/audit-sessions', async (req, res) => {
  try {
    const isActive = req.query.isActive;
    let queryText = 'SELECT * FROM audit_sessions';
    const params: any[] = [];
    if (isActive !== undefined) {
      queryText += ' WHERE is_active = $1';
      params.push(isActive === 'true');
    }
    queryText += ' ORDER BY started_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-sessions/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM audit_sessions WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit session not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-sessions', async (req, res) => {
  try {
    const session = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO audit_sessions (id, started_at, frequency_months, initiated_by, is_active, property_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        session.id,
        session.started_at || new Date().toISOString(),
        session.frequency_months || 1,
        session.initiated_by || null,
        session.is_active ?? true,
        session.property_id || null,
        session.created_at || new Date().toISOString(),
        session.updated_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/audit-sessions/:id', async (req, res) => {
  try {
    const session = toSnakeCase(req.body);
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    for (const [key, value] of Object.entries(session)) {
      if (key !== 'id' && value !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    const result = await query(
      `UPDATE audit_sessions SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${paramCount} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit session not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Assignments endpoints
app.get('/api/audit-assignments', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    let queryText = 'SELECT * FROM audit_assignments';
    const params: any[] = [];
    if (sessionId) {
      queryText += ' WHERE session_id = $1';
      params.push(sessionId);
    }
    queryText += ' ORDER BY created_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-assignments', async (req, res) => {
  try {
    const assignment = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO audit_assignments (session_id, department, status, submitted_at, submitted_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (session_id, department)
       DO UPDATE SET status = $3, submitted_at = $4, submitted_by = $5, updated_at = $7
       RETURNING *`,
      [
        assignment.session_id,
        assignment.department,
        assignment.status || 'pending',
        assignment.submitted_at || null,
        assignment.submitted_by || null,
        assignment.created_at || new Date().toISOString(),
        assignment.updated_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Reviews endpoints
app.get('/api/audit-reviews', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    const department = req.query.department as string;
    let queryText = 'SELECT * FROM audit_reviews WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (sessionId) {
      queryText += ` AND session_id = $${paramCount}`;
      params.push(sessionId);
      paramCount++;
    }
    if (department) {
      queryText += ` AND department = $${paramCount}`;
      params.push(department);
      paramCount++;
    }

    queryText += ' ORDER BY updated_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-reviews', async (req, res) => {
  try {
    const reviews = Array.isArray(req.body) ? req.body : [req.body];
    const results: any[] = [];

    for (const review of reviews) {
      const r = toSnakeCase(review);
      const result = await query(
        `INSERT INTO audit_reviews (session_id, asset_id, department, status, comment, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (session_id, asset_id, department)
         DO UPDATE SET status = $4, comment = $5, updated_at = $7
         RETURNING *`,
        [
          r.session_id,
          r.asset_id,
          r.department,
          r.status || 'verified',
          r.comment || null,
          r.created_at || new Date().toISOString(),
          r.updated_at || new Date().toISOString(),
        ]
      );
      results.push(result.rows[0]);
    }

    res.status(201).json(toCamelCase(results));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Reports endpoints
app.get('/api/audit-reports', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    let queryText = 'SELECT * FROM audit_reports';
    const params: any[] = [];
    if (sessionId) {
      queryText += ' WHERE session_id = $1';
      params.push(sessionId);
    }
    queryText += ' ORDER BY generated_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/audit-reports/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM audit_reports WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Audit report not found' });
    }
    res.json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-reports', async (req, res) => {
  try {
    const report = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO audit_reports (id, session_id, generated_at, generated_by, summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        report.id,
        report.session_id,
        report.generated_at || new Date().toISOString(),
        report.generated_by || null,
        report.summary ? JSON.stringify(report.summary) : null,
        report.created_at || new Date().toISOString(),
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Audit Scans endpoints
app.get('/api/audit-scans', async (req, res) => {
  try {
    const sessionId = req.query.sessionId as string;
    let queryText = 'SELECT * FROM audit_scans';
    const params: any[] = [];
    if (sessionId) {
      queryText += ' WHERE session_id = $1';
      params.push(sessionId);
    }
    queryText += ' ORDER BY scanned_at DESC';
    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/audit-scans', async (req, res) => {
  try {
    const scan = toSnakeCase(req.body);
    const result = await query(
      `INSERT INTO audit_scans (session_id, asset_id, scanned_at, scanned_by, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        scan.session_id,
        scan.asset_id,
        scan.scanned_at || new Date().toISOString(),
        scan.scanned_by || null,
        scan.status || 'scanned',
      ]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Final Approvers endpoints
app.get('/api/final-approvers', async (req, res) => {
  try {
    const propertyId = req.query.propertyId as string;
    const userId = req.query.userId as string;
    let queryText = 'SELECT * FROM final_approvers WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (propertyId) {
      queryText += ` AND property_id = $${paramCount}`;
      params.push(propertyId);
      paramCount++;
    }
    if (userId) {
      queryText += ` AND user_id = $${paramCount}`;
      params.push(userId);
      paramCount++;
    }

    const result = await query(queryText, params);
    res.json(toCamelCase(result.rows));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/final-approvers', async (req, res) => {
  try {
    const { propertyId, userId, userName } = req.body;
    if (!propertyId || !userId) {
      return res.status(400).json({ error: 'propertyId and userId are required' });
    }
    const result = await query(
      `INSERT INTO final_approvers (property_id, user_id, user_name, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (property_id)
       DO UPDATE SET user_id = $2, user_name = $3, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [propertyId, userId, userName || null]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/final-approvers', async (req, res) => {
  try {
    const propertyId = req.query.propertyId as string;
    const userId = req.query.userId as string;
    if (!propertyId && !userId) {
      return res.status(400).json({ error: 'propertyId or userId is required' });
    }
    let queryText = 'DELETE FROM final_approvers WHERE 1=1';
    const params: any[] = [];
    if (propertyId) {
      queryText += ' AND property_id = $1';
      params.push(propertyId);
    }
    if (userId) {
      queryText += propertyId ? ' AND user_id = $2' : ' AND user_id = $1';
      params.push(userId);
    }
    queryText += ' RETURNING id';
    const result = await query(queryText, params);
    res.json({ success: true, deleted: result.rows.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});

