# Docker Setup Guide for SAMS

This guide will help you run SAMS in Docker containers, avoiding Node.js version compatibility issues.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose (usually included with Docker Desktop)

## Quick Start (Development Mode)

### 1. Build and Run

```bash
# Start the development server
docker-compose up sams-dev

# Or run in detached mode (background)
docker-compose up -d sams-dev
```

### 2. Access the Application

- **Demo Mode**: http://localhost:8000/demo/login
  - Email: `demo@demo.com`
  - Password: `demo@123`

- **Regular Login**: http://localhost:8000/login (requires Supabase)

### 3. Stop the Container

```bash
# Stop the container
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Development Workflow

### Hot Reload

The development container uses volume mounting, so changes to your code will automatically reload:

```bash
# Watch logs
docker-compose logs -f sams-dev

# Restart container
docker-compose restart sams-dev
```

### Rebuild After Dependency Changes

If you modify `package.json`:

```bash
# Rebuild the container
docker-compose build sams-dev

# Start with new build
docker-compose up sams-dev
```

## Production Build

### Option 1: Using Docker Compose

Uncomment the `sams-prod` service in `docker-compose.yml`, then:

```bash
docker-compose up sams-prod
```

Access at: http://localhost

### Option 2: Using Docker Directly

```bash
# Build production image
docker build --target production -t sams:latest .

# Run production container
docker run -d -p 80:80 --name sams-prod sams:latest
```

## Environment Variables

### Development Mode (No Supabase)

No environment variables needed! The app runs in demo mode automatically.

### With Supabase

SAMS now uses PostgreSQL with a local API server. No additional environment variables are required for local development.

The Docker setup includes:
- PostgreSQL database (automatically initialized)
- Express API server (connects to PostgreSQL)
- Vite development server (frontend)

See `SETUP_COMPLETE.md` for detailed setup instructions.

## Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs sams-dev

# Check if port is already in use
lsof -i :8000
```

### Clear everything and start fresh

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v

# Remove images
docker rmi $(docker images -q sams*)

# Rebuild from scratch
docker-compose build --no-cache sams-dev
docker-compose up sams-dev
```

### View container shell

```bash
# Access container shell
docker-compose exec sams-dev sh

# Or using docker directly
docker exec -it sams-dev sh
```

## Docker Commands Cheat Sheet

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild containers
docker-compose build

# Rebuild without cache
docker-compose build --no-cache

# List running containers
docker ps

# List all containers
docker ps -a

# Remove stopped containers
docker-compose rm
```

## Notes

- The development container uses Node.js 20 (Alpine Linux)
- Port 8000 is exposed for the Vite dev server
- Source code is mounted as a volume for hot reload
- `node_modules` is excluded from volume mount for performance
- No Supabase account needed for demo mode!

