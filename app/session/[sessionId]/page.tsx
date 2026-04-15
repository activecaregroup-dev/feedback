'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckSquare, Square } from 'lucide-react';
import { Suspense } from 'react';

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent',
};

interface SessionData {
  meta: {
    SESSION_ID: number;
    PATIENT_ID: number;
    PATIENT_NAME: string;
    STAGE_NAME: string;
    STARTED_AT: string;
    WHO_PRESENT: string | null;
  };
  scores: { QUESTION_TEXT: string; SCORE: number; NOTE: string | null; QUESTION_ORDER: number }[];
  promptNotes: { THEME: string | null; PROMPT_TEXT: string; NOTE_TEXT: string }[];
  comments: { COMMENT_TEXT: string }[];
  actions: { ACTION_TEXT: string; ASSIGNED_TO: string | null; STATUS: string }[];
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-1.5 w-5 rounded-full" style={{ backgroundColor: n <= score ? ACCENT : '#2a2a3a' }} />
        ))}
      </div>
      <span className="text-xs" style={{ color: SECONDARY }}>{score}/5</span>
    </div>
  );
}

function SessionViewContent() {
  const router = useRouter();
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');

  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${sessionId}`)
      .then((r) => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: SECONDARY }}>Loading...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: ACCENT }}>{error ?? 'Not found'}</p>
      </div>
    );
  }

  const { meta, scores, promptNotes, comments, actions } = data;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0f' }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ backgroundColor: CARD_BG, borderBottom: BORDER }}
      >
        <button
          onClick={() => router.push(patientId ? `/patient/${patientId}` : '/dashboard')}
          className="rounded-xl p-3.5 transition-opacity hover:opacity-70"
          style={{ backgroundColor: '#1e1e2a', color: '#fff' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <p className="text-xs" style={{ color: SECONDARY }}>{meta.STAGE_NAME}</p>
          <h1 className="text-lg font-semibold leading-tight" style={{ color: '#fff' }}>{meta.PATIENT_NAME}</h1>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs" style={{ color: SECONDARY }}>{fmt(meta.STARTED_AT)}</p>
          {meta.WHO_PRESENT && (
            <p className="text-xs mt-0.5" style={{ color: SECONDARY }}>{meta.WHO_PRESENT}</p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl space-y-8 px-4 py-8 pb-16">

        {/* Conversation notes */}
        {promptNotes.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Conversation notes
            </h2>
            <div className="space-y-2">
              {promptNotes.map((pn, i) => (
                <div key={i} className="rounded-xl px-4 py-3 space-y-0.5" style={{ backgroundColor: CARD_BG, border: BORDER }}>
                  {pn.THEME && (
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>{pn.THEME}</p>
                  )}
                  <p className="text-xs" style={{ color: SECONDARY }}>{pn.PROMPT_TEXT}</p>
                  <p className="text-sm pt-1" style={{ color: '#fff' }}>{pn.NOTE_TEXT}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Question scores */}
        {scores.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Questions
            </h2>
            <div className="space-y-3">
              {scores.map((s, i) => (
                <div key={i} className="rounded-xl p-4 space-y-2" style={{ backgroundColor: CARD_BG, border: BORDER }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium flex-1 leading-snug" style={{ color: '#fff' }}>{s.QUESTION_TEXT}</p>
                    <div className="shrink-0 text-right">
                      <ScoreBar score={s.SCORE} />
                      <p className="text-xs mt-0.5" style={{ color: SECONDARY }}>{SCORE_LABELS[s.SCORE]}</p>
                    </div>
                  </div>
                  {s.NOTE && (
                    <p className="text-xs leading-snug pt-1" style={{ color: SECONDARY, borderTop: BORDER }}>
                      {s.NOTE}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Comments */}
        {comments.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Comments
            </h2>
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: CARD_BG, border: BORDER }}>
              {comments.map((c, i) => (
                <p key={i} className="text-sm leading-relaxed" style={{ color: '#fff' }}>{c.COMMENT_TEXT}</p>
              ))}
            </div>
          </section>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Action points
            </h2>
            <div className="space-y-2">
              {actions.map((a, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl p-4" style={{ backgroundColor: CARD_BG, border: BORDER }}>
                  {a.STATUS === 'COMPLETE'
                    ? <CheckSquare size={16} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                    : <Square size={16} style={{ color: SECONDARY, flexShrink: 0, marginTop: 2 }} />
                  }
                  <div className="flex-1">
                    <p
                      className="text-sm leading-snug"
                      style={{
                        color: a.STATUS === 'COMPLETE' ? SECONDARY : '#fff',
                        textDecoration: a.STATUS === 'COMPLETE' ? 'line-through' : 'none',
                      }}
                    >
                      {a.ACTION_TEXT}
                    </p>
                    {a.ASSIGNED_TO && (
                      <p className="text-xs mt-0.5" style={{ color: SECONDARY }}>Assigned to {a.ASSIGNED_TO}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

export default function SessionViewPage() {
  return (
    <Suspense>
      <SessionViewContent />
    </Suspense>
  );
}
