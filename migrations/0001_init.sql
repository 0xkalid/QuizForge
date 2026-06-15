-- QuizForge initial schema
CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- email from Cloudflare Access JWT
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL     -- unix ms
);

CREATE TABLE quizzes (
  id TEXT PRIMARY KEY,            -- nanoid
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_archived INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,       -- order within quiz
  type TEXT NOT NULL CHECK (type IN ('multiple_choice','true_false')),
  text TEXT NOT NULL,
  time_limit_s INTEGER NOT NULL DEFAULT 20 CHECK (time_limit_s BETWEEN 5 AND 120),
  points INTEGER NOT NULL DEFAULT 1000
);

CREATE TABLE answer_options (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,       -- 0-3
  text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE game_sessions (
  id TEXT PRIMARY KEY,
  quiz_id TEXT NOT NULL,
  quiz_title TEXT NOT NULL,        -- denormalized snapshot
  host_id TEXT NOT NULL,
  started_at INTEGER,
  ended_at INTEGER,
  player_count INTEGER DEFAULT 0
);

CREATE TABLE player_results (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  final_score INTEGER NOT NULL,
  final_rank INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  question_count INTEGER NOT NULL
);

CREATE INDEX idx_quizzes_owner ON quizzes(owner_id, is_archived);
CREATE INDEX idx_questions_quiz ON questions(quiz_id, position);
CREATE INDEX idx_results_session ON player_results(session_id);
