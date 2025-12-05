# PostgreSQL Setup Guide

SAMS now uses PostgreSQL instead of Supabase. All data is stored in a local PostgreSQL database.

## Quick Start

### 1. Start Docker Containers

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- API server (port 3001)
- Frontend dev server (port 8000)

### 2. Default Admin Credentials

After the database initializes, you can login with:

- **Email**: `admin@sams.local`
- **Password**: `admin123`

### 3. Access the Application

- Frontend: http://localhost:8000
- API: http://localhost:3001
- Database: localhost:5432

## Database Connection

- **Host**: `postgres` (from within Docker) or `localhost` (from host)
- **Port**: `5432`
- **Database**: `sams`
- **User**: `sams_user`
- **Password**: `sams_password`

## Database Schema

The database schema is automatically created when the PostgreSQL container starts for the first time. The initialization script is located at `database/init.sql`.

### Tables Created

- `app_users` - User accounts
- `properties` - Property/location data
- `assets` - Asset inventory
- `item_types` - Asset type definitions
- `departments` - Department information
- `tickets` - Maintenance tickets
- `ticket_comments` - Ticket comments
- `qr_codes` - QR code records
- `approvals` - Approval requests
- `activity_log` - Activity tracking
- `user_preferences` - User preferences
- `user_settings` - User settings
- `system_settings` - System configuration
- `user_property_access` - User property access control
- `licenses` - License information

## API Endpoints

The API server provides REST endpoints:

- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `POST /api/auth/login` - Login (returns user with password_hash for client verification)
- `GET /api/assets` - List assets
- `POST /api/assets` - Create asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `GET /api/properties` - List properties
- `POST /api/properties` - Create property

## Environment Variables

### API Server
- `DATABASE_URL` - PostgreSQL connection string
- `API_PORT` - API server port (default: 3001)

### Frontend
- `VITE_API_URL` - API server URL (default: `/api` which proxies to localhost:3001)

## Troubleshooting

### Database not initializing

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### API server not connecting

```bash
# Check API logs
docker-compose logs sams-api

# Verify database is ready
docker-compose exec postgres pg_isready -U sams_user -d sams
```

### Reset database

```bash
# Stop containers
docker-compose down

# Remove volume
docker volume rm sams_postgres_data

# Start again
docker-compose up -d
```

## Migration from Supabase

If you were using Supabase before:

1. All Supabase dependencies have been removed
2. Services now use the API client (`src/lib/api.ts`)
3. Authentication uses PostgreSQL instead of Supabase Auth
4. All data operations go through the API server

## Development

### Run API server separately

```bash
npm run dev:api
```

### Run frontend separately

```bash
npm run dev
```

### Run both

```bash
npm run dev:all
```

## Production

For production, you'll need to:

1. Set secure database credentials
2. Use environment variables for connection strings
3. Set up proper database backups
4. Configure SSL for database connections
5. Use a reverse proxy (nginx) for the API server

