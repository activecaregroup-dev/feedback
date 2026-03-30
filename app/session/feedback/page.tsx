'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Question {
  QUESTION_ID: number;
  QUESTION_TEXT: string;
  QUESTION_ORDER: number;
}

interface Action {
  text: string;
  assignedTo: string;
  dueDate: string;
}

const SCORE_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
};

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';
const INPUT_STYLE = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: BORDER,
  color: '#fff',
  borderRadius: '0.75rem',
};

function FeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId')!;
  const stageId = searchParams.get('stageId')!;
  const patientName = searchParams.get('patientName') ?? 'Patient';
  const checklistParam = searchParams.get('checklist') ?? '{}';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [attendees, setAttendees] = useState('');
  const [comments, setComments] = useState('');
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/questions?stageId=${stageId}`)
      .then((r) => r.json())
      .then((q) => {
        setQuestions(q);
        setLoading(false);
      });
  }, [stageId]);

  function setScore(questionId: number, score: number) {
    setScores((prev) => ({ ...prev, [questionId]: score }));
  }

  function addAction() {
    setActions((prev) => [...prev, { text: '', assignedTo: '', dueDate: '' }]);
  }

  function updateAction(index: number, field: keyof Action, value: string) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }

  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit() {
    const unanswered = questions.filter((q) => !scores[q.QUESTION_ID]);
    if (unanswered.length > 0) {
      alert('Please score all questions before submitting.');
      return;
    }

    setSubmitting(true);

    const checklistObj: Record<string, boolean> = JSON.parse(decodeURIComponent(checklistParam));
    const checklistResponses = Object.entries(checklistObj).map(([itemId, isChecked]) => ({
      itemId: Number(itemId),
      checked: isChecked,
    }));

    const questionResponses = questions.map((q) => ({
      questionId: q.QUESTION_ID,
      score: scores[q.QUESTION_ID],
    }));

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId: Number(patientId),
        patientName,
        stageId: Number(stageId),
        whoPresent: attendees,
        checklistResponses,
        questionResponses,
        comments,
        actions: actions.filter((a) => a.text.trim()),
      }),
    });

    if (res.ok) {
      router.push('/dashboard?submitted=1');
    } else {
      alert('Submission failed. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: SECONDARY }}>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: '#0a0a0f' }}>
      <div className="mx-auto max-w-2xl space-y-8 pb-16">

        <div>
          <button
            onClick={() => router.push(`/session/guidance?patientId=${patientId}&stageId=${stageId}&patientName=${encodeURIComponent(patientName)}`)}
            className="mb-5 flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: '#141419', border: '1px solid #1e1e2a', color: '#fff' }}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <p className="text-sm" style={{ color: SECONDARY }}>Feedback capture</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>{patientName}</h1>
        </div>

        {/* Scored questions */}
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
            Questions
          </h2>
          {questions.map((q) => (
            <div
              key={q.QUESTION_ID}
              className="space-y-3 rounded-xl p-5"
              style={{ backgroundColor: CARD_BG, border: BORDER }}
            >
              <p className="text-base font-medium leading-snug" style={{ color: '#fff' }}>{q.QUESTION_TEXT}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((score) => {
                  const selected = scores[q.QUESTION_ID] === score;
                  return (
                    <button
                      key={score}
                      onClick={() => setScore(q.QUESTION_ID, score)}
                      className="flex flex-1 flex-col items-center gap-1 rounded-lg py-3 transition-colors"
                      style={{
                        backgroundColor: selected ? ACCENT : 'rgba(255,255,255,0.04)',
                        border: selected ? `1px solid ${ACCENT}` : BORDER,
                        color: selected ? '#fff' : SECONDARY,
                      }}
                    >
                      <span className="text-xl font-semibold">{score}</span>
                      <span className="text-xs leading-tight">{SCORE_LABELS[score]}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        {/* Who was present */}
        <section className="space-y-2">
          <label
            className="text-xs font-semibold uppercase tracking-widest"
            htmlFor="attendees"
            style={{ color: SECONDARY }}
          >
            Who was present
          </label>
          <input
            id="attendees"
            type="text"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            placeholder="e.g. Patient, family member, nurse"
            className="w-full px-4 py-4 text-base outline-none"
            style={{ ...INPUT_STYLE, caretColor: ACCENT }}
          />
        </section>

        {/* Comments */}
        <section className="space-y-2">
          <label
            className="text-xs font-semibold uppercase tracking-widest"
            htmlFor="comments"
            style={{ color: SECONDARY }}
          >
            Comments
          </label>
          <textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={4}
            placeholder="Any additional notes..."
            className="w-full px-4 py-4 text-base outline-none resize-none"
            style={{ ...INPUT_STYLE, caretColor: ACCENT }}
          />
        </section>

        {/* Action points */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
            Action points
          </h2>
          {actions.map((action, i) => (
            <div
              key={i}
              className="space-y-2 rounded-xl p-4"
              style={{ backgroundColor: CARD_BG, border: BORDER }}
            >
              <input
                type="text"
                value={action.text}
                onChange={(e) => updateAction(i, 'text', e.target.value)}
                placeholder="Action description"
                className="w-full rounded-lg px-4 py-3 text-base outline-none"
                style={{ ...INPUT_STYLE, borderRadius: '0.5rem' }}
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={action.assignedTo}
                  onChange={(e) => updateAction(i, 'assignedTo', e.target.value)}
                  placeholder="Assigned to"
                  className="flex-1 rounded-lg px-4 py-3 text-base outline-none"
                  style={{ ...INPUT_STYLE, borderRadius: '0.5rem' }}
                />
                <input
                  type="date"
                  value={action.dueDate}
                  onChange={(e) => updateAction(i, 'dueDate', e.target.value)}
                  className="flex-1 rounded-lg px-4 py-3 text-base outline-none"
                  style={{ ...INPUT_STYLE, borderRadius: '0.5rem' }}
                />
              </div>
              <button
                onClick={() => removeAction(i)}
                className="text-sm transition-opacity hover:opacity-70"
                style={{ color: '#f87171' }}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={addAction}
            className="w-full rounded-xl py-4 text-base font-medium transition-colors hover:brightness-110"
            style={{
              backgroundColor: 'transparent',
              border: '1.5px dashed #3a3a4a',
              color: SECONDARY,
            }}
          >
            + Add action
          </button>
        </section>

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-xl px-5 py-5 text-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: ACCENT }}
        >
          {submitting ? 'Submitting...' : 'Submit feedback'}
        </button>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense>
      <FeedbackContent />
    </Suspense>
  );
}
