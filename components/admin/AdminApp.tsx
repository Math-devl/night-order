'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import AdminLoginScreen from './AdminLoginScreen';
import HistoriqueSection from './HistoriqueSection';
import ParametresSection from './ParametresSection';
import DashboardSection from './DashboardSection';
import EmployesTab from './EmployesTab';

function SetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    onDone();
  };

  return (
    <div className="min-h-screen bg-[#FFF0F5] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍔</div>
          <h1 className="text-2xl font-bold text-[#1A1209]">Night Order</h1>
          <p className="text-[#A0909A] text-sm mt-1">Créer ton mot de passe admin</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 space-y-4">
          {error && <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}
          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Nouveau mot de passe</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              placeholder="8 caractères minimum" />
          </div>
          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Confirmer le mot de passe</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl bg-[#FF4D8A] text-white font-bold text-sm hover:bg-[#E03070] disabled:opacity-50 transition-colors">
            {loading ? 'Enregistrement…' : 'Définir mon mot de passe →'}
          </button>
        </form>
      </div>
    </div>
  );
}

type AdminTab = 'dashboard' | 'historique' | 'employes' | 'parametres';

export default function AdminApp() {
  const [tab, setTab] = useState<AdminTab>('historique');
  const [session, setSession] = useState<'loading' | 'loggedIn' | 'loggedOut' | 'settingPassword'>('loading');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ? 'loggedIn' : 'loggedOut');
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      console.log('[auth]', event, !!s);
      if (event === 'SIGNED_OUT') {
        setSession('loggedOut');
      } else if (event === 'PASSWORD_RECOVERY' || event === 'USER_UPDATED') {
        setSession(event === 'PASSWORD_RECOVERY' ? 'settingPassword' : 'loggedIn');
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

  if (session === 'settingPassword') {
    return <SetPasswordScreen onDone={() => setSession('loggedIn')} />;
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
