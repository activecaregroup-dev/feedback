'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

interface Prompt {
  PROMPT_ID: number;
  PROMPT_TEXT: string;
  DISPLAY_ORDER: number;
}

interface ChecklistItem {
  ITEM_ID: number;
  ITEM_TEXT: string;
  DISPLAY_ORDER: number;
}

function GuidanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId')!;
  const stageId = searchParams.get('stageId')!;
  const patientName = searchParams.get('patientName') ?? 'Patient';

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
      `/session/feedback?patientId=${patientId}&stageId=${stageId}&patientName=${encodeURIComponent(patientName)}&checklist=${checklistParam}`
    );
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
      <div>
        <p className="text-sm text-gray-500">Conversation guide</p>
        <h1 className="text-2xl font-semibold">{patientName}</h1>
      </div>

      {/* Prompts */}
      {prompts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-medium uppercase tracking-wide text-gray-500">
            Discussion prompts
          </h2>
          <ol className="space-y-3">
            {prompts.map((p, i) => (
              <li
                key={p.PROMPT_ID}
                className="flex gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4"
              >
                <span className="mt-0.5 shrink-0 text-lg font-semibold text-blue-600">
                  {i + 1}
                </span>
                <p className="text-base leading-relaxed">{p.PROMPT_TEXT}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Checklist */}
      {checklist.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-medium uppercase tracking-wide text-gray-500">
            Checklist
          </h2>
          <div className="space-y-2">
            {checklist.map((item) => (
              <button
                key={item.ITEM_ID}
                onClick={() => toggle(item.ITEM_ID)}
                className={`flex w-full items-center gap-4 rounded-xl border px-5 py-4 text-left transition-colors ${
                  checked[item.ITEM_ID]
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    checked[item.ITEM_ID]
                      ? 'border-green-600 bg-green-600 text-white'
                      : 'border-gray-300'
                  }`}
                >
                  {checked[item.ITEM_ID] && (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-base">{item.ITEM_TEXT}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <button
        onClick={proceed}
        className="w-full rounded-xl bg-blue-600 px-5 py-5 text-lg font-medium text-white hover:bg-blue-700 active:bg-blue-800"
      >
        Conversation complete — capture feedback
      </button>
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
