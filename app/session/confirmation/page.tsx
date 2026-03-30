'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle } from 'lucide-react';

const ACCENT = '#ff6b2b';
const SECONDARY = '#8a8a9a';
const CARD_BG = '#141419';
const BORDER = '1px solid #1e1e2a';

function ConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId') ?? '';
  const patientName = searchParams.get('patientName') ?? 'Patient';
  const stageName = searchParams.get('stageName') ?? 'stage';
  const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12" style={{ backgroundColor: '#0a0a0f' }}>
      <div className="w-full max-w-sm space-y-8 text-center">

        {/* Tick icon */}
        <div className="flex justify-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,107,43,0.12)', border: `2px solid ${ACCENT}` }}
          >
            <CheckCircle size={40} style={{ color: ACCENT }} />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold leading-snug" style={{ color: '#fff' }}>
            Feedback saved
          </h1>
          <p className="text-base" style={{ color: SECONDARY }}>
            {patientName} - {stageName}
          </p>
          <p className="text-sm" style={{ color: SECONDARY }}>{date}</p>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => router.push(`/patient/${patientId}`)}
            className="w-full rounded-xl py-4 text-base font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: ACCENT, color: '#fff' }}
          >
            View patient journey
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-xl py-4 text-base font-medium transition-opacity hover:opacity-70"
            style={{ backgroundColor: CARD_BG, border: BORDER, color: '#fff' }}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
