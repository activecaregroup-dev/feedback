'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PasswordPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'ActiveNeuro!887766') {
      router.push('/dashboard');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <form onSubmit={handleSubmit} className="p-6 bg-white border rounded-lg shadow-md w-full max-w-sm">
        <h1 className="text-xl font-semibold mb-4 text-center">Enter Password</h1>
        <input
          type="text"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 p-3 mb-4 w-full rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button
          type="submit"
          className="bg-blue-500 hover:bg-blue-600 text-white p-3 w-full rounded font-medium transition-colors"
        >
          Submit
        </button>
        {error && <p className="text-red-500 mt-3 text-center">{error}</p>}
      </form>
    </div>
  );
}