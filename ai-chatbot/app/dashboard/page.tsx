'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from '@/lib/auth';
import { useAuth } from '../contexts/AuthContext';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

interface ChatSummary {
  _id: string;
  title: string;
  updatedAt: string;
  faculty: string | null;
}

interface FacultyItem {
  _id: string;
  name: string;
  slug: string;
  type: string;
}

interface BackendUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  messageCount: number;
  createdAt: string;
  lastLogin: string;
}

async function getToken() {
  return await auth.currentUser?.getIdToken();
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [faculties, setFaculties] = useState<FacultyItem[]>([]);
  const [tab, setTab] = useState<'profile' | 'history'>('profile');

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const token = await getToken();
        const [meRes, chatRes, facRes] = await Promise.all([
          fetch(`${BASE_URL}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_URL}/api/chat/history`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_URL}/api/faculty`),
        ]);
        const me = await meRes.json();
        const chats = await chatRes.json();
        const fac = await facRes.json();
        if (me.success) setProfile(me.user);
        if (chats.success) setChats(chats.chats);
        if (fac.success) setFaculties(fac.faculties);
      } catch (e) { console.error(e); }
    })();
  }, [user]);

  if (loading || !user) return <Loader text="Loading dashboard..." />;

  const name = profile?.displayName || user.displayName || user.email?.split('@')[0] || 'User';

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: 'sans-serif' }}>
      <header style={{ background: 'linear-gradient(135deg,#1a4731,#0d2e1f)', borderBottom: '3px solid #c9a84c', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <Logo />
        <div>
          <h1 style={{ color: '#c9a84c', fontSize: '1.05rem', fontWeight: 700, fontFamily: 'Georgia,serif' }}>My Dashboard</h1>
          <p style={{ color: '#a8c5b0', fontSize: '0.72rem', letterSpacing: '0.05em' }}>University of Chittagong AI Assistant</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Btn onClick={() => router.push('/')} gold>Open Chat</Btn>
          <Btn onClick={async () => { await signOut(); router.replace('/login'); }}>Sign Out</Btn>
        </div>
      </header>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 20px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['profile', 'history'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #c9a84c44', background: tab === t ? '#1a4731' : '#fff', color: tab === t ? '#f5f3ee' : '#1a4731', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer' }}>
              {t === 'profile' ? 'Profile' : 'Chat History'}
            </button>
          ))}
        </div>

        {tab === 'profile' && (
          <>
            <div style={{ background: '#fff', borderRadius: 18, padding: '28px', border: '1px solid #e2ddd6', boxShadow: '0 4px 16px rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' as const }}>
              <Avatar user={user} name={name} size={72} />
              <div>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1a1a1a', marginBottom: 4, fontFamily: 'Georgia,serif' }}>{name}</h2>
                <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>{user.email}</p>
                <span style={{ display: 'inline-block', marginTop: 6, padding: '3px 12px', borderRadius: 20, background: '#1a47311a', color: '#1a4731', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {(profile?.role ?? 'USER').toUpperCase()}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, marginBottom: 24 }}>
              {[
                { icon: '💬', value: profile?.messageCount ?? 0, label: 'Messages Sent' },
                { icon: '📅', value: profile?.createdAt ? fmt(new Date(profile.createdAt)) : '—', label: 'Member Since' },
                { icon: '🕒', value: profile?.lastLogin ? fmt(new Date(profile.lastLogin)) : '—', label: 'Last Active' },
                { icon: '🏛️', value: faculties.length, label: 'Faculties Available' },
              ].map((s) => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e2ddd6', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{s.icon}</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1a4731' }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', border: '1px solid #e2ddd6' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1a4731', marginBottom: 16, letterSpacing: '0.04em', textTransform: 'uppercase' as const }}>Quick Actions</h3>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
                {[
                  { label: 'Open Chatbot', fn: () => router.push('/') },
                  { label: 'cu.ac.bd', fn: () => window.open('https://cu.ac.bd', '_blank') },
                  { label: 'Notices', fn: () => window.open('https://cu.ac.bd/notices/', '_blank') },
                ].map((a) => (
                  <button key={a.label} onClick={a.fn}
                    style={{ padding: '9px 18px', background: '#f0ede8', border: '1px solid #c9a84c44', borderRadius: 9, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#1a4731' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#1a4731'; (e.currentTarget as HTMLButtonElement).style.color = '#f5f3ee'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#f0ede8'; (e.currentTarget as HTMLButtonElement).style.color = '#1a4731'; }}>
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'history' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>Chat History ({chats.length})</h2>
            </div>
            {chats.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No chats yet. Start a conversation!</div>
            ) : (
              chats.map((chat, i) => (
                <div key={chat._id} style={{ padding: '14px 20px', borderBottom: i < chats.length - 1 ? '1px solid #f0ede8' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1a1a1a' }}>{chat.title}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4 }}>
                      {chat.faculty && <span style={{ background: '#1a47311a', padding: '2px 8px', borderRadius: 4, marginRight: 8 }}>{chat.faculty}</span>}
                      {fmt(new Date(chat.updatedAt))}
                    </div>
                  </div>
                  <button onClick={() => router.push('/')}
                    style={{ padding: '6px 14px', background: '#1a4731', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                    Open
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(d: Date) { return d.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }); }

function Logo() {
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #c9a84c', overflow: 'hidden', flexShrink: 0 }}>
      <img src="https://cu.ac.bd/wp-content/uploads/2021/12/logo1.png" alt="CU" style={{ width: 34, height: 34, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
}

function Avatar({ user, name, size }: { user: any; name: string; size: number }) {
  return user.photoURL
    ? <img src={user.photoURL} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '3px solid #c9a84c', flexShrink: 0 }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: '#1a4731', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c', fontSize: size * 0.4, fontWeight: 800, border: '3px solid #c9a84c', flexShrink: 0 }}>{name[0].toUpperCase()}</div>;
}

function Btn({ children, onClick, gold }: { children: React.ReactNode; onClick: () => void; gold?: boolean }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 14px', background: gold ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.08)', border: `1px solid ${gold ? '#c9a84c55' : '#ffffff22'}`, borderRadius: 8, color: gold ? '#c9a84c' : '#f5f3ee', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}>
      {children}
    </button>
  );
}

function Loader({ text }: { text: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ee' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div><p style={{ color: '#1a4731' }}>{text}</p></div>
    </div>
  );
}
