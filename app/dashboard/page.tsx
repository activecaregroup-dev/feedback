'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAGE_CONFIG, STAGE_ORDERS } from '@/lib/stage-config';
import { CheckCircle, AlertTriangle, MessageSquare, Users, Search, Mail } from 'lucide-react';

interface Patient {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  DATE_OF_BIRTH: string;
  ADMISSION_DATE: string;
  PLANNED_DISCHARGE_DATE: string | null;
}

interface Action {
  ACTION_ID: number;
  ACTION_TEXT: string;
  STATUS: string;
  PATIENT_NAME: string;
}

interface DueItem {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  NEXT_STAGE_ID: number;
  NEXT_STAGE_NAME: string;
  NEXT_STAGE_ORDER: number;
}

interface FlaggedItem {
  PATIENT_ID: number;
  PATIENT_NAME: string;
  QUESTION_TEXT: string;
  STAGE_NAME: string;
  SCORE: number;
}

const BORDER = '1px solid #1e1e2a';
const CARD_BG = '#141419';
const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';

export default function DashboardPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [due, setDue] = useState<DueItem[]>([]);
  const [flagged, setFlagged] = useState<FlaggedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<number | null>(null);
  const [completing, setCompleting] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [pr, ar, dr, fr] = await Promise.all([
          fetch('/api/patients'),
          fetch('/api/actions'),
          fetch('/api/dashboard/due'),
          fetch('/api/dashboard/flagged'),
        ]);

        if (!pr.ok || !ar.ok || !dr.ok || !fr.ok) {
          const failed = [
            !pr.ok && 'patients',
            !ar.ok && 'actions',
            !dr.ok && 'due',
            !fr.ok && 'flagged',
          ].filter(Boolean).join(', ');
          throw new Error(`Failed to load: ${failed}`);
        }

        const [p, a, d, f] = await Promise.all([pr.json(), ar.json(), dr.json(), fr.json()]);
        setPatients(Array.isArray(p) ? p : []);
        setActions(Array.isArray(a) ? a : []);
        setDue(Array.isArray(d) ? d : []);
        setFlagged(Array.isArray(f) ? f : []);
        fetch('/api/me').then((r) => r.ok ? r.json() : null).then((me) => { if (me?.email) setUserEmail(me.email); });
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function completeAction(actionId: number) {
    setCompleting(actionId);
    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId }),
    });
    setActions((prev) => prev.filter((a) => a.ACTION_ID !== actionId));
    setCompleting(null);
  }

  // Figure out next due stage order per patient (for card badge + filter)
  const dueStageByPatient = new Map(
    due.map((d) => [d.PATIENT_ID, d.NEXT_STAGE_ORDER])
  );

  const filteredPatients = patients
    .filter((p) => stageFilter === null || dueStageByPatient.get(p.PATIENT_ID) === stageFilter)
    .filter((p) => !search || p.PATIENT_NAME.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <p style={{ color: SECONDARY }}>Loading...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#0a0a0f' }}>
        <div className="space-y-2 text-center">
          <p className="font-medium" style={{ color: ACCENT }}>Failed to load dashboard</p>
          <p className="text-sm" style={{ color: SECONDARY }}>{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#0a0a0f' }}>

      {/* Left: patient grid */}
      <div className="flex flex-1 flex-col overflow-hidden" style={{ borderRight: BORDER }}>

        {/* Top bar */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: BORDER, backgroundColor: CARD_BG }}
        >
          <button
            onClick={() => router.push('/patients')}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#1e1e2a', color: '#fff', border: BORDER }}
          >
            <Users size={14} />
            Manage patients
          </button>
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#8a8a9a' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patients..."
              className="w-full rounded-lg py-2 pl-8 pr-3 text-sm outline-none"
              style={{ backgroundColor: '#1e1e2a', border: BORDER, color: '#fff', caretColor: '#ff6b2b' }}
            />
          </div>
        </div>

        {/* Stage filter bar */}
        <div
          className="flex items-center gap-2 overflow-x-auto px-4 py-3 shrink-0"
          style={{ borderBottom: BORDER, backgroundColor: CARD_BG }}
        >
          <button
            onClick={() => setStageFilter(null)}
            className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            style={{
              backgroundColor: stageFilter === null ? ACCENT : 'transparent',
              color: stageFilter === null ? '#fff' : SECONDARY,
              border: stageFilter === null ? `1px solid ${ACCENT}` : BORDER,
            }}
          >
            All
          </button>
          {STAGE_ORDERS.map((order) => {
            const cfg = STAGE_CONFIG[order];
            const Icon = cfg.icon;
            const active = stageFilter === order;
            return (
              <button
                key={order}
                onClick={() => setStageFilter(active ? null : order)}
                className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                style={{
                  backgroundColor: active ? ACCENT : 'transparent',
                  color: active ? '#fff' : SECONDARY,
                  border: active ? `1px solid ${ACCENT}` : BORDER,
                }}
              >
                <Icon size={14} />
                {cfg.label}
              </button>
            );
          })}
        </div>

        {/* Patient cards grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredPatients.length === 0 ? (
            <p className="mt-8 text-center text-sm" style={{ color: SECONDARY }}>
              {stageFilter ? 'No patients due this stage.' : 'No assigned patients.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredPatients.map((p) => {
                const nextOrder = dueStageByPatient.get(p.PATIENT_ID);
                const stageCfg = nextOrder ? STAGE_CONFIG[nextOrder] : null;
                const StageIcon = stageCfg?.icon;
                const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

                return (
                  <button
                    key={p.PATIENT_ID}
                    onClick={() => router.push(`/patient/${p.PATIENT_ID}`)}
                    className="flex flex-col gap-2 rounded-xl p-3 text-left transition-colors hover:brightness-110"
                    style={{ backgroundColor: CARD_BG, border: BORDER }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-semibold leading-tight" style={{ color: '#fff' }}>
                        {p.PATIENT_NAME}
                      </p>
                      {StageIcon && (
                        <StageIcon size={20} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
                      )}
                    </div>
                    <p className="text-xs" style={{ color: SECONDARY }}>Admitted: {fmt(p.ADMISSION_DATE)}</p>
                    {p.PLANNED_DISCHARGE_DATE && (
                      <p className="text-xs" style={{ color: SECONDARY }}>Planned discharge: {fmt(p.PLANNED_DISCHARGE_DATE)}</p>
                    )}
                    {stageCfg && (
                      <p className="text-xs font-medium" style={{ color: '#38bdf8' }}>{stageCfg.label}</p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: sidebar */}
      <div className="w-1/3 shrink-0 overflow-y-auto" style={{ backgroundColor: '#0a0a0f' }}>

        {/* Actions */}
        <SidebarSection
          icon={<CheckCircle size={15} style={{ color: ACCENT }} />}
          title="Actions"
          empty={actions.length === 0}
          emptyText="No open actions"
          headerAction={actions.length > 0 ? (
            <a
              href={`mailto:${userEmail}?subject=${encodeURIComponent(`Outstanding actions - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`)}&body=${encodeURIComponent(actions.map((a) => `${a.PATIENT_NAME}: ${a.ACTION_TEXT}`).join('\n'))}`}
              className="rounded-lg p-1.5 transition-opacity hover:opacity-70"
              style={{ color: SECONDARY }}
              title="Email actions"
            >
              <Mail size={14} />
            </a>
          ) : undefined}
        >
          {actions.map((a) => (
            <div
              key={a.ACTION_ID}
              className="flex items-start gap-3 rounded-lg p-3"
              style={{ backgroundColor: CARD_BG, border: BORDER }}
            >
              <div className="flex-1 space-y-0.5">
                <p className="text-xs font-medium" style={{ color: SECONDARY }}>{a.PATIENT_NAME}</p>
                <p className="text-sm leading-snug" style={{ color: '#fff' }}>{a.ACTION_TEXT}</p>
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
        </SidebarSection>

        {/* Due conversations */}
        <SidebarSection
          icon={<MessageSquare size={15} style={{ color: ACCENT }} />}
          title="Due next"
          empty={due.length === 0}
          emptyText="All conversations up to date"
        >
          {due.map((d) => {
            const cfg = STAGE_CONFIG[d.NEXT_STAGE_ORDER];
            const Icon = cfg?.icon;
            return (
              <button
                key={`${d.PATIENT_ID}-${d.NEXT_STAGE_ID}`}
                onClick={() => router.push(`/session/stage-select?patientId=${d.PATIENT_ID}&patientName=${encodeURIComponent(d.PATIENT_NAME)}`)}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:brightness-110"
                style={{ backgroundColor: CARD_BG, border: BORDER }}
              >
                {Icon && <Icon size={14} style={{ color: ACCENT, flexShrink: 0 }} />}
                <div>
                  <p className="text-sm font-medium" style={{ color: '#fff' }}>{d.PATIENT_NAME}</p>
                  <p className="text-xs font-medium" style={{ color: '#38bdf8' }}>{d.NEXT_STAGE_NAME}</p>
                </div>
              </button>
            );
          })}
        </SidebarSection>

        {/* Flagged scores */}
        <SidebarSection
          icon={<AlertTriangle size={15} style={{ color: '#f59e0b' }} />}
          title="Flagged scores"
          empty={flagged.length === 0}
          emptyText="No flagged scores in last 30 days"
        >
          {flagged.map((f, i) => (
            <div
              key={i}
              className="rounded-lg p-3 space-y-1"
              style={{ backgroundColor: CARD_BG, border: '1px solid rgba(245,158,11,0.2)' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: SECONDARY }}>{f.PATIENT_NAME}</p>
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-bold"
                  style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' }}
                >
                  {f.SCORE}/5
                </span>
              </div>
              <p className="text-xs leading-snug" style={{ color: '#fff' }}>{f.QUESTION_TEXT}</p>
              <p className="text-xs font-medium" style={{ color: '#38bdf8' }}>{f.STAGE_NAME}</p>
            </div>
          ))}
        </SidebarSection>

      </div>
    </div>
  );
}

function SidebarSection({
  icon,
  title,
  empty,
  emptyText,
  headerAction,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: boolean;
  emptyText: string;
  headerAction?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b" style={{ borderColor: '#1e1e2a' }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid #1e1e2a' }}>
        {icon}
        <span className="flex-1 text-sm font-semibold" style={{ color: '#fff' }}>{title}</span>
        {headerAction}
      </div>
      <div className="space-y-2 p-3">
        {empty ? (
          <p className="py-2 text-center text-xs" style={{ color: '#8a8a9a' }}>{emptyText}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
