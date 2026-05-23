'use client';

import { useState } from 'react';
import HistoriqueSection from './HistoriqueSection';
import ParametresSection from './ParametresSection';
import DashboardSection from './DashboardSection';
import EmployesTab from './EmployesTab';

type AdminTab = 'dashboard' | 'historique' | 'employes' | 'parametres';

export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('historique');

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
          <a href="/mobile" className="text-[#FF4D8A] text-sm font-semibold hover:underline whitespace-nowrap">
            → App commandes
          </a>
        </div>

        <div className="max-w-6xl mx-auto px-2 sm:px-6 flex gap-0 overflow-x-auto scrollbar-none">
          {([
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'historique', label: 'Historique' },
            { id: 'employes', label: 'Employés' },
            { id: 'parametres', label: 'Paramètres' },
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
      </main>
    </div>
  );
}
