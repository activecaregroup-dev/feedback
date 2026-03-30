'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Question {
  QUESTION_ID: number;
  QUESTION_TEXT: string;
  DISPLAY_ORDER: number;
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
    const checklistResponses = Object.entries(checklistObj).map(([itemId, checked]) => ({
      itemId: Number(itemId),
      checked,
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
        stageId: Number(stageId),
        attendees,
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6 pb-16">
      <div>
        <p className="text-sm text-gray-500">Feedback capture</p>
        <h1 className="text-2xl font-semibold">{patientName}</h1>
      </div>

      {/* Scored questions */}
      <section className="space-y-5">
        <h2 className="text-base font-medium uppercase tracking-wide text-gray-500">Questions</h2>
        {questions.map((q) => (
          <div key={q.QUESTION_ID} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-base font-medium leading-snug">{q.QUESTION_TEXT}</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  onClick={() => setScore(q.QUESTION_ID, score)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-lg border py-3 transition-colors ${
                    scores[q.QUESTION_ID] === score
                      ? 'border-blue-500 bg-blue-500 text-white'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span className="text-xl font-semibold">{score}</span>
                  <span className="text-xs leading-tight">{SCORE_LABELS[score]}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Attendees */}
      <section className="space-y-2">
        <label className="text-base font-medium uppercase tracking-wide text-gray-500" htmlFor="attendees">
          Who was present
        </label>
        <input
          id="attendees"
          type="text"
          value={attendees}
          onChange={(e) => setAttendees(e.target.value)}
          placeholder="e.g. Patient, family member, nurse"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-base placeholder-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </section>

      {/* Comments */}
      <section className="space-y-2">
        <label className="text-base font-medium uppercase tracking-wide text-gray-500" htmlFor="comments">
          Comments
        </label>
        <textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={4}
          placeholder="Any additional notes…"
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-4 text-base placeholder-gray-400 focus:border-blue-500 focus:outline-none"
        />
      </section>

      {/* Actions */}
      <section className="space-y-3">
        <h2 className="text-base font-medium uppercase tracking-wide text-gray-500">Action points</h2>
        {actions.map((action, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
            <input
              type="text"
              value={action.text}
              onChange={(e) => updateAction(i, 'text', e.target.value)}
              placeholder="Action description"
              className="w-full rounded-lg border border-gray-200 px-4 py-3 text-base placeholder-gray-400 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={action.assignedTo}
                onChange={(e) => updateAction(i, 'assignedTo', e.target.value)}
                placeholder="Assigned to"
                className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base placeholder-gray-400 focus:border-blue-500 focus:outline-none"
              />
              <input
                type="date"
                value={action.dueDate}
                onChange={(e) => updateAction(i, 'dueDate', e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-3 text-base focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => removeAction(i)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={addAction}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 py-4 text-base font-medium text-gray-500 hover:border-gray-400 hover:text-gray-600"
        >
          + Add action
        </button>
      </section>

      <button
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-xl bg-blue-600 px-5 py-5 text-lg font-medium text-white hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50"
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>
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
