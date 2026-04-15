# Database Migrations Guide

## What is a migration?

Your app stores data in a database made up of **tables** (think spreadsheets).
Each table has **columns** (the headers) and **rows** (the data).

For example, the `users` table looks like this:

| id | email | name | cefr_level | placement_done |
|----|-------|------|------------|----------------|
| abc-123 | ali@example.com | Ali | A2 | true |

A **migration** is a file that describes a change to that structure — like adding a new
column, creating a new table, or removing something you no longer need.

Alembic keeps track of which migrations have been applied to your database so you
never apply the same change twice.

---

## The golden rule

> **Never edit `services/database/init-user-data-only.sql` to make schema changes.**
> That file only runs when the database is brand new. It won't affect an existing database.
> All schema changes go through Alembic migrations.

---

## Where migrations live

```
backend/
  alembic/
    versions/
      0001_initial_schema.py   ← The starting point (already applied)
      0002_your_change.py      ← You'll add files like this
```

Each file has two functions:
- `upgrade()` — what to do (add the table/column)
- `downgrade()` — how to undo it (remove the table/column)

---

## How to make a schema change — step by step

### Step 1 — Decide what you need

Think in plain English first. Examples:
- "I want to track how many times a student replays audio"
- "I need to store the student's timezone"
- "I want a table that logs every time a student logs in"

### Step 2 — Create the migration file

Copy the last migration file and give it the next number.
If the latest is `0001_initial_schema.py`, name yours `0002_your_description.py`.

Use short, lowercase, underscored descriptions:
- `0002_add_audio_replay_count.py`
- `0003_add_user_timezone.py`
- `0004_create_login_log_table.py`

### Step 3 — Write the upgrade and downgrade

Open your new file and fill it in. Here are the most common patterns:

---

#### Add a column to an existing table

```python
"""Add timezone to users

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-01
"""
from alembic import op

revision = "0002"
down_revision = "0001"   # ← always points to the previous migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'America/Chicago'
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS timezone")
```

---

#### Create a brand new table

```python
"""Create login_log table

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-10
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS login_log (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            user_id UUID REFERENCES users(id) ON DELETE CASCADE,
            logged_in_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            ip_address VARCHAR(45)
        )
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS login_log")
```

---

#### Rename a column

```python
def upgrade() -> None:
    op.execute("""
        ALTER TABLE users RENAME COLUMN level TO proficiency_level
    """)

def downgrade() -> None:
    op.execute("""
        ALTER TABLE users RENAME COLUMN proficiency_level TO level
    """)
```

---

#### Add an index (speeds up queries on a column you search often)

```python
def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_user_lessons_user_id
        ON user_lessons (user_id)
    """)

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_lessons_user_id")
```

---

### Step 4 — Apply the migration

**If running locally (outside Docker):**

```bash
cd backend

# Windows — set env vars inline
set DB_HOST=localhost && set DB_NAME=teach_db && set DB_USER=teach_user && set DB_PASSWORD=teach_secure_pass_123 && alembic upgrade head
```

**If running in Docker:**

```bash
# The migration runs automatically when the backend container starts.
# Just restart it:
docker compose restart backend

# Or watch the logs to confirm it ran:
docker compose logs backend --tail=20
```

You should see a line like:
```
Running upgrade 0001 -> 0002, Add timezone to users
```

---

### Step 5 — Update the backend code

Once the column or table exists, update `backend/main.py` to use it.

For example, if you added a `timezone` column, you'd update the register endpoint
to accept and save it, and the `/api/auth/me` endpoint to return it.

---

## Useful commands

```bash
# See which migration is currently applied
cd backend
alembic current

# See all migrations and which ones have been applied
alembic history

# Apply all pending migrations
alembic upgrade head

# Roll back one migration (undo the last change)
alembic downgrade -1

# Roll back to the very beginning (DANGER — wipes all tables if downgrade() is correct)
alembic downgrade base
```

---

## Common column types

| What you want to store | SQL type |
|------------------------|----------|
| Short text (name, code) | `VARCHAR(100)` |
| Long text (essay, notes) | `TEXT` |
| Whole number | `INTEGER` |
| Decimal number | `FLOAT` |
| True/False | `BOOLEAN` |
| Date and time | `TIMESTAMP WITH TIME ZONE` |
| Just a date | `DATE` |
| Unique ID | `UUID` |
| Flexible structured data (list, dict) | `JSONB` |

---

## Things to never do

- **Never delete a migration file** that has already been applied to a real database.
  If you need to reverse a change, write a new migration that undoes it.

- **Never edit an already-applied migration.** Once `0001` has run on a real database,
  changing it does nothing — Alembic won't re-run it. Write `0002` instead.

- **Never skip the `down_revision`** pointer. Each migration must point to the one
  before it, forming a chain. If you get this wrong, Alembic will tell you.

---

## If something goes wrong

**"relation already exists"** — The table or column is already there.
Use `IF NOT EXISTS` in your SQL (as shown in the examples above).

**"column does not exist"** — Your backend code references a column that hasn't
been migrated yet. Run `alembic upgrade head` first.

**"Can't locate revision"** — The `down_revision` in your file doesn't match any
existing migration ID. Check the spelling against the previous file.

**The backend container won't start** — Check the logs:
```bash
docker compose logs backend --tail=30
```
A failed migration will print the error there.
