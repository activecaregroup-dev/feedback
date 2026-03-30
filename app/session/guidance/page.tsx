'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface Prompt {
  PROMPT_ID: number;
  THEME: string;
  PROMPT_TEXT: string;
  PROMPT_ORDER: number;
}

interface ChecklistItem {
  ITEM_ID: number;
  ITEM_TEXT: string;
  ITEM_ORDER: number;
}

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';

function GuidanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId')!;
  const stageId = searchParams.get('stageId')!;
  const patientName = searchParams.get('patientName') ?? 'Patient';
  const stageName = searchParams.get('stageName') ?? '';

  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/guidance?stageId=${stageId}`)
      .then((r) => r.json())
      .then(({ prompts, checklist }) => {
        setPrompts(prompts);
        setChecklist(checklist);
        setLoading(false);
      });
  }, [stageId]);

  function toggle(itemId: number) {
    setChecked((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  function proceed() {
    const checklistParam = encodeURIComponent(JSON.stringify(checked));
    router.push(
      `/session/feedback?patientId=${patientId}&stageId=${stageId}&patientName=${encodeURIComponent(patientName)}&stageName=${encodeURIComponent(stageName)}&checklist=${checklistParam}`
    );
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
      <div className="mx-auto max-w-2xl space-y-8">

        <div>
          <button
            onClick={() => router.push(`/session/stage-select?patientId=${patientId}&patientName=${encodeURIComponent(patientName)}`)}
            className="mb-5 flex w-fit items-center gap-2 rounded-xl px-4 py-3 text-base font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: '#141419', border: '1px solid #1e1e2a', color: '#fff' }}
          >
            <ArrowLeft size={20} />
            Back
          </button>
          <p className="text-sm" style={{ color: SECONDARY }}>Conversation guide</p>
          <h1 className="text-2xl font-semibold" style={{ color: '#fff' }}>{patientName}</h1>
        </div>

        {/* Prompts */}
        {prompts.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Discussion prompts
            </h2>
            <ol className="space-y-3">
              {prompts.map((p, i) => (
                <li
                  key={p.PROMPT_ID}
                  className="flex gap-4 rounded-xl px-5 py-4"
                  style={{ backgroundColor: CARD_BG, border: BORDER }}
                >
                  <span className="mt-0.5 shrink-0 text-lg font-bold" style={{ color: ACCENT }}>
                    {i + 1}
                  </span>
                  <div>
                    {p.THEME && (
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: ACCENT }}>
                        {p.THEME}
                      </p>
                    )}
                    <p className="text-base leading-relaxed" style={{ color: '#fff' }}>{p.PROMPT_TEXT}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: SECONDARY }}>
              Checklist
            </h2>
            <div className="space-y-2">
              {checklist.map((item) => {
                const isChecked = checked[item.ITEM_ID];
                return (
                  <button
                    key={item.ITEM_ID}
                    onClick={() => toggle(item.ITEM_ID)}
                    className="flex w-full items-center gap-4 rounded-xl px-5 py-4 text-left transition-colors"
                    style={{
                      backgroundColor: isChecked ? 'rgba(255,107,43,0.08)' : CARD_BG,
                      border: isChecked ? `1px solid rgba(255,107,43,0.4)` : BORDER,
                    }}
                  >
                    <div
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{
                        border: isChecked ? 'none' : '2px solid #3a3a4a',
                        backgroundColor: isChecked ? ACCENT : 'transparent',
                      }}
                    >
                      {isChecked && (
                        <svg className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <span className="text-base" style={{ color: isChecked ? '#fff' : SECONDARY }}>
                      {item.ITEM_TEXT}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {(() => {
          const allTicked = checklist.length === 0 || checklist.every((item) => checked[item.ITEM_ID]);
          return (
            <button
              onClick={proceed}
              disabled={!allTicked}
              className="w-full rounded-xl px-5 py-5 text-lg font-semibold text-white transition-opacity"
              style={{
                backgroundColor: allTicked ? ACCENT : '#2a2a35',
                color: allTicked ? '#fff' : SECONDARY,
                cursor: allTicked ? 'pointer' : 'not-allowed',
              }}
            >
              {allTicked
                ? 'Conversation complete - capture feedback'
                : `Tick all checklist items to continue (${checklist.filter((i) => checked[i.ITEM_ID]).length}/${checklist.length})`}
            </button>
          );
        })()}
      </div>
    </div>
  );
}

export default function GuidancePage() {
  return (
    <Suspense>
      <GuidanceContent />
    </Suspense>
  );
}
