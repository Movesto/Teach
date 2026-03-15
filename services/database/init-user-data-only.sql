-- =============================================
-- USER DATA ONLY - NO LESSON CONTENT
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (keep as is)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(100),
    preferred_language VARCHAR(10) DEFAULT 'so',
    level VARCHAR(20) DEFAULT 'beginner',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User progress per lesson (reference lesson by ID from JSON files)
CREATE TABLE user_lessons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL,  -- References lesson-1.json, lesson-2.json, etc.
    unit_id INTEGER NOT NULL,     -- References unit ID from units.json
    completed BOOLEAN DEFAULT FALSE,
    score INTEGER,
    time_spent INTEGER, -- seconds
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, lesson_id)
);

-- Quiz attempts
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id INTEGER NOT NULL,
    answers JSONB,
    score INTEGER,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vocabulary tracking (for spaced repetition)
CREATE TABLE user_vocabulary (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    word VARCHAR(100) NOT NULL,
    lesson_id INTEGER,
    mastery_level INTEGER DEFAULT 0,
    last_reviewed TIMESTAMP WITH TIME ZONE,
    next_review TIMESTAMP WITH TIME ZONE,
    review_count INTEGER DEFAULT 0,
    UNIQUE(user_id, word)
);

-- Keep your other user-related tables
-- (conversations, messages, user_progress, user_preferences, translation_cache)

-- =============================================
-- STEP 1: Auth + Placement columns
-- =============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS recommended_unit INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cefr_level VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS placement_done BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS placement_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER,
  percentage FLOAT,
  level VARCHAR(20),
  cefr VARCHAR(10),
  recommended_unit INTEGER,
  breakdown JSONB,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_chapter_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  book_id VARCHAR(50) NOT NULL,
  chapter_id VARCHAR(50) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  quiz_score INTEGER,
  writing_passed BOOLEAN DEFAULT FALSE,
  UNIQUE(user_id, book_id, chapter_id)
);

CREATE TABLE IF NOT EXISTS unit_test_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  unit_id INTEGER NOT NULL,
  score INTEGER,
  percentage FLOAT,
  answers JSONB,
  taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, unit_id)
);