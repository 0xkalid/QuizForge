// Quiz CRUD handlers (spec §5). All routes are host-authenticated; the
// authenticated user is set on the Hono context as `user`.

import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import type { Env, AuthedUser } from '../lib/env';
import type { Quiz, QuizSummary, Question, AnswerOption } from '../lib/types';
import { validateQuizInput, validateTitle, type QuizInput } from '../lib/validation';
import type { FieldError } from '../lib/types';
import { ensureSampleQuizzes } from '../lib/sampleQuizzes';

type Vars = { user: AuthedUser };

export const quizzes = new Hono<{ Bindings: Env; Variables: Vars }>();

function badRequest(fields: FieldError[]) {
  return { error: 'Validation failed', fields };
}

// GET /api/quizzes — list own (non-archived) quizzes with question counts.
quizzes.get('/', async (c) => {
  const user = c.get('user');
  // First-run convenience: a brand-new host gets the sample quizzes on first
  // dashboard load (no-op once they own any quiz).
  await ensureSampleQuizzes(c.env, user.id);
  const rows = await c.env.DB.prepare(
    `SELECT q.id, q.title, q.description, q.is_archived, q.created_at, q.updated_at,
            (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS question_count
       FROM quizzes q
      WHERE q.owner_id = ? AND q.is_archived = 0
      ORDER BY q.updated_at DESC`,
  )
    .bind(user.id)
    .all<{
      id: string;
      title: string;
      description: string;
      is_archived: number;
      created_at: number;
      updated_at: number;
      question_count: number;
    }>();

  const list: QuizSummary[] = rows.results.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    questionCount: r.question_count,
    isArchived: !!r.is_archived,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return c.json(list);
});

// POST /api/quizzes — create a quiz with just a title.
quizzes.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const errors: FieldError[] = [];
  validateTitle(body?.title, errors);
  if (errors.length) return c.json(badRequest(errors), 400);

  const id = nanoid();
  const now = Date.now();
  await c.env.DB.prepare(
    `INSERT INTO quizzes (id, owner_id, title, description, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, '', 0, ?, ?)`,
  )
    .bind(id, user.id, String(body.title).trim(), now, now)
    .run();

  return c.json({ id }, 201);
});

// GET /api/quizzes/:id — full quiz with questions + options.
quizzes.get('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const quiz = await loadQuiz(c.env, id);
  if (!quiz || quiz.ownerId !== user.id) {
    return c.json({ error: 'Quiz not found' }, 404);
  }
  return c.json(quiz);
});

// PUT /api/quizzes/:id — update metadata + full questions replace.
quizzes.put('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const owner = await c.env.DB.prepare(`SELECT owner_id FROM quizzes WHERE id = ?`)
    .bind(id)
    .first<{ owner_id: string }>();
  if (!owner || owner.owner_id !== user.id) {
    return c.json({ error: 'Quiz not found' }, 404);
  }

  const body = (await c.req.json().catch(() => null)) as QuizInput | null;
  const errors = validateQuizInput(body);
  if (errors.length) return c.json(badRequest(errors), 400);
  const input = body as QuizInput;

  const now = Date.now();
  const statements: D1PreparedStatement[] = [];

  statements.push(
    c.env.DB.prepare(`UPDATE quizzes SET title = ?, description = ?, updated_at = ? WHERE id = ?`).bind(
      input.title.trim(),
      (input.description ?? '').trim(),
      now,
      id,
    ),
  );
  // Delete + reinsert questions (ON DELETE CASCADE clears options).
  statements.push(c.env.DB.prepare(`DELETE FROM questions WHERE quiz_id = ?`).bind(id));

  input.questions.forEach((q, qi) => {
    const qId = nanoid();
    statements.push(
      c.env.DB.prepare(
        `INSERT INTO questions (id, quiz_id, position, type, text, time_limit_s, points)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(qId, id, qi, q.type, q.text.trim(), q.timeLimitS, q.points),
    );
    q.options.forEach((o, oi) => {
      statements.push(
        c.env.DB.prepare(
          `INSERT INTO answer_options (id, question_id, position, text, is_correct)
           VALUES (?, ?, ?, ?, ?)`,
        ).bind(nanoid(), qId, oi, o.text.trim(), o.isCorrect ? 1 : 0),
      );
    });
  });

  await c.env.DB.batch(statements);

  const updated = await loadQuiz(c.env, id);
  return c.json(updated);
});

// DELETE /api/quizzes/:id — soft delete (archive).
quizzes.delete('/:id', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  const res = await c.env.DB.prepare(
    `UPDATE quizzes SET is_archived = 1, updated_at = ? WHERE id = ? AND owner_id = ?`,
  )
    .bind(Date.now(), id, user.id)
    .run();
  if (!res.meta.changes) return c.json({ error: 'Quiz not found' }, 404);
  return c.json({ ok: true });
});

// ----- shared loader (also used by the games API for snapshotting) -----

export async function loadQuiz(env: Env, id: string): Promise<Quiz | null> {
  const quizRow = await env.DB.prepare(`SELECT * FROM quizzes WHERE id = ?`)
    .bind(id)
    .first<{
      id: string;
      owner_id: string;
      title: string;
      description: string;
      is_archived: number;
      created_at: number;
      updated_at: number;
    }>();
  if (!quizRow) return null;

  const questionRows = await env.DB.prepare(
    `SELECT * FROM questions WHERE quiz_id = ? ORDER BY position`,
  )
    .bind(id)
    .all<{
      id: string;
      position: number;
      type: 'multiple_choice' | 'true_false';
      text: string;
      time_limit_s: number;
      points: number;
    }>();

  const optionRows = await env.DB.prepare(
    `SELECT o.* FROM answer_options o
       JOIN questions q ON q.id = o.question_id
      WHERE q.quiz_id = ? ORDER BY o.position`,
  )
    .bind(id)
    .all<{
      id: string;
      question_id: string;
      position: number;
      text: string;
      is_correct: number;
    }>();

  const optionsByQ = new Map<string, AnswerOption[]>();
  for (const o of optionRows.results) {
    const arr = optionsByQ.get(o.question_id) ?? [];
    arr.push({ id: o.id, position: o.position, text: o.text, isCorrect: !!o.is_correct });
    optionsByQ.set(o.question_id, arr);
  }

  const questions: Question[] = questionRows.results.map((q) => ({
    id: q.id,
    position: q.position,
    type: q.type,
    text: q.text,
    timeLimitS: q.time_limit_s,
    points: q.points,
    options: optionsByQ.get(q.id) ?? [],
  }));

  return {
    id: quizRow.id,
    ownerId: quizRow.owner_id,
    title: quizRow.title,
    description: quizRow.description,
    isArchived: !!quizRow.is_archived,
    createdAt: quizRow.created_at,
    updatedAt: quizRow.updated_at,
    questions,
  };
}
