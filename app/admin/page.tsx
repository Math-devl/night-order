import { Suspense } from 'react';
import AdminApp from '@/components/admin/AdminApp';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FFF0F5] flex items-center justify-center text-[#A0909A]">Chargement…</div>}>
      <AdminApp />
    </Suspense>
  );
}
