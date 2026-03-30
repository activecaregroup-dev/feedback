'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { STAGE_CONFIG, STAGE_ORDERS } from '@/lib/stage-config';
import { CheckCircle, Lock, ChevronRight, ArrowLeft } from 'lucide-react';

interface StageRow {
  STAGE_ID: number;
  STAGE_NAME: string;
  STAGE_ORDER: number;
  status: 'complete' | 'due' | 'locked';
  startedAt: string | null;
  avgScore: number | null;
}

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';

function StageSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId')!;
  const patientName = searchParams.get('patientName') ?? 'Patient';

  const [stages, setStages] = useState<StageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/patients/${patientId}/stages`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load stages');
        return r.json();
      })
      .then((data) => {
        setStages(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [patientId]);

  function startStage(stage: StageRow) {
    if (stage.status !== 'due') return;
    router.push(
      `/session/guidance?patientId=${patientId}&stageId=${stage.STAGE_ID}&patientName=${encodeURIComponent(patientName)}&stageName=${encodeURIComponent(stage.STAGE_NAME)}`
    );
  }

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
        <p style={{ color: ACCENT }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8" style={{ backgroundColor: '#0a0a0f' }}>
      <div className="mx-auto max-w-lg">

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/dashboard')}
            className="mb-5 flex w-fit items-center gap-2 rounded-xl px-4 py-3 text-base font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: '#141419', border: '1px solid #1e1e2a', color: '#fff' }}
          >
            <ArrowLeft size={20} />
            Dashboard
          </button>
          <p className="text-sm" style={{ color: SECONDARY }}>Select stage</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>{patientName}</h1>
        </div>

        {/* Stage stepper */}
        <div className="relative">
          {/* Vertical connector line */}
          <div
            className="absolute left-6 top-6 w-px"
            style={{
              height: `calc(100% - 48px)`,
              backgroundColor: '#1e1e2a',
            }}
          />

          <div className="space-y-3">
            {stages.map((stage) => {
              const order = STAGE_ORDERS.find((o) => STAGE_CONFIG[o].label === stage.STAGE_NAME || stage.STAGE_ORDER === o) ?? stage.STAGE_ORDER;
              const cfg = STAGE_CONFIG[stage.STAGE_ORDER];
              const StageIcon = cfg?.icon;
              const isDue = stage.status === 'due';
              const isComplete = stage.status === 'complete';
              const isLocked = stage.status === 'locked';

              const iconBg = isComplete ? 'rgba(255,107,43,0.15)' : isDue ? ACCENT : '#1e1e2a';
              const iconColor = isComplete ? ACCENT : isDue ? '#fff' : SECONDARY;

              const date = stage.startedAt
                ? new Date(stage.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;

              return (
                <button
                  key={stage.STAGE_ID}
                  onClick={() => startStage(stage)}
                  disabled={!isDue}
                  className="relative flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors"
                  style={{
                    backgroundColor: isDue ? `rgba(255,107,43,0.06)` : CARD_BG,
                    border: isDue ? `1px solid rgba(255,107,43,0.3)` : BORDER,
                    cursor: isDue ? 'pointer' : 'default',
                    opacity: isLocked ? 0.5 : 1,
                  }}
                >
                  {/* Stage icon circle */}
                  <div
                    className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: iconBg }}
                  >
                    {isComplete ? (
                      <CheckCircle size={20} style={{ color: ACCENT }} />
                    ) : isLocked ? (
                      <Lock size={16} style={{ color: SECONDARY }} />
                    ) : StageIcon ? (
                      <StageIcon size={20} style={{ color: iconColor }} />
                    ) : null}
                  </div>

                  {/* Stage info */}
                  <div className="flex-1">
                    <p
                      className="font-semibold"
                      style={{ color: isLocked ? SECONDARY : '#fff' }}
                    >
                      {stage.STAGE_NAME}
                    </p>

                    {isComplete && (
                      <div className="mt-0.5 flex items-center gap-3">
                        <p className="text-xs" style={{ color: SECONDARY }}>
                          {date}
                        </p>
                        {stage.avgScore !== null && (
                          <p className="text-xs font-medium" style={{ color: ACCENT }}>
                            Avg score {Number(stage.avgScore).toFixed(1)} / 5
                          </p>
                        )}
                      </div>
                    )}

                    {isDue && (
                      <p className="mt-0.5 text-xs font-medium" style={{ color: ACCENT }}>
                        Due now
                      </p>
                    )}

                    {isLocked && (
                      <p className="mt-0.5 text-xs" style={{ color: SECONDARY }}>
                        Locked
                      </p>
                    )}
                  </div>

                  {isDue && (
                    <ChevronRight size={18} style={{ color: ACCENT, flexShrink: 0 }} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StageSelectPage() {
  return (
    <Suspense>
      <StageSelectContent />
    </Suspense>
  );
}
