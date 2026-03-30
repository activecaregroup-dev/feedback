'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Minus, UserCircle2 } from 'lucide-react';
import { STAGE_CONFIG } from '@/lib/stage-config';

interface SitePatient {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  DATE_OF_BIRTH: string;
  ASSIGNMENT_ID: number | null;
  ASSIGNED_USER_ID: number | null;
  ASSIGNED_USER_NAME: string | null;
  NEXT_STAGE_ORDER: number | null;
}

const BORDER = '1px solid #1e1e2a';
const CARD_BG = '#141419';
const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';

function initials(name: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function dob(raw: string): string {
  if (!raw) return '';
  return new Date(raw).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<SitePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [confirmUnassign, setConfirmUnassign] = useState<SitePatient | null>(null);

  async function loadPatients() {
    try {
      const [siteRes, meRes] = await Promise.all([
        fetch('/api/patients/site'),
        fetch('/api/me'),
      ]);
      if (!siteRes.ok) throw new Error('Failed to load patients');
      const data = await siteRes.json();
      setPatients(Array.isArray(data) ? data : []);
      if (meRes.ok) {
        const me = await meRes.json();
        setMyUserId(String(me.id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPatients(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function assign(patientId: number) {
    setBusy(patientId);
    try {
      const res = await fetch('/api/patients/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      if (res.status === 409) {
        alert('This patient was just assigned by someone else.');
      }
      if (!res.ok) return;
      await loadPatients();
    } finally {
      setBusy(null);
    }
  }

  async function unassign(patientId: number) {
    setBusy(patientId);
    setConfirmUnassign(null);
    try {
      const res = await fetch('/api/patients/unassign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId }),
      });
      if (!res.ok) return;
      await loadPatients();
    } finally {
      setBusy(null);
    }
  }

  const unassigned = patients.filter((p) => p.ASSIGNED_USER_ID === null);
  const mine = patients.filter((p) => p.ASSIGNED_USER_ID !== null && String(p.ASSIGNED_USER_ID) === myUserId);
  const others = patients.filter(
    (p) => p.ASSIGNED_USER_ID !== null && String(p.ASSIGNED_USER_ID) !== myUserId
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: SECONDARY }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <div className="space-y-2 text-center">
          <p className="font-medium" style={{ color: ACCENT }}>Error</p>
          <p className="text-sm" style={{ color: SECONDARY }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a0f' }}>

      {/* Header */}
      <div
        className="flex items-center gap-3 px-5 py-4 sticky top-0 z-10"
        style={{ backgroundColor: CARD_BG, borderBottom: BORDER }}
      >
        <button
          onClick={() => router.push('/dashboard')}
          className="rounded-xl p-3.5 transition-opacity hover:opacity-70"
          style={{ backgroundColor: '#1e1e2a', color: '#fff' }}
        >
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-semibold" style={{ color: '#fff' }}>Manage patients</h1>
      </div>

      {/* Two-column layout — 50/50 */}
      <div className="flex h-[calc(100vh-61px)] overflow-hidden">

        {/* Left column */}
        <div className="flex w-1/2 flex-col overflow-y-auto" style={{ borderRight: BORDER }}>

          {/* Unassigned */}
          <Section title="Unassigned" count={unassigned.length}>
            {unassigned.length === 0 ? (
              <Empty text="No unassigned patients" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {unassigned.map((p) => {
                  const stageCfg = p.NEXT_STAGE_ORDER ? STAGE_CONFIG[p.NEXT_STAGE_ORDER] : null;
                  const StageIcon = stageCfg?.icon;
                  return (
                  <PatientCard key={p.PATIENT_ID}>
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-xs font-semibold leading-tight" style={{ color: '#fff' }}>{p.PATIENT_NAME}</p>
                        {StageIcon && stageCfg && (
                          <span className="relative group shrink-0">
                            <StageIcon size={20} style={{ color: ACCENT }} />
                            <span
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                              style={{ backgroundColor: '#1e1e2a', color: '#fff', border: BORDER }}
                            >
                              {stageCfg.label}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>{dob(p.DATE_OF_BIRTH)}</p>
                    </div>
                    <ActionStrip
                      color="#22c55e"
                      bg="#1a2e1a"
                      onClick={() => assign(p.PATIENT_ID)}
                      disabled={busy === p.PATIENT_ID}
                      title="Assign to me"
                    >
                      <Plus size={14} />
                    </ActionStrip>
                  </PatientCard>
                  );
                })}
              </div>
            )}
          </Section>

          {/* Assigned to others */}
          <Section title="Assigned to others" count={others.length}>
            {others.length === 0 ? (
              <Empty text="No patients assigned to others" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {others.map((p) => {
                  const stageCfg = p.NEXT_STAGE_ORDER ? STAGE_CONFIG[p.NEXT_STAGE_ORDER] : null;
                  const StageIcon = stageCfg?.icon;
                  return (
                  <PatientCard key={p.PATIENT_ID} dimmed>
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="shrink-0 flex items-center justify-center rounded-full font-semibold"
                          style={{ width: 26, height: 26, backgroundColor: '#1e1e2a', color: SECONDARY, border: BORDER, fontSize: 11 }}
                        >
                          {initials(p.ASSIGNED_USER_NAME)}
                        </span>
                        <p className="truncate text-xs font-semibold leading-tight" style={{ color: '#fff' }}>{p.PATIENT_NAME}</p>
                        {StageIcon && stageCfg && (
                          <span className="relative group shrink-0">
                            <StageIcon size={20} style={{ color: ACCENT }} />
                            <span
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                              style={{ backgroundColor: '#1e1e2a', color: '#fff', border: BORDER }}
                            >
                              {stageCfg.label}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>{dob(p.DATE_OF_BIRTH)}</p>
                    </div>
                    <ActionStrip
                      color="#f87171"
                      bg="#2e1a1a"
                      onClick={() => setConfirmUnassign(p)}
                      disabled={busy === p.PATIENT_ID}
                      title="Unassign"
                    >
                      <Minus size={14} />
                    </ActionStrip>
                  </PatientCard>
                  );
                })}
              </div>
            )}
          </Section>
        </div>

        {/* Right column — My patients */}
        <div className="flex w-1/2 flex-col overflow-y-auto">
          <Section title="My patients" count={mine.length}>
            {mine.length === 0 ? (
              <Empty text="You have no assigned patients" />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {mine.map((p) => {
                  const stageCfg = p.NEXT_STAGE_ORDER ? STAGE_CONFIG[p.NEXT_STAGE_ORDER] : null;
                  const StageIcon = stageCfg?.icon;
                  return (
                  <PatientCard key={p.PATIENT_ID}>
                    <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="truncate text-xs font-semibold leading-tight" style={{ color: '#fff' }}>{p.PATIENT_NAME}</p>
                        {StageIcon && stageCfg && (
                          <span className="relative group shrink-0">
                            <StageIcon size={20} style={{ color: ACCENT }} />
                            <span
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10"
                              style={{ backgroundColor: '#1e1e2a', color: '#fff', border: BORDER }}
                            >
                              {stageCfg.label}
                            </span>
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>{dob(p.DATE_OF_BIRTH)}</p>
                    </div>
                    <ActionStrip
                      color="#f87171"
                      bg="#2e1a1a"
                      onClick={() => setConfirmUnassign(p)}
                      disabled={busy === p.PATIENT_ID}
                      title="Unassign"
                    >
                      <Minus size={14} />
                    </ActionStrip>
                  </PatientCard>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>

      {/* Confirm unassign dialog */}
      {confirmUnassign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={() => setConfirmUnassign(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: CARD_BG, border: BORDER }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <UserCircle2 size={20} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
              <div>
                <p className="font-semibold" style={{ color: '#fff' }}>Unassign patient?</p>
                <p className="mt-1 text-sm" style={{ color: SECONDARY }}>
                  {confirmUnassign.PATIENT_NAME}
                  {confirmUnassign.ASSIGNED_USER_NAME && String(confirmUnassign.ASSIGNED_USER_ID) !== myUserId
                    ? ` is currently assigned to ${confirmUnassign.ASSIGNED_USER_NAME}.`
                    : ' will be removed from your list.'}
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmUnassign(null)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: '#1e1e2a', color: '#fff' }}
              >
                Cancel
              </button>
              <button
                onClick={() => unassign(confirmUnassign.PATIENT_ID)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                Unassign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: '1px solid #1e1e2a' }}>
      <div
        className="flex items-center gap-2 px-4 py-3 sticky top-0"
        style={{ backgroundColor: '#141419', borderBottom: '1px solid #1e1e2a', zIndex: 1 }}
      >
        <span className="text-sm font-semibold" style={{ color: '#fff' }}>{title}</span>
        {count > 0 && (
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ backgroundColor: '#1e1e2a', color: '#8a8a9a' }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

function PatientCard({ children, dimmed }: { children: React.ReactNode; dimmed?: boolean }) {
  return (
    <div
      className="flex rounded-xl"
      style={{ backgroundColor: '#141419', border: '1px solid #1e1e2a', opacity: dimmed ? 0.65 : 1 }}
    >
      {children}
    </div>
  );
}

function ActionStrip({
  children,
  color,
  bg,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex shrink-0 items-center justify-center transition-opacity hover:opacity-80 disabled:opacity-40"
      style={{ width: 40, backgroundColor: bg, color, borderRadius: '0 12px 12px 0' }}
    >
      {children}
    </button>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-3 text-center text-xs" style={{ color: '#8a8a9a' }}>{text}</p>
  );
}
