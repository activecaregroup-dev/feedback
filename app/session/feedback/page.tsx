'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronUp, Angry, Frown, Smile, Laugh } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Question {
  QUESTION_ID: number;
  QUESTION_TEXT: string;
  QUESTION_TYPE: string;
  QUESTION_ORDER: number;
}

interface Action {
  text: string;
  assignedTo: string;
  dueDate: string;
}

const FACE_OPTIONS: { score: number; Icon: LucideIcon }[] = [
  { score: 1, Icon: Angry },
  { score: 2, Icon: Frown },
  { score: 3, Icon: Smile },
  { score: 4, Icon: Laugh },
];

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

// TODO: Steve to confirm wording
const CONSENT_TEXT =
  'I confirm that I have given my consent for Active Care Group to contact me about the options I have selected above. I understand I can withdraw my consent at any time by emailing privacy@activecaregroup.co.uk.';

function FeedbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId')!;
  const stageId = searchParams.get('stageId')!;
  const patientName = searchParams.get('patientName') ?? 'Patient';
  const stageName = searchParams.get('stageName') ?? '';
  const checklistParam = searchParams.get('checklist') ?? '{}';
  const promptNotesParam = searchParams.get('promptNotes') ?? '{}';

  const [questions, setQuestions] = useState<Question[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<number, string>>({});
  const [notesOpen, setNotesOpen] = useState<Record<number, boolean>>({});
  const [attendees, setAttendees] = useState('');
  const [comments, setComments] = useState('');
  const [actions, setActions] = useState<Action[]>([]);
  const [consentChecked, setConsentChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [myName, setMyName] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/questions?stageId=${stageId}`).then((r) => r.json()),
      fetch('/api/me').then((r) => r.ok ? r.json() : null),
    ]).then(([q, me]) => {
      setQuestions(q);
      if (me?.name) setMyName(me.name);
      setLoading(false);
    });
  }, [stageId]);

  function setScore(questionId: number, score: number) {
    setScores((prev) => ({ ...prev, [questionId]: score }));
  }

  function toggleNote(questionId: number) {
    setNotesOpen((prev) => ({ ...prev, [questionId]: !prev[questionId] }));
  }

  function setQuestionNote(questionId: number, note: string) {
    setQuestionNotes((prev) => ({ ...prev, [questionId]: note }));
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

  const booleanQuestions = questions.filter((q) => q.QUESTION_TYPE === 'BOOLEAN');
  const anyBooleanYes = booleanQuestions.some((q) => scores[q.QUESTION_ID] === 1);
  const showConsentBlock = booleanQuestions.length > 0 && anyBooleanYes;
  const consentBlocked = showConsentBlock && !consentChecked;

  async function submit() {
    // Use === undefined so score 0 (BOOLEAN "No") is counted as answered
    const unanswered = questions.filter((q) => scores[q.QUESTION_ID] === undefined);
    if (unanswered.length > 0) {
      alert('Please answer all questions before submitting.');
      return;
    }

    if (consentBlocked) {
      alert('Tick the consent box above to continue.');
      return;
    }

    setSubmitting(true);

    const checklistObj: Record<string, boolean> = JSON.parse(decodeURIComponent(checklistParam));
    const checklistResponses = Object.entries(checklistObj).map(([itemId, isChecked]) => ({
      itemId: Number(itemId),
      checked: isChecked,
    }));

    const promptNotesObj: Record<string, string> = JSON.parse(decodeURIComponent(promptNotesParam));
    const promptNotesList = Object.entries(promptNotesObj)
      .filter(([, note]) => note.trim())
      .map(([promptId, note]) => ({ promptId: Number(promptId), note: note.trim() }));

    const questionResponses = questions.map((q) => ({
      questionId: q.QUESTION_ID,
      score: scores[q.QUESTION_ID],
      note: q.QUESTION_TYPE === 'LIKERT' ? (questionNotes[q.QUESTION_ID]?.trim() || null) : null,
    }));

    // Build consent payload: only sent when at least one BOOLEAN opt-in is Yes
    const consent = anyBooleanYes
      ? {
          caseStudyOptIn: scores[booleanQuestions[0]?.QUESTION_ID] === 1,
          googleReviewOptIn: scores[booleanQuestions[1]?.QUESTION_ID] === 1,
          // TODO: Steve to confirm wording - this verbatim text is stored in CONSENTS for GDPR audit
          consentText: CONSENT_TEXT,
        }
      : undefined;

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
        promptNotes: promptNotesList,
        comments,
        actions: actions.filter((a) => a.text.trim()),
        consent,
      }),
    });

    if (res.ok) {
      router.push(`/session/confirmation?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}&stageName=${encodeURIComponent(stageName)}`);
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
            className="mb-5 flex w-fit items-center gap-2 rounded-xl px-4 py-3 text-base font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: '#141419', border: '1px solid #1e1e2a', color: '#fff' }}
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <p className="text-sm" style={{ color: SECONDARY }}>Feedback capture</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>{patientName}</h1>
        </div>

        {/* Questions */}
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
            Questions
          </h2>
          {questions.map((q) => {
            if (q.QUESTION_TYPE === 'BOOLEAN') {
              // Yes / No tap buttons for marketing opt-in questions
              return (
                <div
                  key={q.QUESTION_ID}
                  className="space-y-3 rounded-xl p-5"
                  style={{ backgroundColor: CARD_BG, border: BORDER }}
                >
                  <p className="text-base font-medium leading-snug" style={{ color: '#fff' }}>
                    {q.QUESTION_TEXT}
                  </p>
                  <div className="flex gap-4">
                    {([{ label: 'Yes', value: 1 }, { label: 'No', value: 0 }] as const).map(({ label, value }) => {
                      const selected = scores[q.QUESTION_ID] === value;
                      return (
                        <button
                          key={value}
                          onClick={() => setScore(q.QUESTION_ID, value)}
                          className="flex flex-1 items-center justify-center rounded-xl text-base font-semibold transition-all"
                          style={{
                            backgroundColor: selected ? ACCENT : 'transparent',
                            border: selected ? `1px solid ${ACCENT}` : `1px solid #1e1e2a`,
                            color: selected ? '#fff' : SECONDARY,
                            minHeight: 64,
                            boxShadow: selected ? `0 0 12px rgba(255,107,43,0.45)` : 'none',
                            transform: selected ? 'scale(1.03)' : 'scale(1)',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            // LIKERT face-icon questions - unchanged
            const isOpen = notesOpen[q.QUESTION_ID] ?? false;
            const hasNote = !!questionNotes[q.QUESTION_ID]?.trim();
            return (
              <div
                key={q.QUESTION_ID}
                className="space-y-3 rounded-xl p-5"
                style={{ backgroundColor: CARD_BG, border: BORDER }}
              >
                <p className="text-base font-medium leading-snug" style={{ color: '#fff' }}>{q.QUESTION_TEXT}</p>
                <div className="flex gap-3">
                  {FACE_OPTIONS.map(({ score, Icon }) => {
                    const selected = scores[q.QUESTION_ID] === score;
                    return (
                      <button
                        key={score}
                        onClick={() => setScore(q.QUESTION_ID, score)}
                        className="flex flex-1 items-center justify-center rounded-xl transition-all"
                        style={{
                          backgroundColor: selected ? ACCENT : 'transparent',
                          border: selected ? `1px solid ${ACCENT}` : `1px solid #1e1e2a`,
                          color: selected ? '#fff' : ACCENT,
                          minHeight: 88,
                          minWidth: 64,
                          boxShadow: selected ? `0 0 12px rgba(255,107,43,0.45)` : 'none',
                          transform: selected ? 'scale(1.06)' : 'scale(1)',
                        }}
                      >
                        <Icon size={44} />
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => toggleNote(q.QUESTION_ID)}
                  className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-80"
                  style={{ color: hasNote ? ACCENT : SECONDARY }}
                >
                  {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {hasNote ? 'Note added' : 'Add a note'}
                </button>
                {isOpen && (
                  <textarea
                    value={questionNotes[q.QUESTION_ID] ?? ''}
                    onChange={(e) => setQuestionNote(q.QUESTION_ID, e.target.value)}
                    rows={3}
                    placeholder="Add any context or detail about this response..."
                    className="w-full px-4 py-3 text-sm outline-none resize-none rounded-lg"
                    style={{ ...INPUT_STYLE, borderRadius: '0.5rem', caretColor: ACCENT }}
                  />
                )}
              </div>
            );
          })}
        </section>

        {/* Marketing consent block - shown only when at least one BOOLEAN is Yes */}
        {showConsentBlock && (
          <section
            className="space-y-4 rounded-xl p-5"
            style={{ backgroundColor: CARD_BG, border: `1px solid rgba(255,107,43,0.35)` }}
          >
            <h2 className="text-sm font-semibold" style={{ color: '#fff' }}>Marketing consent</h2>
            {/* TODO: Steve to confirm wording */}
            <p className="text-sm leading-relaxed" style={{ color: SECONDARY }}>
              Before submitting, please confirm your consent below. The patient should read and tick this box themselves.
            </p>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-orange-500"
                style={{ accentColor: ACCENT }}
              />
              {/* TODO: Steve to confirm wording */}
              <span className="text-sm leading-relaxed" style={{ color: '#fff' }}>
                {CONSENT_TEXT}
              </span>
            </label>
          </section>
        )}

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
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={action.assignedTo}
                    onChange={(e) => updateAction(i, 'assignedTo', e.target.value)}
                    placeholder="Assigned to"
                    className="w-full rounded-lg px-4 py-3 text-base outline-none"
                    style={{ ...INPUT_STYLE, borderRadius: '0.5rem', paddingRight: '3.5rem' }}
                  />
                  {myName && (
                    <button
                      type="button"
                      onClick={() => updateAction(i, 'assignedTo', myName)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded text-xs font-semibold transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: action.assignedTo === myName ? ACCENT : '#1e1e2a',
                        color: action.assignedTo === myName ? '#fff' : SECONDARY,
                        padding: '3px 7px',
                      }}
                    >
                      Me
                    </button>
                  )}
                </div>
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

        {consentBlocked && (
          <p className="text-center text-sm" style={{ color: ACCENT }}>
            Tick the consent box above to continue.
          </p>
        )}

        <button
          onClick={submit}
          disabled={submitting || consentBlocked}
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
