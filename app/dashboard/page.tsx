'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Patient {
  PATIENT_ID: number;
  FULL_NAME: string;
  DATE_OF_BIRTH: string;
  WARD: string;
  BED: string;
}

interface Stage {
  STAGE_ID: number;
  NAME: string;
  DISPLAY_ORDER: number;
}

interface Action {
  ACTION_ID: number;
  SESSION_ID: number;
  ACTION_TEXT: string;
  ASSIGNED_TO: string;
  DUE_DATE: string;
  PATIENT_FULL_NAME: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/patients').then((r) => r.json()),
      fetch('/api/stages').then((r) => r.json()),
      fetch('/api/actions').then((r) => r.json()),
    ]).then(([p, s, a]) => {
      setPatients(p);
      setStages(s);
      setActions(a);
      setLoading(false);
    });
  }, []);

  function handleStartSession(stageId: number) {
    if (!selectedPatient) return;
    router.push(
      `/session/guidance?patientId=${selectedPatient.PATIENT_ID}&stageId=${stageId}&patientName=${encodeURIComponent(selectedPatient.FULL_NAME)}`
    );
  }

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* Patient selection */}
      <section className="space-y-3">
        <h2 className="text-lg font-medium">Select patient</h2>
        <div className="space-y-2">
          {patients.length === 0 && (
            <p className="text-sm text-gray-500">No active patients found for your site.</p>
          )}
          {patients.map((p) => (
            <button
              key={p.PATIENT_ID}
              onClick={() => setSelectedPatient(p)}
              className={`w-full rounded-xl border px-5 py-4 text-left transition-colors ${
                selectedPatient?.PATIENT_ID === p.PATIENT_ID
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <p className="font-medium">{p.FULL_NAME}</p>
              <p className="text-sm text-gray-500">
                {p.WARD} · Bed {p.BED}
              </p>
            </button>
          ))}
        </div>
      </section>

      {/* Stage selection — only shown when a patient is selected */}
      {selectedPatient && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Select conversation stage</h2>
          <div className="space-y-2">
            {stages.map((s) => (
              <button
                key={s.STAGE_ID}
                onClick={() => handleStartSession(s.STAGE_ID)}
                className="w-full rounded-xl border border-gray-200 bg-white px-5 py-4 text-left font-medium hover:bg-gray-50"
              >
                {s.NAME}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Outstanding actions */}
      {actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Outstanding actions</h2>
          <div className="space-y-2">
            {actions.map((a) => (
              <div
                key={a.ACTION_ID}
                className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
              >
                <div className="space-y-1">
                  <p className="font-medium">{a.ACTION_TEXT}</p>
                  <p className="text-sm text-gray-600">
                    {a.PATIENT_FULL_NAME}
                    {a.ASSIGNED_TO && ` · ${a.ASSIGNED_TO}`}
                    {a.DUE_DATE && ` · Due ${new Date(a.DUE_DATE).toLocaleDateString('en-GB')}`}
                  </p>
                </div>
                <button
                  onClick={() => completeAction(a.ACTION_ID)}
                  disabled={completing === a.ACTION_ID}
                  className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {completing === a.ACTION_ID ? 'Saving…' : 'Done'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
