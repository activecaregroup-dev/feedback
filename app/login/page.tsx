import { signIn } from '@/lib/auth';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session) redirect('/dashboard');

  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-10 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Active Neuro</h1>
          <p className="text-sm text-gray-500">Patient Experience Feedback</p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Sign-in failed. Please try again or contact your administrator.
          </p>
        )}

        <form
          action={async () => {
            'use server';
            await signIn('microsoft-entra-id', { redirectTo: '/dashboard' });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-4 text-base font-medium text-white hover:bg-blue-700 active:bg-blue-800"
          >
            Sign in with Microsoft
          </button>
        </form>
      </div>
    </div>
  );
}
