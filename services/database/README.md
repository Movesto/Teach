# Database Service

PostgreSQL database for the Teach application.

## Quick Start

```bash
docker-compose up -d
```

## Connection Details

| Property | Value |
|----------|-------|
| Host | localhost |
| Port | 5432 |
| Database | teach_db |
| Username | teach_user |
| Password | teach_secure_pass_123 |

## Connection String

```
postgresql://teach_user:teach_secure_pass_123@localhost:5432/teach_db
```

## Tables

| Table | Purpose |
|-------|---------|
| `users` | User accounts (guests + registered) |
| `conversations` | Chat sessions |
| `messages` | Individual messages in conversations |
| `user_progress` | Learning progress per skill |
| `user_preferences` | User settings |
| `lessons` | Learning materials (future) |
| `user_lessons` | Track completed lessons |
| `translation_cache` | Cache translations for performance |

## Commands

```bash
# Start database
docker-compose up -d

# Stop database
docker-compose down

# View logs
docker logs teach-database

# Connect to database (from terminal)
docker exec -it teach-database psql -U teach_user -d teach_db

# Reset database (WARNING: deletes all data)
docker-compose down -v
docker-compose up -d
```

## Backup & Restore

```bash
# Backup
docker exec teach-database pg_dump -U teach_user teach_db > backup.sql

# Restore
cat backup.sql | docker exec -i teach-database psql -U teach_user -d teach_db
```
