'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  onLogin: () => void;
  onAccessDenied?: (msg: string) => void;
  accessDeniedError?: string | null;
}

export default function AdminLoginScreen({ onLogin, onAccessDenied, accessDeniedError }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(accessDeniedError ?? null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !data.user) {
      setError('Email ou mot de passe incorrect.');
      setLoading(false);
      return;
    }

    // Vérifie que l'utilisateur est bien un admin
    const { data: employee } = await supabase
      .from('employees')
      .select('is_admin')
      .eq('email', data.user.email)
      .eq('is_admin', true)
      .maybeSingle();

    if (!employee) {
      onAccessDenied?.('Accès refusé. Ce compte n\'a pas les droits administrateur.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    onLogin();
  };

  return (
    <div className="min-h-screen bg-[#FFF0F5] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍔</div>
          <h1 className="text-2xl font-bold text-[#1A1209]">Night Order</h1>
          <p className="text-[#A0909A] text-sm mt-1">Interface administrateur</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Adresse e-mail</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              placeholder="admin@exemple.com"
            />
          </div>

          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1.5">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-3 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#FF4D8A] text-white font-bold text-sm hover:bg-[#E03070] disabled:opacity-50 transition-colors"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}
