'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock } from 'lucide-react';

export default function PasswordPage() {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'ActiveNeuro!887766') {
      router.push('/dashboard');
    } else {
      setError('Incorrect password. Please try again.');
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center p-6"
      style={{ backgroundColor: '#0a0a0f' }}
    >
      {/* Logo / wordmark */}
      <div className="mb-10 text-center">
        <div
          className="mx-auto mb-4 flex items-center justify-center rounded-2xl"
          style={{ width: 64, height: 64, backgroundColor: '#141419', border: '1px solid #1e1e2a' }}
        >
          <Lock size={28} style={{ color: '#ff6b2b' }} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#fff' }}>
          Active<span style={{ color: '#ff6b2b' }}>Neuro</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#8a8a9a' }}>Patient Experience</p>
      </div>

      {/* Card */}
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl p-6"
        style={{ backgroundColor: '#141419', border: '1px solid #1e1e2a' }}
      >
        <p className="text-sm font-medium" style={{ color: '#8a8a9a' }}>Enter access password</p>

        {/* Input */}
        <div className="relative">
          <input
            type={show ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full rounded-xl px-4 py-4 pr-12 text-base font-medium outline-none transition-colors"
            style={{
              backgroundColor: '#0a0a0f',
              border: error ? '1px solid #f87171' : '1px solid #1e1e2a',
              color: '#fff',
            }}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            required
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-opacity hover:opacity-70"
            style={{ color: '#8a8a9a' }}
            tabIndex={-1}
          >
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>

        {error && (
          <p className="text-sm" style={{ color: '#f87171' }}>{error}</p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl py-4 text-base font-semibold transition-opacity hover:opacity-90 active:opacity-80"
          style={{ backgroundColor: '#ff6b2b', color: '#fff' }}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
