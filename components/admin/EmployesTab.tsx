'use client';

import { useEffect, useState, useCallback } from 'react';
import { Employee } from '@/lib/types';
import { fetchEmployees, upsertEmployee, deleteEmployee } from '@/lib/db';

function generateCode(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function EmployeeModal({ initial, onSave, onClose }: {
  initial: Partial<Employee>;
  onSave: (code: string, firstName: string, email?: string) => void;
  onClose: () => void;
}) {
  const isNew = !initial.id;
  const [firstName, setFirstName] = useState(initial.first_name ?? '');
  const [lastName, setLastName] = useState(initial.last_name ?? '');
  const [email, setEmail] = useState(initial.email ?? '');
  const [isAdmin, setIsAdmin] = useState(initial.is_admin ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) { setError('Prénom et nom obligatoires.'); return; }
    setSaving(true);
    const code = isNew ? generateCode() : initial.access_code!;
    const { error: err } = await upsertEmployee({
      ...(initial.id ? { id: initial.id } : {}),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim(),
      is_admin: isAdmin,
      ...(isNew ? { access_code: code, is_active: true } : {}),
    });
    if (err) { setError(err); setSaving(false); return; }
    onSave(code, firstName.trim(), email.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-[#596643] border border-[#6B7A50] rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h3 className="text-white font-bold text-lg mb-4">{isNew ? 'Ajouter' : 'Modifier'} un employé</h3>
        {error && <div className="bg-red-100 border border-red-300 text-red-600 text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[#C8D4B0] text-sm block mb-1">Prénom</label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)}
                className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-[#C8D4B0] text-sm block mb-1">Nom</label>
              <input value={lastName} onChange={e => setLastName(e.target.value)}
                className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
            </div>
          </div>
          <div>
            <label className="text-[#C8D4B0] text-sm block mb-1">Adresse e-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#FFF0F5] text-[#1A1209] rounded-lg px-3 py-2 border border-[#496035] focus:border-[#FF4D8A] focus:outline-none text-sm" />
          </div>
          <button
            type="button"
            onClick={() => setIsAdmin(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${isAdmin ? 'bg-[#FF4D8A]/10 border-[#FF4D8A]/40' : 'border-[#6B7A50] hover:bg-[#496035]'}`}
          >
            <div className="text-left">
              <p className={`text-sm font-semibold ${isAdmin ? 'text-[#FF4D8A]' : 'text-[#C8D4B0]'}`}>Administrateur</p>
              <p className="text-[#8BA870] text-xs">Accès à l'interface admin</p>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${isAdmin ? 'bg-[#FF4D8A]' : 'bg-[#496035]'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${isAdmin ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
          {isNew && (
            <p className="text-[#8BA870] text-xs bg-[#496035] rounded-xl px-3 py-2">
              Un code à 4 chiffres sera généré automatiquement à la création.
            </p>
          )}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#6B7A50] text-[#C8D4B0] text-sm hover:bg-[#496035]">Annuler</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#FF4D8A] text-white text-sm font-bold hover:bg-[#E03070] disabled:opacity-50">
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function EmployesTab() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modal, setModal] = useState<Partial<Employee> | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  useEffect(() => { fetchEmployees().then(setEmployees); }, [tick]);

  const handleSave = async (code: string, firstName: string, email?: string | undefined) => {
    setModal(null);
    refresh();
    if (!code || modal?.id) return;

    let emailSent = false;
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, first_name: firstName, code }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error('[send-invite] HTTP', res.status, body);
      }
    } catch (e) {
      console.error('[send-invite] fetch error:', e);
    }
    setToast(emailSent
      ? { ok: true, msg: 'Invitation envoyée par mail.' }
      : { ok: false, msg: 'Employé créé, mais le mail n\'a pas pu être envoyé.' }
    );
    setTimeout(() => setToast(null), 4000);
  };

  const handleResetCode = async (e: Employee) => {
    const code = generateCode();
    await upsertEmployee({ id: e.id, access_code: code });
    refresh();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-[#1A1209] font-bold text-lg">Employés</h3>
          <p className="text-[#C4A8B5] text-sm">{employees.length} employé{employees.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal({})}
          className="bg-[#FF4D8A] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#E03070]">
          + Ajouter
        </button>
      </div>

      {employees.length === 0 && (
        <p className="text-[#C4A8B5] text-sm italic text-center py-8">Aucun employé enregistré.</p>
      )}

      <div className="space-y-3">
        {employees.map(e => (
          <div key={e.id} className={`border rounded-xl p-4 ${e.is_active ? 'bg-[#596643] border-[#6B7A50]' : 'bg-[#3D4E2B] border-[#496035] opacity-60'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white font-bold">{e.first_name} {e.last_name}</span>
                  {!e.is_active && <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-400/30 px-1.5 py-0.5 rounded-full font-bold">Inactif</span>}
                </div>
                {e.email && <p className="text-[#8BA870] text-xs mb-1">✉ {e.email}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[#C8D4B0] text-xs">Code :</span>
                  <span className="text-[#FF4D8A] font-bold text-lg tracking-widest">{e.access_code}</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                <button onClick={() => setModal(e)} className="text-xs px-2.5 py-1 rounded-lg border border-[#6B7A50] text-[#C8D4B0] hover:text-white transition-colors">
                  Modifier
                </button>
                <button onClick={() => handleResetCode(e)} className="text-xs px-2.5 py-1 rounded-lg border border-[#F5EFA0]/40 text-[#F5EFA0] hover:bg-[#496035] transition-colors">
                  Nouveau code
                </button>
                <button onClick={async () => { await upsertEmployee({ id: e.id, is_active: !e.is_active }); refresh(); }}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${e.is_active ? 'border-red-400/40 text-red-400' : 'border-green-400/40 text-green-400'}`}>
                  {e.is_active ? 'Désactiver' : 'Activer'}
                </button>
                <button onClick={async () => { if (confirm('Supprimer ?')) { await deleteEmployee(e.id); refresh(); } }}
                  className="text-xs px-2.5 py-1 rounded-lg border border-[#6B7A50] text-[#8BA870] hover:text-red-400 transition-colors">✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modal !== null && (
        <EmployeeModal
          initial={modal}
          onSave={(code, firstName, email) => handleSave(code, firstName, email)}
          onClose={() => setModal(null)}
        />
      )}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg text-sm font-semibold z-50 ${toast.ok ? 'bg-green-600 text-white' : 'bg-yellow-500 text-white'}`}>
          {toast.ok ? '✓ ' : '⚠ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
