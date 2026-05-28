'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SetupScreen() {
  const [email, setEmailState] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') && session?.user.email) {
        setEmailState(session.user.email);
        setReady(true);
      }
    });
    // Au cas où la session est déjà active (rafraîchissement de page)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user.email) {
        setEmailState(data.session.user.email);
        setReady(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('8 caractères minimum.'); return; }
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    router.push('/admin');
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#FFF0F5] flex items-center justify-center">
        <p className="text-[#A0909A] text-sm">Vérification du lien…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF0F5] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍔</div>
          <h1 className="text-2xl font-bold text-[#1A1209]">Night Order</h1>
          <p className="text-[#A0909A] text-sm mt-1">Créer ton accès administrateur</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Adresse e-mail</label>
            <input
              type="email"
              value={email}
              readOnly
              className="w-full bg-[#496035] text-[#8BA870] rounded-xl px-4 py-3 border border-[#496035] text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              placeholder="8 caractères minimum"
            />
          </div>

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#FF4D8A] text-white font-bold text-sm hover:bg-[#E03070] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enregistrement…' : 'Créer mon mot de passe →'}
          </button>
        </form>
      </div>
    </div>
  );
}
