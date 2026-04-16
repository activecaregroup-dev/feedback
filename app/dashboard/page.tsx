'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { STAGE_CONFIG, STAGE_ORDERS } from '@/lib/stage-config';
import { CheckCircle, AlertTriangle, MessageSquare, Users, Search, Mail, Pencil, X, Send, ChevronRight, Clock } from 'lucide-react';

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
  ASSIGNED_TO: string | null;
  LAST_EMAILED_TO: string | null;
  LAST_EMAILED_AT: string | null;
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
  const [editingAssignedTo, setEditingAssignedTo] = useState<number | null>(null);
  const [assignedToValue, setAssignedToValue] = useState('');
  const [editingAction, setEditingAction] = useState<Action | null>(null);
  const [modalText, setModalText] = useState('');
  const [modalAssignedTo, setModalAssignedTo] = useState('');
  const [modalSaving, setModalSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [emailingAction, setEmailingAction] = useState<number | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [sendingEmail, setSendingEmail] = useState<number | null>(null);

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
      body: JSON.stringify({ actionId, complete: true }),
    });
    setActions((prev) => prev.filter((a) => a.ACTION_ID !== actionId));
    setCompleting(null);
  }

  function openEditModal(action: Action) {
    setEditingAction(action);
    setModalText(action.ACTION_TEXT);
    setModalAssignedTo(action.ASSIGNED_TO ?? '');
  }

  async function saveModal() {
    if (!editingAction || !modalText.trim()) return;
    setModalSaving(true);
    const actionId = editingAction.ACTION_ID;
    const newText = modalText.trim();
    const newAssignedTo = modalAssignedTo.trim() || null;
    await Promise.all([
      fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, actionText: newText }),
      }),
      fetch('/api/actions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, assignedTo: newAssignedTo }),
      }),
    ]);
    setActions((prev) => prev.map((a) =>
      a.ACTION_ID === actionId ? { ...a, ACTION_TEXT: newText, ASSIGNED_TO: newAssignedTo } : a
    ));
    setModalSaving(false);
    setEditingAction(null);
  }

  async function saveAssignedTo(actionId: number, value: string) {
    setEditingAssignedTo(null);
    const trimmed = value.trim() || null;
    setActions((prev) => prev.map((a) => a.ACTION_ID === actionId ? { ...a, ASSIGNED_TO: trimmed } : a));
    await fetch('/api/actions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionId, assignedTo: trimmed }),
    });
  }

  async function sendActionEmail(action: Action) {
    const address = emailTo.trim();
    if (!address) return;
    setSendingEmail(action.ACTION_ID);

    const subject = encodeURIComponent(`[Feedback App] Action point - ${action.PATIENT_NAME}`);
    const body = encodeURIComponent(
      `This action was raised via the Active Neuro Patient Experience Feedback App.\n\n` +
      `Action: ${action.ACTION_TEXT}` +
      (action.ASSIGNED_TO ? `\nAssigned to: ${action.ASSIGNED_TO}` : '') +
      `\nPatient: ${action.PATIENT_NAME}` +
      `\nRaised: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`
    );
    window.location.href = `mailto:${address}?subject=${subject}&body=${body}`;

    await fetch(`/api/actions/${action.ACTION_ID}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailedTo: address }),
    });

    const now = new Date().toISOString();
    setActions((prev) => prev.map((a) =>
      a.ACTION_ID === action.ACTION_ID
        ? { ...a, LAST_EMAILED_TO: address, LAST_EMAILED_AT: now }
        : a
    ));
    setSendingEmail(null);
    setEmailingAction(null);
    setEmailTo('');
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
    <>
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
                const afterCfg = nextOrder ? STAGE_CONFIG[nextOrder + 1] : null;
                const AfterIcon = afterCfg?.icon;
                const prevCfg = nextOrder && nextOrder > 1 ? STAGE_CONFIG[nextOrder - 1] : null;
                const iconTitle = stageCfg
                  ? afterCfg ? `${stageCfg.label} - up next: ${afterCfg.label}` : stageCfg.label
                  : undefined;
                const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                const daysSince = Math.floor((Date.now() - new Date(p.ADMISSION_DATE).getTime()) / 86_400_000);
                const notYetAdmitted = daysSince < 0;
                const daysUntil = Math.abs(daysSince);
                const overdueFlash = !notYetAdmitted && nextOrder === 1 && daysSince >= 11;
                const isOverdue = !notYetAdmitted && ((nextOrder === 1 && daysSince >= 1) || (nextOrder === 2 && daysSince >= 11));
                const stageColor = isOverdue ? '#ef4444' : ACCENT;

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
                        <div className="flex items-center gap-0.5 shrink-0" style={{ marginTop: 2 }} title={iconTitle}>
                          <StageIcon size={18} className={overdueFlash ? 'animate-pulse' : ''} style={{ color: stageColor }} />
                          {AfterIcon && (
                            <>
                              <ChevronRight size={13} className="animate-pulse" style={{ color: stageColor }} />
                              <AfterIcon size={16} style={{ color: SECONDARY }} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: SECONDARY }}>Admitted: {fmt(p.ADMISSION_DATE)}</p>
                    {p.PLANNED_DISCHARGE_DATE && (
                      <p className="text-xs" style={{ color: SECONDARY }}>Planned discharge: {fmt(p.PLANNED_DISCHARGE_DATE)}</p>
                    )}
                    <div className="flex items-end justify-between gap-2">
                      {prevCfg ? (
                        <p className="flex items-center gap-1 text-xs font-medium" style={{ color: '#38bdf8' }}>
                          <CheckCircle size={11} style={{ color: '#38bdf8' }} />
                          {prevCfg.label} complete
                        </p>
                      ) : stageCfg && StageIcon ? (
                        <p className="flex items-center gap-1 text-xs font-medium" style={{ color: '#38bdf8' }}>
                          <StageIcon size={11} style={{ color: '#38bdf8' }} />
                          {stageCfg.label}
                        </p>
                      ) : <span />}
                      <div
                        title={notYetAdmitted ? `Due in ${daysUntil} day${daysUntil === 1 ? '' : 's'}` : `${daysSince} day${daysSince === 1 ? '' : 's'} since admission`}
                        className="flex shrink-0 items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: notYetAdmitted ? 'rgba(138,138,154,0.15)' : isOverdue ? 'rgba(239,68,68,0.15)' : 'rgba(56,189,248,0.15)',
                          color: notYetAdmitted ? SECONDARY : isOverdue ? '#ef4444' : '#38bdf8',
                          border: `1px solid ${notYetAdmitted ? 'rgba(138,138,154,0.3)' : isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.3)'}`,
                          borderRadius: 6,
                          padding: '2px 5px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {notYetAdmitted ? `due in ${daysUntil}` : daysSince}
                      </div>
                    </div>
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
          footerAction={
            <button
              onClick={() => router.push('/actions/complete')}
              className="w-full rounded-lg py-2 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ backgroundColor: '#1e1e2a', color: '#fff' }}
            >
              View all actions
            </button>
          }
          headerAction={actions.length > 0 ? (
            <a
              href={`mailto:${userEmail}?subject=${encodeURIComponent(`[Feedback App] Outstanding actions - ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`)}&body=${encodeURIComponent(`This summary was generated by the Active Neuro Patient Experience Feedback App.\n\n` + actions.map((a) => `${a.PATIENT_NAME}: ${a.ACTION_TEXT}${a.ASSIGNED_TO ? ` (${a.ASSIGNED_TO})` : ''}`).join('\n'))}`}
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
              className="rounded-lg p-3 space-y-2"
              style={{ backgroundColor: CARD_BG, border: BORDER }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-0.5">
                  <p className="text-xs font-medium" style={{ color: SECONDARY }}>{a.PATIENT_NAME}</p>
                  <p className="text-sm leading-snug" style={{ color: '#fff' }}>{a.ACTION_TEXT}</p>
                  {editingAssignedTo === a.ACTION_ID ? (
                    <input
                      autoFocus
                      value={assignedToValue}
                      onChange={(e) => setAssignedToValue(e.target.value)}
                      onBlur={() => saveAssignedTo(a.ACTION_ID, assignedToValue)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveAssignedTo(a.ACTION_ID, assignedToValue);
                        if (e.key === 'Escape') setEditingAssignedTo(null);
                      }}
                      placeholder="Assign to..."
                      className="w-full rounded px-2 py-0.5 text-xs outline-none"
                      style={{ backgroundColor: '#1e1e2a', border: BORDER, color: '#fff', caretColor: ACCENT }}
                    />
                  ) : (
                    <button
                      onClick={() => { setEditingAssignedTo(a.ACTION_ID); setAssignedToValue(a.ASSIGNED_TO ?? ''); }}
                      className="text-xs transition-opacity hover:opacity-70 text-left"
                      style={{ color: SECONDARY }}
                    >
                      {a.ASSIGNED_TO ? `Assigned to: ${a.ASSIGNED_TO}` : '+ assign'}
                    </button>
                  )}
                  {a.LAST_EMAILED_TO && a.LAST_EMAILED_AT && (
                    <p className="text-xs" style={{ color: SECONDARY }}>
                      Emailed {a.LAST_EMAILED_TO} - {new Date(a.LAST_EMAILED_AT).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    onClick={() => completeAction(a.ACTION_ID)}
                    disabled={completing === a.ACTION_ID}
                    className="rounded-md px-2 py-1 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ backgroundColor: '#38bdf8', color: '#0a0a0f' }}
                  >
                    {completing === a.ACTION_ID ? '...' : 'Done'}
                  </button>
                  <button
                    onClick={() => openEditModal(a)}
                    className="flex items-center justify-center rounded-md p-1 transition-opacity hover:opacity-70"
                    style={{ backgroundColor: '#1e1e2a', color: SECONDARY }}
                    title="Edit action"
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    onClick={() => {
                      if (emailingAction === a.ACTION_ID) {
                        setEmailingAction(null);
                        setEmailTo('');
                      } else {
                        setEmailingAction(a.ACTION_ID);
                        setEmailTo('');
                      }
                    }}
                    className="flex items-center justify-center rounded-md p-1 transition-opacity hover:opacity-70"
                    style={{ backgroundColor: emailingAction === a.ACTION_ID ? 'rgba(255,107,43,0.15)' : '#1e1e2a', color: emailingAction === a.ACTION_ID ? ACCENT : SECONDARY }}
                    title="Email about this action"
                  >
                    <Mail size={12} />
                  </button>
                </div>
              </div>
              {emailingAction === a.ACTION_ID && (
                <div className="flex gap-2 pt-1">
                  <input
                    autoFocus
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendActionEmail(a); if (e.key === 'Escape') { setEmailingAction(null); setEmailTo(''); } }}
                    placeholder="Recipient email address"
                    className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
                    style={{ backgroundColor: '#1e1e2a', border: BORDER, color: '#fff', caretColor: ACCENT }}
                  />
                  <button
                    onClick={() => sendActionEmail(a)}
                    disabled={!emailTo.trim() || sendingEmail === a.ACTION_ID}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40"
                    style={{ backgroundColor: ACCENT, color: '#fff' }}
                  >
                    <Send size={11} />
                    Send
                  </button>
                </div>
              )}
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
          {(() => {
            const admissionByPatient = new Map(patients.map((p) => [p.PATIENT_ID, p.ADMISSION_DATE]));
            return due.map((d) => {
              const cfg = STAGE_CONFIG[d.NEXT_STAGE_ORDER];
              const Icon = cfg?.icon;
              const admDate = admissionByPatient.get(d.PATIENT_ID);
              const dDays = admDate ? Math.floor((Date.now() - new Date(admDate).getTime()) / 86_400_000) : 0;
              const dOverdue = (d.NEXT_STAGE_ORDER === 1 && dDays >= 1) || (d.NEXT_STAGE_ORDER === 2 && dDays >= 11);
              const dColor = dOverdue ? '#ef4444' : '#38bdf8';
              return (
                <button
                  key={`${d.PATIENT_ID}-${d.NEXT_STAGE_ID}`}
                  onClick={() => router.push(`/session/stage-select?patientId=${d.PATIENT_ID}&patientName=${encodeURIComponent(d.PATIENT_NAME)}`)}
                  className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:brightness-110"
                  style={{ backgroundColor: CARD_BG, border: dOverdue ? '1px solid rgba(239,68,68,0.3)' : BORDER }}
                >
                  {Icon && <Icon size={14} style={{ color: dColor, flexShrink: 0 }} />}
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: '#fff' }}>{d.PATIENT_NAME}</p>
                    <p className="flex items-center gap-1 text-xs font-medium" style={{ color: dColor }}>
                      {dOverdue && <Clock size={11} style={{ flexShrink: 0 }} />}
                      {d.NEXT_STAGE_NAME}
                      {STAGE_CONFIG[d.NEXT_STAGE_ORDER + 1] && (
                        <span className="font-normal" style={{ color: SECONDARY }}> - up next: {STAGE_CONFIG[d.NEXT_STAGE_ORDER + 1].label}</span>
                      )}
                    </p>
                  </div>
                </button>
              );
            });
          })()}
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

    {/* Edit action modal */}
    {editingAction && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
        onClick={(e) => { if (e.target === e.currentTarget) setEditingAction(null); }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-5 space-y-4"
          style={{ backgroundColor: CARD_BG, border: BORDER }}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>Edit action</p>
            <button onClick={() => setEditingAction(null)} style={{ color: SECONDARY }}>
              <X size={18} />
            </button>
          </div>
          <p className="text-xs font-medium" style={{ color: SECONDARY }}>{editingAction.PATIENT_NAME}</p>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>Action</label>
            <textarea
              autoFocus
              value={modalText}
              onChange={(e) => setModalText(e.target.value)}
              rows={4}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ backgroundColor: '#1e1e2a', border: BORDER, color: '#fff', caretColor: ACCENT }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>Assigned to</label>
            <input
              value={modalAssignedTo}
              onChange={(e) => setModalAssignedTo(e.target.value)}
              placeholder="Name..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: '#1e1e2a', border: BORDER, color: '#fff', caretColor: ACCENT }}
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setEditingAction(null)}
              className="flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#1e1e2a', color: SECONDARY }}
            >
              Cancel
            </button>
            <button
              onClick={saveModal}
              disabled={modalSaving || !modalText.trim()}
              className="flex-1 rounded-xl py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: ACCENT, color: '#fff' }}
            >
              {modalSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function SidebarSection({
  icon,
  title,
  empty,
  emptyText,
  headerAction,
  footerAction,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: boolean;
  emptyText: string;
  headerAction?: React.ReactNode;
  footerAction?: React.ReactNode;
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
      {footerAction && (
        <div className="px-3 pb-3">
          {footerAction}
        </div>
      )}
    </div>
  );
}
