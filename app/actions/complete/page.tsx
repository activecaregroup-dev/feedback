'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle, ChevronDown, ChevronUp, Mail, Send, CheckSquare, Square } from 'lucide-react';
import { STAGE_CONFIG } from '@/lib/stage-config';

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';

interface ActionItem {
  ACTION_ID: number;
  PATIENT_ID: number;
  ACTION_TEXT: string;
  ASSIGNED_TO: string | null;
  STATUS: string;
  COMPLETED_AT: string | null;
  CREATED_AT: string;
  STAGE_NAME: string;
  SESSION_ID: number;
}

interface PatientRow {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  ADMISSION_DATE: string | null;
  PLANNED_DISCHARGE_DATE: string | null;
  NEXT_STAGE_NAME: string | null;
  NEXT_STAGE_ORDER: number | null;
  openActions: ActionItem[];
  completedActions: ActionItem[];
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildEmailBody(p: PatientRow): string {
  const lines: string[] = [`Patient: ${p.PATIENT_NAME}`, ''];
  if (p.openActions.length) {
    lines.push('Open actions:');
    for (const a of p.openActions) {
      lines.push(`  - ${a.ACTION_TEXT}${a.ASSIGNED_TO ? ` (${a.ASSIGNED_TO})` : ''} [${a.STAGE_NAME}]`);
    }
    lines.push('');
  }
  if (p.completedActions.length) {
    lines.push('Completed actions:');
    for (const a of p.completedActions) {
      lines.push(`  - ${a.ACTION_TEXT}${a.ASSIGNED_TO ? ` (${a.ASSIGNED_TO})` : ''} [${a.STAGE_NAME}] - completed ${fmt(a.COMPLETED_AT!)}`);
    }
  }
  return lines.join('\n');
}

function PatientCard({ p }: { p: PatientRow }) {
  const router = useRouter();
  const [openActions, setOpenActions] = useState(p.openActions);
  const [completedActions, setCompletedActions] = useState(p.completedActions);
  const [completing, setCompleting] = useState<number | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailTo, setEmailTo] = useState('');

  const stageCfg = p.NEXT_STAGE_ORDER ? STAGE_CONFIG[p.NEXT_STAGE_ORDER] : null;
  const StageIcon = stageCfg?.icon;
  const afterCfg = p.NEXT_STAGE_ORDER ? STAGE_CONFIG[p.NEXT_STAGE_ORDER + 1] : null;
  const AfterIcon = afterCfg?.icon;
  const prevCfg = p.NEXT_STAGE_ORDER && p.NEXT_STAGE_ORDER > 1 ? STAGE_CONFIG[p.NEXT_STAGE_ORDER - 1] : null;

  async function completeAction(actionId: number) {
    setCompleting(actionId);
    try {
      await fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, complete: true }),
      });
      const action = openActions.find((a) => a.ACTION_ID === actionId)!;
      setOpenActions((prev) => prev.filter((a) => a.ACTION_ID !== actionId));
      setCompletedActions((prev) => [
        { ...action, STATUS: 'COMPLETE', COMPLETED_AT: new Date().toISOString() },
        ...prev,
      ]);
    } finally {
      setCompleting(null);
    }
  }

  const subject = `[Feedback App] Actions - ${p.PATIENT_NAME}`;
  const body = buildEmailBody({ ...p, openActions, completedActions });

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: CARD_BG, border: BORDER }}>

      {/* Card header - patient info */}
      <button
        onClick={() => router.push(`/patient/${p.PATIENT_ID}`)}
        className="w-full p-4 text-left transition-colors hover:brightness-110"
        style={{ backgroundColor: CARD_BG }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold" style={{ color: '#fff' }}>{p.PATIENT_NAME}</p>
          {StageIcon && (
            <div
              className="flex items-center gap-0.5 shrink-0"
              style={{ marginTop: 2 }}
              title={stageCfg ? (afterCfg ? `${stageCfg.label} - up next: ${afterCfg.label}` : stageCfg.label) : undefined}
            >
              <StageIcon size={18} style={{ color: ACCENT }} />
              {AfterIcon && (
                <>
                  <ChevronDown size={13} className="animate-pulse rotate-[-90deg]" style={{ color: ACCENT }} />
                  <AfterIcon size={16} style={{ color: SECONDARY }} />
                </>
              )}
            </div>
          )}
        </div>
        {p.ADMISSION_DATE && (
          <p className="text-xs mt-1" style={{ color: SECONDARY }}>Admitted: {fmt(p.ADMISSION_DATE)}</p>
        )}
        {p.PLANNED_DISCHARGE_DATE && (
          <p className="text-xs" style={{ color: SECONDARY }}>Planned discharge: {fmt(p.PLANNED_DISCHARGE_DATE)}</p>
        )}
        {prevCfg ? (
          <p className="flex items-center gap-1 text-xs font-medium mt-1" style={{ color: '#38bdf8' }}>
            <CheckCircle size={11} style={{ color: '#38bdf8' }} />
            {prevCfg.label} complete
          </p>
        ) : stageCfg && StageIcon && (
          <p className="flex items-center gap-1 text-xs font-medium mt-1" style={{ color: '#38bdf8' }}>
            <StageIcon size={11} style={{ color: '#38bdf8' }} />
            {stageCfg.label}
          </p>
        )}
      </button>

      {/* Action counts */}
      <div
        className="flex items-center gap-4 px-4 py-2"
        style={{ borderTop: BORDER, backgroundColor: '#0f0f14' }}
      >
        <span className="text-xs font-semibold" style={{ color: openActions.length > 0 ? ACCENT : SECONDARY }}>
          {openActions.length} open
        </span>
        <span className="text-xs" style={{ color: SECONDARY }}>·</span>
        <button
          onClick={() => setCompletedOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
          style={{ color: completedActions.length > 0 ? '#38bdf8' : SECONDARY }}
        >
          {completedActions.length} complete
          {p.completedActions.length > 0 && (
            completedOpen
              ? <ChevronUp size={12} />
              : <ChevronDown size={12} />
          )}
        </button>
        <div className="ml-auto">
          <button
            onClick={() => setEmailing((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{
              backgroundColor: emailing ? 'rgba(255,107,43,0.15)' : '#1e1e2a',
              color: emailing ? ACCENT : SECONDARY,
              border: BORDER,
            }}
          >
            <Mail size={12} />
            Email
          </button>
        </div>
      </div>

      {/* Email input row */}
      {emailing && (
        <div className="flex gap-2 px-4 py-3" style={{ borderTop: BORDER, backgroundColor: '#0f0f14' }}>
          <input
            autoFocus
            type="email"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="Recipient email address"
            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
            style={{ backgroundColor: '#1e1e2a', border: BORDER, color: '#fff', caretColor: ACCENT }}
          />
          <a
            href={emailTo.trim() ? `mailto:${emailTo.trim()}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : '#'}
            onClick={() => { if (emailTo.trim()) setEmailing(false); }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80"
            style={{
              backgroundColor: emailTo.trim() ? ACCENT : '#1e1e2a',
              color: emailTo.trim() ? '#fff' : SECONDARY,
              pointerEvents: emailTo.trim() ? 'auto' : 'none',
            }}
          >
            <Send size={11} />
            Send
          </a>
        </div>
      )}

      {/* Open actions */}
      {openActions.length > 0 && (
        <div style={{ borderTop: BORDER }}>
          {openActions.map((a, i) => (
            <div
              key={a.ACTION_ID}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < openActions.length - 1 ? BORDER : 'none' }}
            >
              <Square size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
              <div className="flex-1 space-y-0.5">
                <p className="text-sm leading-snug" style={{ color: '#fff' }}>{a.ACTION_TEXT}</p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs" style={{ color: SECONDARY }}>{a.STAGE_NAME}</span>
                  {a.ASSIGNED_TO && (
                    <span className="text-xs" style={{ color: SECONDARY }}>{a.ASSIGNED_TO}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => completeAction(a.ACTION_ID)}
                disabled={completing === a.ACTION_ID}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                style={{ backgroundColor: '#38bdf8', color: '#0a0a0f' }}
              >
                {completing === a.ACTION_ID ? '...' : 'Done'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completed actions accordion */}
      {completedOpen && completedActions.length > 0 && (
        <div style={{ borderTop: BORDER, backgroundColor: '#0f0f14' }}>
          {completedActions.map((a, i) => (
            <div
              key={a.ACTION_ID}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: i < completedActions.length - 1 ? BORDER : 'none' }}
            >
              <CheckSquare size={14} style={{ color: SECONDARY, flexShrink: 0, marginTop: 2 }} />
              <div className="flex-1 space-y-0.5">
                <p className="text-sm leading-snug" style={{ color: SECONDARY, textDecoration: 'line-through' }}>
                  {a.ACTION_TEXT}
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="text-xs" style={{ color: SECONDARY }}>{a.STAGE_NAME}</span>
                  {a.ASSIGNED_TO && (
                    <span className="text-xs" style={{ color: SECONDARY }}>{a.ASSIGNED_TO}</span>
                  )}
                  {a.COMPLETED_AT && (
                    <span className="text-xs" style={{ color: SECONDARY }}>{fmt(a.COMPLETED_AT)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default function ActionsOverviewPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<PatientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/actions/overview')
      .then((r) => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then((d) => { setPatients(d); setLoading(false); })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0f' }}>

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
          <p className="text-xs" style={{ color: SECONDARY }}>Dashboard</p>
          <h1 className="text-lg font-semibold leading-tight" style={{ color: '#fff' }}>All actions</h1>
        </div>
        {patients.length > 0 && (
          <p className="ml-auto text-xs" style={{ color: SECONDARY }}>
            {patients.reduce((n, p) => n + p.openActions.length, 0)} open across {patients.length} patients
          </p>
        )}
      </div>

      <div className="px-4 py-6 pb-16">
        {loading && (
          <p className="text-center text-sm py-12" style={{ color: SECONDARY }}>Loading...</p>
        )}
        {error && (
          <p className="text-center text-sm py-12" style={{ color: ACCENT }}>{error}</p>
        )}
        {!loading && !error && patients.length === 0 && (
          <p className="text-center text-sm py-12" style={{ color: SECONDARY }}>No actions found.</p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((p) => (
            <PatientCard key={p.PATIENT_ID} p={p} />
          ))}
        </div>
      </div>

    </div>
  );
}
