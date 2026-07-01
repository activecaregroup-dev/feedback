'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle, Lock, FileText, Minus,
  Angry, Frown, Smile, Laugh, Square, Plus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { STAGE_CONFIG } from '@/lib/stage-config';

const ACCENT    = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG   = '#141419';
const BORDER    = '1px solid #1e1e2a';

const SCORE_FACES: Record<number, LucideIcon> = {
  1: Angry, 2: Frown, 3: Smile, 4: Laugh,
};

const BADGE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  GENERAL:          { bg: 'rgba(138,138,154,0.18)', color: SECONDARY,  label: 'General' },
  WHAT_WENT_WELL:   { bg: 'rgba(34,197,94,0.15)',   color: '#4ade80',  label: 'Went well' },
  WHAT_TO_IMPROVE:  { bg: 'rgba(255,107,43,0.15)',  color: ACCENT,     label: 'To improve' },
};

interface Patient {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  DATE_OF_BIRTH: string;
  ADMISSION_DATE: string | null;
  PLANNED_DISCHARGE_DATE: string | null;
  NAVIGATOR_NAME: string | null;
  CASE_WORKER_NAME: string | null;
  SITE_NAME: string | null;
  SITE_MANAGER_NAME: string | null;
}

interface Stage {
  STAGE_ID: number;
  STAGE_NAME: string;
  STAGE_ORDER: number;
  status: 'complete' | 'due' | 'locked' | 'skipped' | 'not_captured';
  hasSession: boolean;
  SESSION_ID: number | null;
  COMPLETED_AT: string | null;
  AVG_SCORE: number | null;
  promptNotes: { NOTE_TEXT: string }[];
  actions: { ACTION_TEXT: string }[];
}

interface CommentRow {
  COMMENT_ID: number;
  COMMENT_TEXT: string;
  COMMENT_TYPE: string;
  CREATED_AT: string;
  STAGE_NAME: string;
}

interface ActionRow {
  ACTION_ID: number;
  ACTION_TEXT: string;
  STATUS: string;
  CREATED_AT: string;
  ASSIGNED_TO: string | null;
  STAGE_NAME: string;
}

interface QuickActionRow {
  QUICK_ACTION_ID: number;
  ACTION_TEXT: string;
  STATUS: string;
  CREATED_AT: string;
  CREATED_BY_NAME: string;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ---------------------------------------------------------------------------
// Inline editable field
// ---------------------------------------------------------------------------
function InlineField({
  label,
  value,
  placeholder,
  onSave,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (v: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  async function commit() {
    setEditing(false);
    if (draft === value) return;
    await onSave(draft);
    setSaved(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
        {label}
      </span>
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
          className="rounded-lg px-3 py-2 text-sm outline-none"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            border: `1px solid ${ACCENT}`,
            color: '#fff',
            caretColor: ACCENT,
            minWidth: 160,
          }}
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="rounded-lg px-3 py-2 text-left text-sm transition-colors hover:brightness-125"
          style={{
            backgroundColor: 'rgba(255,255,255,0.04)',
            border: BORDER,
            color: draft ? '#fff' : SECONDARY,
            minWidth: 160,
          }}
        >
          {draft || placeholder}
        </button>
      )}
      {saved && (
        <span className="text-xs" style={{ color: '#4ade80' }}>Saved</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage card (timeline middle column)
// ---------------------------------------------------------------------------
function StageCard({
  stage,
  patientId,
  patientName,
  notCaptured,
  onSkip,
  onNavigate,
}: {
  stage: Stage;
  patientId: string;
  patientName: string;
  notCaptured: boolean;
  onSkip: (stageId: number) => void;
  onNavigate: (url: string) => void;
}) {
  const cfg = STAGE_CONFIG[stage.STAGE_ORDER];
  const StageIcon = cfg?.icon;
  const isDue         = stage.status === 'due';
  const isComplete    = stage.status === 'complete';
  const isLocked      = stage.status === 'locked';
  const isSkipped     = stage.status === 'skipped';
  const isNotCaptured = stage.status === 'not_captured';

  const isMuted = isLocked || isSkipped || isNotCaptured;

  const iconBg    = isComplete ? 'rgba(255,107,43,0.15)' : isDue ? ACCENT : '#1e1e2a';
  const iconColor = isComplete ? ACCENT : isDue ? '#fff' : SECONDARY;

  const cardBg     = isDue ? 'rgba(255,107,43,0.06)' : CARD_BG;
  const cardBorder = isDue ? '1px solid rgba(255,107,43,0.3)' : BORDER;

  const avgFaceIdx = stage.AVG_SCORE != null
    ? Math.max(1, Math.min(4, Math.round(Number(stage.AVG_SCORE))))
    : null;
  const AvgFaceIcon = avgFaceIdx ? SCORE_FACES[avgFaceIdx] : null;

  return (
    <div className="relative flex gap-4">
      {/* Node circle */}
      <div className="relative z-10 shrink-0">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full${isDue ? ' animate-pulse' : ''}`}
          style={{
            backgroundColor: iconBg,
            border: isComplete ? `2px solid ${ACCENT}` : undefined,
            boxShadow: isDue ? `0 0 12px rgba(255,107,43,0.5)` : undefined,
          }}
        >
          {isComplete                    && <CheckCircle size={20} style={{ color: ACCENT }} />}
          {(isLocked || isNotCaptured)   && <Lock size={16} style={{ color: SECONDARY }} />}
          {isSkipped                     && <Minus size={16} style={{ color: SECONDARY }} />}
          {isDue && StageIcon            && <StageIcon size={20} style={{ color: iconColor }} />}
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 pb-2">
        <div
          className="overflow-hidden rounded-xl"
          style={{
            border: cardBorder,
            opacity: isMuted ? 0.5 : 1,
            cursor: notCaptured ? 'pointer' : undefined,
          }}
          onClick={notCaptured ? () => onSkip(stage.STAGE_ID) : undefined}
          role={notCaptured ? 'button' : undefined}
          aria-label={notCaptured ? `Dismiss ${stage.STAGE_NAME} - not captured` : undefined}
        >
          {/* Not-captured red strip */}
          {notCaptured && (
            <div style={{ backgroundColor: '#dc2626', padding: '6px 16px' }}>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}>Not captured</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', display: 'block', marginTop: 1 }}>
                Tap to dismiss
              </span>
            </div>
          )}

          <div className="flex" style={{ backgroundColor: cardBg }}>
            <div className="flex-1 p-4">
              <p className="font-semibold" style={{ color: isMuted ? SECONDARY : '#fff' }}>
                {stage.STAGE_NAME}
              </p>

              {isComplete && (
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <p className="text-xs" style={{ color: SECONDARY }}>{fmt(stage.COMPLETED_AT!)}</p>
                  {AvgFaceIcon && stage.AVG_SCORE != null && (
                    <span className="flex items-center gap-1 text-xs font-medium" style={{ color: ACCENT }}>
                      <AvgFaceIcon size={12} />
                      {Number(stage.AVG_SCORE).toFixed(1)} / 4
                    </span>
                  )}
                </div>
              )}

              {isDue && (
                <>
                  <p className="mt-0.5 text-xs font-medium" style={{ color: ACCENT }}>Due next</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(
                        `/session/guidance?patientId=${patientId}&stageId=${stage.STAGE_ID}&patientName=${encodeURIComponent(patientName)}&stageName=${encodeURIComponent(stage.STAGE_NAME)}`
                      );
                    }}
                    className="mt-3 w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                    style={{ backgroundColor: ACCENT, color: '#fff' }}
                  >
                    Start conversation
                  </button>
                </>
              )}

              {isLocked      && <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>Not yet started</p>}
              {isSkipped     && <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>Skipped</p>}
              {isNotCaptured && <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>Not captured</p>}
            </div>

            {isComplete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(`/session/${stage.SESSION_ID}?patientId=${patientId}`);
                }}
                className="flex shrink-0 flex-col items-center justify-center gap-1.5 px-4 transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(255,107,43,0.45)', color: '#fff', width: 72, borderRadius: '0 10px 10px 0' }}
              >
                <span className="text-xs font-bold">View</span>
                {stage.promptNotes.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <FileText size={11} />
                    Notes
                  </span>
                )}
                {stage.actions.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
                    <CheckCircle size={11} />
                    Actions
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------
function PatientJourneyContent() {
  const router         = useRouter();
  const { patientId }  = useParams<{ patientId: string }>();
  const searchParams   = useSearchParams();
  const notCapturedOverride = searchParams.get('notCaptured') === 'true';

  const [patient,      setPatient]      = useState<Patient | null>(null);
  const [stages,       setStages]       = useState<Stage[]>([]);
  const [comments,     setComments]     = useState<CommentRow[]>([]);
  const [actions,      setActions]      = useState<ActionRow[]>([]);
  const [quickActions, setQuickActions] = useState<QuickActionRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  const [navigatorName,       setNavigatorName]       = useState('');
  const [caseWorkerName,      setCaseWorkerName]       = useState('');
  const [newQA,               setNewQA]               = useState('');
  const [addingQA,            setAddingQA]            = useState(false);
  const [notCapturedStageIds, setNotCapturedStageIds] = useState<Set<number>>(new Set());
  const [skipError,           setSkipError]           = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/patients/${patientId}/journey`).then((r) => { if (!r.ok) throw new Error('Failed to load'); return r.json(); }),
      fetch(`/api/patients/${patientId}/comments`).then((r) => r.json()),
      fetch(`/api/patients/${patientId}/actions`).then((r) => r.json()),
      fetch(`/api/patients/${patientId}/quick-actions`).then((r) => r.json()),
    ])
      .then(([journey, cmts, acts, qas]) => {
        setPatient(journey.patient);
        setStages(journey.stages);
        setNavigatorName(journey.patient.NAVIGATOR_NAME ?? '');
        setCaseWorkerName(journey.patient.CASE_WORKER_NAME ?? '');
        setComments(Array.isArray(cmts) ? cmts : []);
        setActions(Array.isArray(acts) ? acts : []);
        setQuickActions(Array.isArray(qas) ? qas : []);

        // Compute which stages show the not-captured strip.
        // Override mode: all stages with no session (visual review only - skip is a no-op).
        // Normal mode: stages the journey endpoint flagged as 'not_captured' (gap in history).
        const initNotCaptured = new Set<number>(
          (journey.stages as Stage[])
            .filter((s) => notCapturedOverride ? !s.hasSession : s.status === 'not_captured')
            .map((s) => s.STAGE_ID)
        );
        setNotCapturedStageIds(initNotCaptured);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  // notCapturedOverride is stable (derived from URL, won't change mid-session)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  async function saveField(field: 'navigatorName' | 'caseWorkerName', value: string) {
    if (field === 'navigatorName') setNavigatorName(value);
    else setCaseWorkerName(value);

    await fetch(`/api/patients/${patientId}/assignment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field === 'navigatorName' ? 'navigatorName' : 'caseWorkerName']: value }),
    });
  }

  async function completeAction(actionId: number) {
    setActions((prev) => prev.filter((a) => a.ACTION_ID !== actionId));
    await fetch(`/api/actions/${actionId}`, { method: 'PATCH' });
  }

  async function completeQuickAction(id: number) {
    setQuickActions((prev) => prev.filter((qa) => qa.QUICK_ACTION_ID !== id));
    await fetch(`/api/quick-actions/${id}`, { method: 'PATCH' });
  }

  async function addQuickAction() {
    if (!newQA.trim()) return;
    setAddingQA(true);
    const res = await fetch('/api/quick-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: Number(patientId), actionText: newQA.trim() }),
    });
    if (res.ok) {
      const created = await res.json() as QuickActionRow;
      setQuickActions((prev) => [created, ...prev]);
      setNewQA('');
    }
    setAddingQA(false);
  }

  async function handleSkip(stageId: number) {
    // Override mode is visual review only - do not write to the database
    if (notCapturedOverride) return;

    // Optimistic: remove the red strip immediately
    setNotCapturedStageIds((prev) => {
      const next = new Set(prev);
      next.delete(stageId);
      return next;
    });
    setSkipError(null);

    const res = await fetch('/api/sessions/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: Number(patientId), stageId }),
    });

    // 409 = already skipped (duplicate tap) - optimistic state is correct, leave it
    if (!res.ok && res.status !== 409) {
      // Roll back optimistic update
      setNotCapturedStageIds((prev) => new Set([...prev, stageId]));
      setSkipError('Could not dismiss stage - please try again.');
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: SECONDARY }}>Loading...</p>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: ACCENT }}>{error ?? 'Not found'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12" style={{ backgroundColor: '#0a0a0f' }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 px-5 py-4"
        style={{ backgroundColor: CARD_BG, borderBottom: BORDER }}
      >
        <div className="mx-auto max-w-7xl">
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="rounded-xl p-3.5 transition-opacity hover:opacity-70"
              style={{ backgroundColor: '#1e1e2a', color: '#fff' }}
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <h1 className="text-xl font-semibold leading-tight" style={{ color: '#fff' }}>
                {patient.PATIENT_NAME}
              </h1>
              <p className="text-xs" style={{ color: SECONDARY }}>
                DOB: {fmt(patient.DATE_OF_BIRTH)}
                {patient.ADMISSION_DATE ? `  |  Admitted: ${fmt(patient.ADMISSION_DATE)}` : ''}
                {patient.PLANNED_DISCHARGE_DATE ? `  |  Planned discharge: ${fmt(patient.PLANNED_DISCHARGE_DATE)}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <InlineField
              label="Navigator"
              value={navigatorName}
              placeholder="Not assigned"
              onSave={(v) => saveField('navigatorName', v)}
            />
            <InlineField
              label="Case Worker"
              value={caseWorkerName}
              placeholder="Not assigned"
              onSave={(v) => saveField('caseWorkerName', v)}
            />
            {(patient.SITE_NAME || patient.SITE_MANAGER_NAME) && (
              <div className="ml-auto text-right">
                {patient.SITE_NAME && (
                  <p className="text-xs font-semibold" style={{ color: SECONDARY }}>{patient.SITE_NAME}</p>
                )}
                {patient.SITE_MANAGER_NAME && (
                  <p className="text-xs" style={{ color: SECONDARY }}>
                    Site Manager: {patient.SITE_MANAGER_NAME}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3-column body */}
      <div className="mx-auto max-w-7xl px-4 pt-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">

          {/* Left: Comments */}
          <div className="md:col-span-1">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Comments
            </h2>
            {comments.length === 0 ? (
              <p className="text-sm" style={{ color: SECONDARY }}>No comments yet.</p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => {
                  const badge = BADGE_STYLES[c.COMMENT_TYPE] ?? BADGE_STYLES.GENERAL;
                  return (
                    <div
                      key={c.COMMENT_ID}
                      className="rounded-xl p-3 space-y-2"
                      style={{ backgroundColor: CARD_BG, border: BORDER }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-xs font-medium" style={{ color: SECONDARY }}>{c.STAGE_NAME}</p>
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-semibold"
                          style={{ backgroundColor: badge.bg, color: badge.color }}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm leading-snug" style={{ color: '#fff' }}>{c.COMMENT_TEXT}</p>
                      <p className="text-xs" style={{ color: SECONDARY }}>{fmt(c.CREATED_AT)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Middle: Stage timeline */}
          <div className="md:col-span-2">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Journey
            </h2>
            {skipError && (
              <p className="mb-3 rounded-xl px-4 py-2 text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.15)', color: '#f87171' }}>
                {skipError}
              </p>
            )}
            <div className="relative">
              {/* Connector line */}
              <div
                className="absolute left-6 top-6"
                style={{
                  width: 2,
                  height: 'calc(100% - 24px)',
                  backgroundImage: 'repeating-linear-gradient(to bottom, #2a2a3a 0px, #2a2a3a 6px, transparent 6px, transparent 12px)',
                }}
              />
              <div className="space-y-4">
                {stages.map((stage) => (
                  <StageCard
                    key={stage.STAGE_ID}
                    stage={stage}
                    patientId={patientId}
                    patientName={patient.PATIENT_NAME}
                    notCaptured={notCapturedStageIds.has(stage.STAGE_ID)}
                    onSkip={handleSkip}
                    onNavigate={(url) => router.push(url)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right: Actions + Quick Actions */}
          <div className="md:col-span-1 space-y-6">

            {/* Session actions */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
                Actions
              </h2>
              {actions.length === 0 ? (
                <p className="text-sm" style={{ color: SECONDARY }}>No open actions.</p>
              ) : (
                <div className="space-y-2">
                  {actions.map((a) => (
                    <div
                      key={a.ACTION_ID}
                      className="flex items-start gap-3 rounded-xl p-3"
                      style={{ backgroundColor: CARD_BG, border: BORDER }}
                    >
                      <button
                        onClick={() => completeAction(a.ACTION_ID)}
                        className="mt-0.5 shrink-0 transition-opacity hover:opacity-70"
                        style={{ color: SECONDARY }}
                        aria-label="Mark complete"
                      >
                        <Square size={16} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug" style={{ color: '#fff' }}>{a.ACTION_TEXT}</p>
                        <p className="text-xs mt-0.5" style={{ color: SECONDARY }}>{a.STAGE_NAME}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
                Quick Actions
              </h2>

              {/* Add input */}
              <div className="mb-3 flex gap-2">
                <input
                  type="text"
                  value={newQA}
                  onChange={(e) => setNewQA(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') addQuickAction(); }}
                  placeholder="Add a quick action..."
                  className="flex-1 rounded-xl px-3 py-3 text-sm outline-none"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: BORDER,
                    color: '#fff',
                    caretColor: ACCENT,
                  }}
                />
                <button
                  onClick={addQuickAction}
                  disabled={addingQA || !newQA.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ backgroundColor: ACCENT, color: '#fff' }}
                  aria-label="Add quick action"
                >
                  <Plus size={18} />
                </button>
              </div>

              {quickActions.length === 0 ? (
                <p className="text-sm" style={{ color: SECONDARY }}>No open quick actions.</p>
              ) : (
                <div className="space-y-2">
                  {quickActions.map((qa) => (
                    <div
                      key={qa.QUICK_ACTION_ID}
                      className="flex items-start gap-3 rounded-xl p-3"
                      style={{ backgroundColor: CARD_BG, border: BORDER }}
                    >
                      <button
                        onClick={() => completeQuickAction(qa.QUICK_ACTION_ID)}
                        className="mt-0.5 shrink-0 transition-opacity hover:opacity-70"
                        style={{ color: SECONDARY }}
                        aria-label="Mark complete"
                      >
                        <Square size={16} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug" style={{ color: '#fff' }}>{qa.ACTION_TEXT}</p>
                        <p className="text-xs mt-0.5" style={{ color: SECONDARY }}>
                          {qa.CREATED_BY_NAME} - {fmt(qa.CREATED_AT)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function PatientJourneyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: SECONDARY }}>Loading...</p>
      </div>
    }>
      <PatientJourneyContent />
    </Suspense>
  );
}
