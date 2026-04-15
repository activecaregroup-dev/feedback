'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { STAGE_CONFIG } from '@/lib/stage-config';
import { ArrowLeft, CheckCircle, Lock, ChevronDown, ChevronUp, CheckSquare, Square, MessageSquare } from 'lucide-react';

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';

interface ScoreRow {
  SESSION_ID: number;
  QUESTION_TEXT: string;
  SCORE: number;
  QUESTION_ORDER: number;
  NOTE: string | null;
}

interface ActionRow {
  SESSION_ID: number;
  ACTION_TEXT: string;
  STATUS: string;
  COMPLETED_AT: string | null;
}

interface PromptNoteRow {
  SESSION_ID: number;
  PROMPT_ID: number;
  NOTE_TEXT: string;
  THEME: string | null;
  PROMPT_TEXT: string;
}

interface Stage {
  STAGE_ID: number;
  STAGE_NAME: string;
  STAGE_ORDER: number;
  status: 'complete' | 'due' | 'locked';
  SESSION_ID: number | null;
  COMPLETED_AT: string | null;
  AVG_SCORE: number | null;
  WHO_PRESENT: string | null;
  scores: ScoreRow[];
  comments: string[];
  actions: ActionRow[];
  promptNotes: PromptNoteRow[];
}

interface Patient {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  DATE_OF_BIRTH: string;
  ADMISSION_DATE: string | null;
  PLANNED_DISCHARGE_DATE: string | null;
}

interface JourneyData {
  patient: Patient;
  stages: Stage[];
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="h-1.5 w-5 rounded-full"
            style={{ backgroundColor: n <= score ? ACCENT : '#2a2a3a' }}
          />
        ))}
      </div>
      <span className="text-xs" style={{ color: SECONDARY }}>{score}/5</span>
    </div>
  );
}

export default function PatientJourneyPage() {
  const router = useRouter();
  const { patientId } = useParams<{ patientId: string }>();
  const [data, setData] = useState<JourneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch(`/api/patients/${patientId}/journey`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [patientId]);

  function toggleExpand(stageId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(stageId) ? next.delete(stageId) : next.add(stageId);
      return next;
    });
  }

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

  const { patient, stages } = data;

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: '#0a0a0f' }}>

      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4"
        style={{ backgroundColor: CARD_BG, borderBottom: BORDER }}
      >
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-xl p-3.5 transition-opacity hover:opacity-70"
          style={{ backgroundColor: '#1e1e2a', color: '#fff' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-lg font-semibold leading-tight" style={{ color: '#fff' }}>{patient.PATIENT_NAME}</h1>
          <p className="text-xs" style={{ color: SECONDARY }}>
            DOB: {fmt(patient.DATE_OF_BIRTH)}
            {patient.ADMISSION_DATE ? `  |  Admitted: ${fmt(patient.ADMISSION_DATE)}` : ''}
            {patient.PLANNED_DISCHARGE_DATE ? `  |  Planned discharge: ${fmt(patient.PLANNED_DISCHARGE_DATE)}` : ''}
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="mx-auto max-w-xl px-5 pt-8">
        <div className="relative">

          {/* Dashed vertical line */}
          <div
            className="absolute left-6 top-6"
            style={{
              width: 2,
              height: 'calc(100% - 24px)',
              backgroundImage: 'repeating-linear-gradient(to bottom, #2a2a3a 0px, #2a2a3a 6px, transparent 6px, transparent 12px)',
            }}
          />

          <div className="space-y-4">
            {stages.map((stage) => {
              const cfg = STAGE_CONFIG[stage.STAGE_ORDER];
              const StageIcon = cfg?.icon;
              const isExpanded = expanded.has(stage.STAGE_ID);
              const hasDetail = stage.scores.length > 0 || stage.comments.length > 0 || stage.actions.length > 0 || stage.promptNotes.length > 0;

              return (
                <div key={stage.STAGE_ID} className="relative flex gap-4">

                  {/* Node circle */}
                  <div className="relative z-10 shrink-0">
                    {stage.status === 'complete' && (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: 'rgba(255,107,43,0.15)', border: `2px solid ${ACCENT}` }}
                      >
                        <CheckCircle size={20} style={{ color: ACCENT }} />
                      </div>
                    )}
                    {stage.status === 'due' && (
                      <div
                        className="flex h-12 w-12 animate-pulse items-center justify-center rounded-full"
                        style={{ backgroundColor: ACCENT, boxShadow: `0 0 12px rgba(255,107,43,0.5)` }}
                      >
                        {StageIcon && <StageIcon size={20} style={{ color: '#fff' }} />}
                      </div>
                    )}
                    {stage.status === 'locked' && (
                      <div
                        className="flex h-12 w-12 items-center justify-center rounded-full"
                        style={{ backgroundColor: '#1e1e2a', border: BORDER }}
                      >
                        <Lock size={16} style={{ color: SECONDARY }} />
                      </div>
                    )}
                  </div>

                  {/* Stage content */}
                  <div className="flex-1 pb-2">
                    <div
                      className="rounded-xl"
                      style={{
                        backgroundColor: stage.status === 'due' ? 'rgba(255,107,43,0.06)' : CARD_BG,
                        border: stage.status === 'due' ? '1px solid rgba(255,107,43,0.3)' : BORDER,
                        opacity: stage.status === 'locked' ? 0.5 : 1,
                      }}
                    >
                      {/* Stage header row */}
                      <div
                        className="flex w-full items-center justify-between gap-3 p-4 text-left"
                        onClick={() => stage.status === 'complete' && hasDetail && toggleExpand(stage.STAGE_ID)}
                        style={{ cursor: stage.status === 'complete' && hasDetail ? 'pointer' : 'default' }}
                      >
                        <div className="flex-1">
                          <p className="font-semibold" style={{ color: stage.status === 'locked' ? SECONDARY : '#fff' }}>
                            {stage.STAGE_NAME}
                          </p>
                          {stage.status === 'complete' && (
                            <div className="mt-1 flex flex-wrap items-center gap-3">
                              <p className="text-xs" style={{ color: SECONDARY }}>
                                {fmt(stage.COMPLETED_AT!)}
                              </p>
                              {stage.AVG_SCORE !== null && (
                                <p className="text-xs font-medium" style={{ color: '#38bdf8' }}>
                                  Avg {Number(stage.AVG_SCORE).toFixed(1)} / 5
                                </p>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/session/${stage.SESSION_ID}?patientId=${patientId}`);
                                }}
                                className="text-xs font-medium transition-opacity hover:opacity-70"
                                style={{ color: ACCENT }}
                              >
                                View
                              </button>
                            </div>
                          )}
                          {stage.status === 'due' && (
                            <>
                              <p className="mt-0.5 text-xs font-medium" style={{ color: ACCENT }}>Due next</p>
                              <button
                                onClick={() => router.push(
                                  `/session/guidance?patientId=${patientId}&stageId=${stage.STAGE_ID}&patientName=${encodeURIComponent(patient.PATIENT_NAME)}&stageName=${encodeURIComponent(stage.STAGE_NAME)}`
                                )}
                                className="mt-3 w-full rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                                style={{ backgroundColor: ACCENT, color: '#fff' }}
                              >
                                Start conversation
                              </button>
                            </>
                          )}
                          {stage.status === 'locked' && (
                            <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>Not yet started</p>
                          )}
                        </div>
                        {stage.status === 'complete' && hasDetail && (
                          isExpanded
                            ? <ChevronUp size={16} style={{ color: SECONDARY, flexShrink: 0 }} />
                            : <ChevronDown size={16} style={{ color: SECONDARY, flexShrink: 0 }} />
                        )}
                      </div>

                      {/* Expanded detail */}
                      {stage.status === 'complete' && isExpanded && (
                        <div
                          className="space-y-4 px-4 pb-4"
                          style={{ borderTop: BORDER }}
                        >
                          {/* Question scores */}
                          {stage.scores.length > 0 && (
                            <div className="pt-3 space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>Scores</p>
                              {stage.scores.map((s, i) => (
                                <div key={i} className="space-y-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-sm flex-1 leading-snug" style={{ color: '#fff' }}>{s.QUESTION_TEXT}</p>
                                    <ScoreBar score={s.SCORE} />
                                  </div>
                                  {s.NOTE && (
                                    <p className="text-xs leading-snug pl-1" style={{ color: SECONDARY }}>
                                      {s.NOTE}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Conversation notes */}
                          {stage.promptNotes.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>Conversation notes</p>
                              {stage.promptNotes.map((pn, i) => (
                                <div key={i} className="rounded-lg px-3 py-2 space-y-0.5" style={{ backgroundColor: '#1e1e2a' }}>
                                  {pn.THEME && (
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>{pn.THEME}</p>
                                  )}
                                  <p className="text-xs leading-snug" style={{ color: SECONDARY }}>{pn.PROMPT_TEXT}</p>
                                  <p className="text-sm leading-snug" style={{ color: '#fff' }}>{pn.NOTE_TEXT}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Comments */}
                          {stage.comments.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>Comments</p>
                              {stage.comments.map((c, i) => (
                                <div key={i} className="flex gap-2">
                                  <MessageSquare size={13} style={{ color: SECONDARY, flexShrink: 0, marginTop: 3 }} />
                                  <p className="text-sm leading-snug" style={{ color: '#fff' }}>{c}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          {stage.actions.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>Actions</p>
                              {stage.actions.map((a, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  {a.STATUS === 'COMPLETE'
                                    ? <CheckSquare size={13} style={{ color: ACCENT, flexShrink: 0, marginTop: 3 }} />
                                    : <Square size={13} style={{ color: SECONDARY, flexShrink: 0, marginTop: 3 }} />
                                  }
                                  <p
                                    className="text-sm leading-snug"
                                    style={{ color: a.STATUS === 'COMPLETE' ? SECONDARY : '#fff', textDecoration: a.STATUS === 'COMPLETE' ? 'line-through' : 'none' }}
                                  >
                                    {a.ACTION_TEXT}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}
