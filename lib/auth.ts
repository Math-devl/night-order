const KEY = 'night_order_session';

export interface EmployeeSession {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  is_admin: boolean;
}

export function getSession(): EmployeeSession | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch { return null; }
}

export function setSession(employee: EmployeeSession) {
  localStorage.setItem(KEY, JSON.stringify(employee));
}

export function clearSession() {
  localStorage.removeItem(KEY);
}
