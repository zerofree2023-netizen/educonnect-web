import { Suspense } from 'react';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#050B1A] text-white flex items-center justify-center">
          Loading...
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}