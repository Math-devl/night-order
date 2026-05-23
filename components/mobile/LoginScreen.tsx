'use client';

import { useState } from 'react';
import { verifyCode } from '@/lib/db';
import { setSession } from '@/lib/auth';

interface Props {
  onLogin: () => void;
}

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function LoginScreen({ onLogin }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const press = async (key: string) => {
    if (checking) return;
    if (key === '⌫') { setCode(c => c.slice(0, -1)); setError(false); return; }
    if (key === '') return;
    const next = code + key;
    setCode(next);
    setError(false);
    if (next.length === 4) {
      setChecking(true);
      const employee = await verifyCode(next);
      if (employee) {
        setSession({ id: employee.id, first_name: employee.first_name, last_name: employee.last_name, email: employee.email, is_admin: employee.is_admin ?? false });
        onLogin();
      } else {
        setError(true);
        setCode('');
      }
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF0F5] flex flex-col items-center justify-center px-8">
      <div className="text-5xl mb-4">🍔</div>
      <h1 className="text-2xl font-bold text-[#1A1209] mb-1">Night Order</h1>
      <p className="text-[#A0909A] text-sm mb-10">Saisis ton code d'accès</p>

      {/* Points indicateurs */}
      <div className="flex gap-4 mb-3">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${
            i < code.length
              ? error ? 'bg-red-400 border-red-400' : 'bg-[#FF4D8A] border-[#FF4D8A]'
              : 'border-[#C4A8B5] bg-transparent'
          }`} />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-3 font-medium">Code incorrect, réessaie.</p>}
      {checking && <p className="text-[#8BA870] text-sm mb-3">Vérification…</p>}
      {!error && !checking && <div className="h-6 mb-3" />}

      {/* Pavé numérique */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
        {PAD.map((key, i) => (
          key === '' ? (
            <div key={i} />
          ) : (
            <button
              key={i}
              onClick={() => press(key)}
              className={`h-16 rounded-2xl text-xl font-bold transition-all active:scale-95 ${
                key === '⌫'
                  ? 'text-[#A0909A] bg-transparent'
                  : 'bg-[#596643] text-white shadow-sm active:bg-[#496035]'
              }`}
            >
              {key}
            </button>
          )
        ))}
      </div>
    </div>
  );
}
