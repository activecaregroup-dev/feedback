import { signIn, auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Image from 'next/image';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect('/dashboard');

  const { error } = await searchParams;

  return (
    <div
      className="flex min-h-screen items-center justify-center p-6"
      style={{ backgroundColor: '#0a0a0f' }}
    >
      {/* Ambient glow behind card */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden
      >
        <div
          className="h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: '#ff6b2b' }}
        />
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-md space-y-8 rounded-2xl p-10"
        style={{
          backgroundColor: '#141419',
          boxShadow: '0 0 0 1px rgba(255,107,43,0.08), 0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Logo + subtitle */}
        <div className="flex flex-col items-center gap-5">
          <div className="rounded-2xl bg-white px-8 py-4">
            <Image
              src="/anlogo.png"
              alt="Active Neuro"
              width={160}
              height={64}
              className="object-contain"
              priority
            />
          </div>
          <p className="text-sm font-medium tracking-wide" style={{ color: '#8a8a9a' }}>
            Patient Experience Feedback
          </p>
        </div>

        {error && (
          <p
            className="rounded-lg px-4 py-3 text-sm"
            style={{
              backgroundColor: 'rgba(255,107,43,0.1)',
              color: '#ff6b2b',
              border: '1px solid rgba(255,107,43,0.2)',
            }}
          >
            Sign-in failed. Please try again or contact your administrator.
          </p>
        )}

        {/* Primary sign-in */}
        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/dashboard' });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-lg px-4 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
            style={{ backgroundColor: '#ff6b2b' }}
          >
            Sign in with Microsoft
          </button>
        </form>

        {/* Dev login — TODO: remove before go-live */}
        <form
          action={async (formData: FormData) => {
            'use server';
            await signIn('credentials', {
              password: formData.get('password'),
              redirectTo: '/dashboard',
            });
          }}
          className="space-y-2"
        >
          <input
            type="password"
            name="password"
            placeholder="Dev password"
            className="w-full rounded-lg px-4 py-3 text-sm outline-none transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#8a8a9a',
            }}
          />
          <button
            type="submit"
            className="w-full rounded-lg px-4 py-2.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#8a8a9a',
            }}
          >
            Dev login
          </button>
        </form>
      </div>
    </div>
  );
}
