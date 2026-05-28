'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import AdminLoginScreen from './AdminLoginScreen';
import HistoriqueSection from './HistoriqueSection';
import ParametresSection from './ParametresSection';
import DashboardSection from './DashboardSection';
import EmployesTab from './EmployesTab';
import MonCompteTab from './MonCompteTab';

type AdminTab = 'dashboard' | 'historique' | 'employes' | 'parametres' | 'compte';

export default function AdminApp() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as AdminTab) || 'historique';
  const [tab, setTab] = useState<AdminTab>(initialTab);
  const [session, setSession] = useState<'loading' | 'loggedIn' | 'loggedOut'>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? 'loggedIn' : 'loggedOut');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'SIGNED_OUT') {
        setSession('loggedOut');
      } else if (s) {
        setSession('loggedIn');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (session === 'loading') {
    return <div className="min-h-screen bg-[#FFF0F5] flex items-center justify-center text-[#A0909A]">Chargement…</div>;
  }

  if (session === 'loggedOut') {
    return <AdminLoginScreen onLogin={() => setSession('loggedIn')} />;
  }

  return (
    <div className="min-h-screen bg-[#FFF0F5] text-[#1A1209]">
      <header className="border-b border-[#6B7A50] bg-[#596643] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🍔</span>
            <div>
              <h1 className="text-white font-bold text-base leading-none">Night Order</h1>
              <p className="text-[#8BA870] text-xs hidden sm:block">Interface Admin</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/mobile" className="text-[#FF4D8A] text-sm font-semibold hover:underline whitespace-nowrap">
              → App commandes
            </a>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-[#8BA870] text-xs hover:text-white border border-[#6B7A50] px-2.5 py-1 rounded-lg hover:bg-[#496035] transition-colors"
            >
              Déconnexion
            </button>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-2 sm:px-6 flex gap-0 overflow-x-auto scrollbar-none">
          {([
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'historique', label: 'Historique' },
            { id: 'employes', label: 'Employés' },
            { id: 'parametres', label: 'Paramètres' },
            { id: 'compte', label: 'Mon compte' },
          ] as { id: AdminTab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-[#FF4D8A] text-[#FF4D8A]'
                  : 'border-transparent text-[#8BA870] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {tab === 'dashboard' && <DashboardSection />}
        {tab === 'historique' && <HistoriqueSection />}
        {tab === 'employes' && <EmployesTab />}
        {tab === 'parametres' && <ParametresSection />}
        {tab === 'compte' && <MonCompteTab />}
      </main>
    </div>
  );
}
