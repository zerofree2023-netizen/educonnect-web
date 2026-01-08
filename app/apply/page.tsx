import { Suspense } from 'react';
import ApplyClient from './ApplyClient';

export const dynamic = 'force-dynamic';

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050B1A] text-white flex items-center justify-center">Loading...</div>}>
      <ApplyClient />
    </Suspense>
  );
}