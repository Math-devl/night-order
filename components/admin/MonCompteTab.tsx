'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { updateEmployeeCode } from '@/lib/db';
import { enablePushNotifications, registerServiceWorker } from '@/lib/push';

const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function MonCompteTab() {
  const [email, setEmail] = useState('');
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  const [pwStep, setPwStep] = useState<'idle' | 'form'>('idle');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);

  const [codeStep, setCodeStep] = useState<'idle' | 'input'>('idle');
  const [newCode, setNewCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeSuccess, setCodeSuccess] = useState(false);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);

  useEffect(() => {
    registerServiceWorker().catch(() => {});
    if ('Notification' in window) setNotifPermission(Notification.permission);

    supabase.auth.getUser().then(({ data }) => {
      const userEmail = data.user?.email ?? '';
      setEmail(userEmail);
      if (userEmail) {
        supabase.from('employees').select('id').eq('email', userEmail).maybeSingle()
          .then(({ data: emp }) => { if (emp) setEmployeeId(emp.id); });
      }
    });
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { setPwError('8 caractères minimum.'); return; }
    if (newPw !== confirmPw) { setPwError('Les mots de passe ne correspondent pas.'); return; }
    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setPwError(error.message); setPwLoading(false); return; }
    setPwSuccess(true);
    setPwLoading(false);
  };

  const pressCode = async (key: string) => {
    if (codeLoading) return;
    if (key === '⌫') { setNewCode(v => v.slice(0, -1)); setCodeError(null); return; }
    if (key === '' || newCode.length >= 4) return;
    const next = newCode + key;
    setNewCode(next);
    setCodeError(null);
    if (next.length === 4 && employeeId) {
      setCodeLoading(true);
      const { error } = await updateEmployeeCode(employeeId, next);
      if (error) { setCodeError(error); setCodeLoading(false); return; }
      setCodeSuccess(true);
      setCodeLoading(false);
    }
  };

  const handleEnableNotifications = async () => {
    if (!employeeId) return;
    setNotifLoading(true);
    await enablePushNotifications(employeeId);
    if ('Notification' in window) setNotifPermission(Notification.permission);
    setNotifLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FF4D8A]/20 border border-[#FF4D8A]/30 flex items-center justify-center text-xl font-bold text-[#FF4D8A]">
            {email ? email[0].toUpperCase() : '?'}
          </div>
          <div>
            <p className="text-white font-bold">Administrateur</p>
            <p className="text-[#8BA870] text-sm">{email}</p>
          </div>
        </div>
      </div>

      {/* Mot de passe */}
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-5">
        <h3 className="text-white font-bold mb-3">Mot de passe admin</h3>
        {pwStep === 'idle' && !pwSuccess && (
          <button onClick={() => setPwStep('form')}
            className="w-full text-left text-[#C8D4B0] text-sm bg-[#496035] rounded-xl px-4 py-3 hover:bg-[#3D4E2B] transition-colors flex items-center justify-between">
            Changer mon mot de passe <span className="text-[#8BA870]">→</span>
          </button>
        )}
        {pwStep === 'form' && !pwSuccess && (
          <form onSubmit={handleChangePassword} className="space-y-3">
            {pwError && <p className="text-red-400 text-sm">{pwError}</p>}
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required
              autoComplete="new-password" placeholder="Nouveau mot de passe (8 min.)"
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-2.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required
              autoComplete="new-password" placeholder="Confirmer"
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-xl px-4 py-2.5 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setPwStep('idle'); setNewPw(''); setConfirmPw(''); setPwError(null); }}
                className="flex-1 py-2 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm hover:bg-[#496035]">Annuler</button>
              <button type="submit" disabled={pwLoading}
                className="flex-1 py-2 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold disabled:opacity-50">
                {pwLoading ? 'En cours…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        )}
        {pwSuccess && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <span>✓</span> Mot de passe modifié
            <button onClick={() => { setPwStep('idle'); setNewPw(''); setConfirmPw(''); setPwSuccess(false); }}
              className="ml-auto text-[#8BA870] text-xs underline">Modifier à nouveau</button>
          </div>
        )}
      </div>

      {/* Code 4 chiffres */}
      {employeeId && (
        <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-5">
          <h3 className="text-white font-bold mb-3">Code d'accès app mobile</h3>
          {codeStep === 'idle' && !codeSuccess && (
            <button onClick={() => setCodeStep('input')}
              className="w-full text-left text-[#C8D4B0] text-sm bg-[#496035] rounded-xl px-4 py-3 hover:bg-[#3D4E2B] transition-colors flex items-center justify-between">
              Changer mon code à 4 chiffres <span className="text-[#8BA870]">→</span>
            </button>
          )}
          {codeStep === 'input' && !codeSuccess && (
            <div>
              <button onClick={() => { setCodeStep('idle'); setNewCode(''); setCodeError(null); }}
                className="text-[#FF4D8A] text-sm font-semibold mb-4 block">← Annuler</button>
              <p className="text-[#C8D4B0] text-sm mb-3 text-center">Nouveau code à 4 chiffres</p>
              <div className="flex gap-3 justify-center mb-4">
                {[0,1,2,3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full border-2 ${i < newCode.length ? 'bg-[#FF4D8A] border-[#FF4D8A]' : 'border-[#6B7A50]'}`} />
                ))}
              </div>
              {codeError && <p className="text-red-400 text-sm text-center mb-2">{codeError}</p>}
              {codeLoading && <p className="text-[#8BA870] text-sm text-center mb-2">Enregistrement…</p>}
              <div className="grid grid-cols-3 gap-2">
                {PAD.map((key, i) => (
                  key === '' ? <div key={i} /> : (
                    <button key={i} onClick={() => pressCode(key)}
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
          {codeSuccess && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>✓</span> Code modifié
              <button onClick={() => { setCodeStep('idle'); setNewCode(''); setCodeSuccess(false); }}
                className="ml-auto text-[#8BA870] text-xs underline">Modifier à nouveau</button>
            </div>
          )}
        </div>
      )}

      {/* Notifications */}
      {notifPermission !== null && (
        <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-5">
          <h3 className="text-white font-bold mb-3">Notifications</h3>
          {notifPermission === 'granted' ? (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <span>🔔</span> Notifications activées
            </div>
          ) : notifPermission === 'denied' ? (
            <p className="text-[#8BA870] text-sm">🔕 Notifications bloquées — autorise-les dans les réglages de ton navigateur.</p>
          ) : (
            <button onClick={handleEnableNotifications} disabled={notifLoading || !employeeId}
              className="w-full text-left text-[#C8D4B0] text-sm bg-[#496035] rounded-xl px-4 py-3 hover:bg-[#3D4E2B] transition-colors flex items-center justify-between disabled:opacity-50">
              {notifLoading ? 'En cours…' : '🔔 Activer les notifications'} <span className="text-[#8BA870]">→</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
