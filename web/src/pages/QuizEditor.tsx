import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiClientError } from '../lib/api';
import type { QuestionType, FieldError } from '@shared/types';
import { answerStyle } from '../lib/shapes';
import { ShapeIcon } from '../components/ShapeIcon';

interface EditOption {
  text: string;
  isCorrect: boolean;
}
interface EditQuestion {
  type: QuestionType;
  text: string;
  timeLimitS: number;
  points: number;
  options: EditOption[];
}

const TIME_OPTIONS = [5, 10, 20, 30, 45, 60, 90, 120];
const MAX_QUESTIONS = 50;

export function QuizEditor() {
  const { quizId = '' } = useParams();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<EditQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [topError, setTopError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getQuiz(quizId)
      .then((q) => {
        setTitle(q.title);
        setDescription(q.description);
        setQuestions(
          q.questions.map((qq) => ({
            type: qq.type,
            text: qq.text,
            timeLimitS: qq.timeLimitS,
            points: qq.points,
            options: qq.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          })),
        );
        setLoading(false);
      })
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 401) {
          navigate('/host/login', { replace: true });
          return;
        }
        setTopError('Could not load this quiz.');
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  function patchQuestion(i: number, patch: Partial<EditQuestion>) {
    setQuestions((qs) => qs.map((q, idx) => (idx === i ? { ...q, ...patch } : q)));
    setSaved(false);
  }

  function addQuestion(type: QuestionType) {
    if (questions.length >= MAX_QUESTIONS) return;
    const options: EditOption[] =
      type === 'true_false'
        ? [
            { text: 'True', isCorrect: true },
            { text: 'False', isCorrect: false },
          ]
        : [
            { text: '', isCorrect: true },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
            { text: '', isCorrect: false },
          ];
    setQuestions((qs) => [...qs, { type, text: '', timeLimitS: 20, points: 1000, options }]);
    setSaved(false);
  }

  function setCorrect(qi: number, oi: number) {
    patchQuestion(qi, {
      options: questions[qi].options.map((o, idx) => ({ ...o, isCorrect: idx === oi })),
    });
  }

  function setOptionText(qi: number, oi: number, text: string) {
    patchQuestion(qi, {
      options: questions[qi].options.map((o, idx) => (idx === oi ? { ...o, text } : o)),
    });
  }

  function addOption(qi: number) {
    const q = questions[qi];
    if (q.type === 'true_false' || q.options.length >= 4) return;
    patchQuestion(qi, { options: [...q.options, { text: '', isCorrect: false }] });
  }

  function removeOption(qi: number, oi: number) {
    const q = questions[qi];
    if (q.options.length <= 2) return;
    const next = q.options.filter((_, idx) => idx !== oi);
    if (!next.some((o) => o.isCorrect)) next[0].isCorrect = true;
    patchQuestion(qi, { options: next });
  }

  function move(qi: number, dir: -1 | 1) {
    const j = qi + dir;
    if (j < 0 || j >= questions.length) return;
    setQuestions((qs) => {
      const next = qs.slice();
      [next[qi], next[j]] = [next[j], next[qi]];
      return next;
    });
    setSaved(false);
  }

  function removeQuestion(qi: number) {
    setQuestions((qs) => qs.filter((_, idx) => idx !== qi));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    setTopError(null);
    try {
      await api.updateQuiz(quizId, { title, description, questions });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiClientError && e.body.fields) {
        setErrors(e.body.fields);
        setTopError('Please fix the highlighted fields.');
      } else {
        setTopError('Could not save. Check your connection and try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  function fieldError(prefix: string): string | undefined {
    return errors.find((e) => e.field === prefix || e.field.startsWith(prefix + '.'))?.message;
  }

  if (loading) {
    return (
      <div className="screen center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="screen host-screen">
      <div className="row spread" style={{ marginBottom: 16 }}>
        <button className="btn ghost" onClick={() => navigate('/host')}>
          ← Back
        </button>
        <div className="row">
          {saved && <span className="pill">Saved ✓</span>}
          <button className="btn" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {topError && <div className="error-box" style={{ marginBottom: 16 }}>{topError}</div>}

      <div className="card stack" style={{ marginBottom: 20 }}>
        <input
          placeholder="Quiz title"
          value={title}
          maxLength={100}
          onChange={(e) => {
            setTitle(e.target.value);
            setSaved(false);
          }}
          style={{ fontSize: '1.3rem', fontWeight: 700 }}
        />
        {fieldError('title') && <div className="error-box">{fieldError('title')}</div>}
        <textarea
          placeholder="Description (optional)"
          value={description}
          maxLength={500}
          rows={2}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
        />
      </div>

      {questions.map((q, qi) => (
        <div className="q-card" key={qi}>
          <div className="row spread" style={{ marginBottom: 10 }}>
            <span className="pill">
              {qi + 1}. {q.type === 'true_false' ? 'True / False' : 'Multiple choice'}
            </span>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn ghost" onClick={() => move(qi, -1)} aria-label="Move up" disabled={qi === 0}>
                ↑
              </button>
              <button
                className="btn ghost"
                onClick={() => move(qi, 1)}
                aria-label="Move down"
                disabled={qi === questions.length - 1}
              >
                ↓
              </button>
              <button className="btn ghost" onClick={() => removeQuestion(qi)} aria-label="Delete question">
                🗑
              </button>
            </div>
          </div>

          <textarea
            placeholder="Question text"
            value={q.text}
            maxLength={300}
            rows={2}
            onChange={(e) => patchQuestion(qi, { text: e.target.value })}
          />
          {fieldError(`questions[${qi}].text`) && (
            <div className="error-box" style={{ marginTop: 6 }}>
              {fieldError(`questions[${qi}].text`)}
            </div>
          )}

          <div className="stack" style={{ marginTop: 12 }}>
            {q.options.map((o, oi) => {
              const st = answerStyle(oi);
              return (
                <div className="option-row" key={oi}>
                  <span
                    style={{
                      background: st.color,
                      borderRadius: 8,
                      padding: 8,
                      display: 'inline-flex',
                    }}
                    title={st.label}
                  >
                    <ShapeIcon shape={st.shape} size={20} />
                  </span>
                  <input
                    type="text"
                    placeholder={`Option ${oi + 1}`}
                    value={o.text}
                    maxLength={100}
                    disabled={q.type === 'true_false'}
                    onChange={(e) => setOptionText(qi, oi, e.target.value)}
                  />
                  <label className="correct-toggle">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={o.isCorrect}
                      onChange={() => setCorrect(qi, oi)}
                      style={{ width: 'auto' }}
                    />
                    Correct
                  </label>
                  {q.type === 'multiple_choice' && q.options.length > 2 && (
                    <button className="btn ghost" onClick={() => removeOption(qi, oi)} aria-label="Remove option">
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
            {fieldError(`questions[${qi}].options`) && (
              <div className="error-box">{fieldError(`questions[${qi}].options`)}</div>
            )}
            {q.type === 'multiple_choice' && q.options.length < 4 && (
              <button className="btn ghost" onClick={() => addOption(qi)} style={{ alignSelf: 'flex-start' }}>
                + Add option
              </button>
            )}
          </div>

          <div className="row" style={{ marginTop: 14, gap: 16 }}>
            <label className="row" style={{ gap: 8 }}>
              <span className="muted">Timer</span>
              <select
                value={q.timeLimitS}
                onChange={(e) => patchQuestion(qi, { timeLimitS: Number(e.target.value) })}
                style={{ width: 'auto' }}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}s
                  </option>
                ))}
              </select>
            </label>
            <label className="row" style={{ gap: 8 }}>
              <span className="muted">Points</span>
              <select
                value={q.points}
                onChange={(e) => patchQuestion(qi, { points: Number(e.target.value) })}
                style={{ width: 'auto' }}
              >
                {[500, 1000, 2000].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ))}

      <div className="row" style={{ gap: 10, marginTop: 8 }}>
        <button className="btn secondary" onClick={() => addQuestion('multiple_choice')} disabled={questions.length >= MAX_QUESTIONS}>
          + Multiple choice
        </button>
        <button className="btn secondary" onClick={() => addQuestion('true_false')} disabled={questions.length >= MAX_QUESTIONS}>
          + True / False
        </button>
      </div>

      <div className="footer-hint">
        Keep questions inclusive and work-appropriate; your name is attached to this quiz.
      </div>
    </div>
  );
}
