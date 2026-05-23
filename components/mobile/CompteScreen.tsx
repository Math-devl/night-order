'use client';

import { useState } from 'react';
import { EmployeeSession, clearSession } from '@/lib/auth';
import { updateEmployeeCode } from '@/lib/db';

interface Props {
  session: EmployeeSession;
  onLogout: () => void;
}

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function CompteScreen({ session, onLogout }: Props) {
  const [step, setStep] = useState<'idle' | 'change'>('idle');
  const [newCode, setNewCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  const press = async (key: string) => {
    if (saving) return;
    if (key === '⌫') { setNewCode(v => v.slice(0, -1)); setError(null); return; }
    if (key === '' || newCode.length >= 4) return;
    const next = newCode + key;
    setNewCode(next);
    setError(null);
    if (next.length === 4) {
      setSaving(true);
      const { error: err } = await updateEmployeeCode(session.id, next);
      if (err) { setError(err); setSaving(false); return; }
      setSuccess(true);
      setSaving(false);
    }
  };

  const resetChange = () => { setStep('idle'); setNewCode(''); setError(null); setSuccess(false); };

  return (
    <div className="pb-28 px-4 pt-6">
      <h1 className="text-2xl font-bold text-[#1A1209] mb-6">Mon compte</h1>

      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-5 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FF4D8A]/20 border border-[#FF4D8A]/30 flex items-center justify-center text-xl font-bold text-[#FF4D8A]">
            {session.first_name[0]}{session.last_name[0]}
          </div>
          <div>
            <p className="text-white font-bold">{session.first_name} {session.last_name}</p>
            {session.email && <p className="text-[#8BA870] text-sm">{session.email}</p>}
          </div>
        </div>
      </div>

      {step === 'idle' && (
        <div className="space-y-3">
          {session.is_admin && (
            <a href="/admin"
              className="w-full bg-[#FF4D8A]/10 border border-[#FF4D8A]/30 rounded-2xl p-4 flex items-center justify-between hover:bg-[#FF4D8A]/20 transition-colors">
              <div>
                <p className="text-[#FF4D8A] font-semibold text-sm">Interface admin</p>
                <p className="text-[#A0909A] text-xs mt-0.5">Dashboard, historique, paramètres</p>
              </div>
              <span className="text-[#FF4D8A]">→</span>
            </a>
          )}

          <button onClick={() => setStep('change')}
            className="w-full bg-[#596643] border border-[#6B7A50] rounded-2xl p-4 text-left flex items-center justify-between hover:bg-[#496035] transition-colors">
            <div>
              <p className="text-white font-semibold text-sm">Changer mon code</p>
              <p className="text-[#8BA870] text-xs mt-0.5">Modifier mon code d'accès à 4 chiffres</p>
            </div>
            <span className="text-[#8BA870]">→</span>
          </button>

          <button onClick={() => { clearSession(); onLogout(); }}
            className="w-full bg-red-500/10 border border-red-400/30 rounded-2xl p-4 text-left flex items-center justify-between hover:bg-red-500/20 transition-colors">
            <p className="text-red-400 font-semibold text-sm">Se déconnecter</p>
            <span className="text-red-400/60">→</span>
          </button>
        </div>
      )}

      {step === 'change' && !success && (
        <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-5">
            <button onClick={resetChange} className="text-[#FF4D8A] text-sm font-semibold">← Retour</button>
            <h2 className="text-white font-bold">Nouveau code</h2>
          </div>

          <div className="mb-6">
            <p className="text-[#C8D4B0] text-sm mb-3 text-center">Saisis ton nouveau code à 4 chiffres</p>
            <div className="flex gap-3 justify-center">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < newCode.length ? 'bg-[#FF4D8A] border-[#FF4D8A]' : 'border-[#6B7A50]'}`} />
              ))}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center mb-3">{error}</p>}
          {saving && <p className="text-[#8BA870] text-sm text-center mb-3">Enregistrement…</p>}

          <div className="grid grid-cols-3 gap-2">
            {PAD.map((key, i) => (
              key === '' ? <div key={i} /> : (
                <button key={i} onClick={() => press(key)}
                  className={`h-12 rounded-xl text-lg font-bold transition-all active:scale-95 ${
                    key === '⌫' ? 'text-[#A0909A]' : 'bg-[#496035] text-white active:bg-[#3D4E2B]'
                  }`}>
                  {key}
                </button>
              )
            ))}
          </div>
        </div>
      )}

      {success && (
        <div className="text-center py-8">
          <div className="text-5xl mb-3">✅</div>
          <p className="text-[#1A1209] font-bold text-lg">Code modifié !</p>
          <button onClick={resetChange} className="mt-4 text-[#FF4D8A] text-sm font-semibold">Retour</button>
        </div>
      )}
    </div>
  );
}
