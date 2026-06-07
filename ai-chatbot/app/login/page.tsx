'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithEmail, signUpWithEmail, signInWithGoogle, isAdmin } from '@/lib/auth';

// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      background: type === 'success' ? '#1a4731' : '#dc2626',
      color: '#f5f3ee', padding: '12px 20px', borderRadius: 12,
      fontSize: '0.88rem', fontFamily: 'sans-serif', fontWeight: 600,
      border: `1px solid ${type === 'success' ? '#c9a84c' : '#fca5a5'}`,
      boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      display: 'flex', alignItems: 'center', gap: 8,
      animation: 'slideIn 0.25s ease',
    }}>
      {type === 'success' ? '✅' : '⚠️'} {message}
    </div>
  );
}

// ── Field ────────────────────────────────────────────────────────────────────
function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '0.78rem', fontFamily: 'sans-serif', fontWeight: 600, color: '#1a4731', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
        {label}
      </label>
      <input
        type={type} value={value} placeholder={placeholder} required
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '10px 14px', border: '1.5px solid #c9a84c66', borderRadius: 9, outline: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem', background: '#fafaf8', color: '#1a1a1a', boxSizing: 'border-box' as const }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#1a4731')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#c9a84c66')}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  // If already logged in, redirect straight away
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setChecking(false);
      if (u) router.replace(isAdmin(u.email) ? '/admin' : '/');
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [router]);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  // After any successful sign-in/up, wait for Firebase state then navigate
  function redirectAfterAuth() {
    unsubRef.current?.(); // stop the initial listener
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsub();
        showToast(`Welcome${u.displayName ? ', ' + u.displayName.split(' ')[0] : ''}! 🎓`, 'success');
        setTimeout(() => router.replace(isAdmin(u.email) ? '/admin' : '/'), 900);
      }
    });
    // Fallback: if state never fires in 4s, use currentUser directly
    setTimeout(() => {
      const u = auth.currentUser;
      if (u) { unsub(); router.replace(isAdmin(u.email) ? '/admin' : '/'); }
      else { setError('Sign-in timed out. Please try again.'); setBusy(false); }
    }, 4000);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      mode === 'signup'
        ? await signUpWithEmail(email, password)
        : await signInWithEmail(email, password);
      redirectAfterAuth();
    } catch (err: any) {
      setError(friendly(err.code));
      showToast(friendly(err.code), 'error');
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setBusy(true);
    try {
      await signInWithGoogle();
      redirectAfterAuth();
    } catch (err: any) {
      setError(friendly(err.code));
      showToast(friendly(err.code), 'error');
      setBusy(false);
    }
  }

  if (checking) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg,#0d2e1f,#1a4731,#0d2e1f)' }}>
      <div style={{ textAlign: 'center', fontFamily: 'sans-serif', color: '#a8c5b0' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎓</div>
        Loading...
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg,#0d2e1f 0%,#1a4731 50%,#0d2e1f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', fontFamily: "'Georgia','Times New Roman',serif" }}>
      {toast && <Toast message={toast.message} type={toast.type} />}
      <div style={{ position: 'fixed', inset: 0, opacity: 0.04, backgroundImage: 'radial-gradient(circle,#c9a84c 1px,transparent 1px)', backgroundSize: '32px 32px', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 420, background: 'rgba(255,255,255,0.97)', borderRadius: 20, boxShadow: '0 24px 80px rgba(0,0,0,0.4),0 0 0 1px rgba(201,168,76,0.3)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg,#1a4731,#0d2e1f)', padding: '28px 32px 24px', textAlign: 'center', borderBottom: '3px solid #c9a84c' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#fff', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #c9a84c', overflow: 'hidden' }}>
            <img src="https://cu.ac.bd/wp-content/uploads/2021/12/logo1.png" alt="CU" style={{ width: 52, height: 52, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <h1 style={{ color: '#c9a84c', fontSize: '1.15rem', fontWeight: 700, marginBottom: 4 }}>চট্টগ্রাম বিশ্ববিদ্যালয়</h1>
          <p style={{ color: '#a8c5b0', fontSize: '0.78rem', fontFamily: 'sans-serif', letterSpacing: '0.06em' }}>UNIVERSITY OF CHITTAGONG · AI ASSISTANT</p>
        </div>

        {/* Body */}
        <div style={{ padding: '28px 32px 32px' }}>

          {/* Toggle */}
          <div style={{ display: 'flex', background: '#f0ede8', borderRadius: 10, padding: 4, marginBottom: 24 }}>
            {(['login', 'signup'] as const).map((m) => (
              <button key={m} onClick={() => { setMode(m); setError(''); }}
                style={{ flex: 1, padding: '8px 0', background: mode === m ? '#1a4731' : 'transparent', color: mode === m ? '#f5f3ee' : '#5a7a68', border: 'none', borderRadius: 7, fontFamily: 'sans-serif', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Google */}
          <button onClick={handleGoogle} disabled={busy}
            style={{ width: '100%', padding: '11px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#fff', border: '1.5px solid #e2ddd6', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif', fontSize: '0.88rem', fontWeight: 600, color: '#1a1a1a', marginBottom: 20, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.2l6.7-6.7C35.7 2.3 30.2 0 24 0 14.7 0 6.7 5.5 2.9 13.6l7.8 6.1C12.5 13.4 17.8 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4 6.9-9.9 7.1-17z"/>
              <path fill="#FBBC05" d="M10.7 28.5A14.6 14.6 0 0 1 9.5 24c0-1.6.3-3.1.8-4.5L2.5 13.4A24 24 0 0 0 0 24c0 3.9.9 7.5 2.5 10.7l8.2-6.2z"/>
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.2 1.5-5 2.4-8.4 2.4-6.2 0-11.5-4-13.3-9.3l-7.8 6c3.8 7.7 11.6 12.5 21.1 12.5z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: '#e2ddd6' }} />
            <span style={{ color: '#9ca3af', fontSize: '0.75rem', fontFamily: 'sans-serif' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e2ddd6' }} />
          </div>

          {/* Form */}
          <form onSubmit={handleEmail} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
            <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="Min. 6 characters" />
            {mode === 'signup' && <Field label="Confirm Password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter password" />}

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', color: '#dc2626', fontSize: '0.82rem', fontFamily: 'sans-serif' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={busy}
              style={{ width: '100%', padding: '12px', background: busy ? '#9ca3af' : 'linear-gradient(135deg,#1a4731,#0d2e1f)', color: '#f5f3ee', border: '1px solid #c9a84c44', borderRadius: 10, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif', fontSize: '0.92rem', fontWeight: 700, marginTop: 4 }}>
              {busy ? '⏳ Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'sans-serif' }}>
            University of Chittagong · Secure Login
          </p>
        </div>
      </div>
      <style>{`@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}

function friendly(code: string) {
  const m: Record<string, string> = {
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/email-already-in-use': 'Email already registered. Try signing in.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many attempts. Please wait.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return m[code] ?? `Error: ${code}`;
}