import { signIn, auth } from '@/lib/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import Image from 'next/image';
import { Comfortaa, Nunito, Lato } from 'next/font/google';

const comfortaa = Comfortaa({ subsets: ['latin'], weight: ['600'] });
const nunito = Nunito({ subsets: ['latin'], weight: ['400', '600'] });
const lato = Lato({ subsets: ['latin'], weight: ['300', '400'] });

// Brand palette
const BURGUNDY = '#6B1E3C';
const BURGUNDY_MUTED = 'rgba(107,30,60,0.45)';
const GOLD_BORDER = 'rgba(175,135,85,0.5)';
const ORANGE = '#E06020';

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
      className="fixed inset-0 flex flex-col"
      style={{ backgroundColor: '#FFFFFF', color: BURGUNDY, fontFamily: nunito.style.fontFamily }}
    >
      {/* Scoped focus / hover styles (server component - plain CSS) */}
      <style>{`
        .an-input {
          background: #FFFFFF;
          border: 1px solid rgba(107,30,60,0.25);
          border-radius: 12px;
          color: ${BURGUNDY};
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .an-input::placeholder { color: ${BURGUNDY_MUTED}; }
        .an-input:focus {
          outline: none;
          border-color: ${BURGUNDY};
          box-shadow: 0 0 0 4px rgba(107,30,60,0.12);
        }
        .an-btn { background: ${BURGUNDY}; transition: background-color 0.15s; }
        .an-btn:hover { background: #571630; }
      `}</style>

      {/* Header */}
      <header className="flex items-start justify-between px-8 pt-7">
        <span
          className="pt-2 text-sm uppercase"
          style={{ color: BURGUNDY_MUTED, letterSpacing: '0.05em', fontFamily: lato.style.fontFamily }}
        >
          Patient Experience Feedback
        </span>
        <Image
          src="/anlogo.png"
          alt="Active Neuro"
          width={178}
          height={71}
          priority
          className="object-contain"
          style={{ height: '71px', width: 'auto' }}
        />
      </header>

      {/* Main */}
      <main className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
        <div
          className="w-full text-center"
          style={{
            maxWidth: '1080px',
            border: `4px solid ${GOLD_BORDER}`,
            borderRadius: '28px',
            padding: '2.5rem clamp(1.5rem, 6vw, 6rem)',
          }}
        >
          <h1
            style={{
              fontFamily: comfortaa.style.fontFamily,
              fontWeight: 600,
              lineHeight: 1.1,
              fontSize: 'clamp(1.75rem, 4vw, 3.5rem)',
              color: BURGUNDY,
            }}
          >
            Welcome
          </h1>
          <p
            className="mx-auto mt-3"
            style={{
              fontFamily: nunito.style.fontFamily,
              lineHeight: 1.65,
              fontSize: 'clamp(1.05rem, 2vw, 1.55rem)',
              color: BURGUNDY_MUTED,
              maxWidth: '32ch',
            }}
          >
            Sign in to continue to the Patient Experience app.
          </p>

          {error && (
            <p
              className="mx-auto mt-6 rounded-xl px-4 py-3 text-sm"
              style={{
                maxWidth: '380px',
                backgroundColor: 'rgba(224,96,32,0.08)',
                color: ORANGE,
                border: '1px solid rgba(224,96,32,0.35)',
                fontFamily: nunito.style.fontFamily,
              }}
            >
              Sign-in failed. Please check your details and try again.
            </p>
          )}

          {/* Sign-in with Microsoft temporarily removed - TODO: restore before go-live */}

          {/* Dev login - TODO: remove before go-live */}
          <form
            action={async (formData: FormData) => {
              'use server';
              try {
                await signIn('credentials', {
                  username: formData.get('username'),
                  password: formData.get('password'),
                  redirectTo: '/dashboard',
                });
              } catch (error) {
                if (error instanceof AuthError) {
                  redirect('/login?error=CredentialsSignin');
                }
                throw error; // re-throw redirect (success path)
              }
            }}
            className="mx-auto mt-8 space-y-4 text-left"
            style={{ maxWidth: '380px' }}
          >
            <div className="space-y-1.5">
              <label
                htmlFor="username"
                className="block text-xs uppercase"
                style={{ color: BURGUNDY_MUTED, letterSpacing: '0.05em', fontFamily: lato.style.fontFamily }}
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                placeholder="Enter your username"
                autoComplete="username"
                className="an-input w-full px-4 py-3 text-base"
                style={{ fontFamily: nunito.style.fontFamily }}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs uppercase"
                style={{ color: BURGUNDY_MUTED, letterSpacing: '0.05em', fontFamily: lato.style.fontFamily }}
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                name="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                className="an-input w-full px-4 py-3 text-base"
                style={{ fontFamily: nunito.style.fontFamily }}
              />
            </div>

            <button
              type="submit"
              className="an-btn w-full px-4 py-3.5 text-base font-semibold text-white"
              style={{ borderRadius: '12px', fontFamily: nunito.style.fontFamily }}
            >
              Sign in
            </button>
          </form>
        </div>
      </main>

      {/* Tri-colour brand strip */}
      <div className="flex w-full shrink-0" style={{ height: '50px' }} aria-hidden>
        <div style={{ flex: 2.5, backgroundColor: '#E0CFA8' }} />
        <div style={{ flex: 0.45, backgroundColor: ORANGE }} />
        <div style={{ flex: 3, backgroundColor: BURGUNDY }} />
      </div>
    </div>
  );
}
