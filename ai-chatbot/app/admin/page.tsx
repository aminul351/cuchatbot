'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signOut } from '@/lib/auth';
import { useAuth } from '../contexts/AuthContext';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

interface BackendUser {
  uid: string; email: string; displayName: string; photoURL: string;
  role: string; messageCount: number; faculty: string;
  createdAt: string; lastLogin: string;
}

interface BackendChat {
  _id: string; userId: string; title: string;
  messages: { role: string; content: string }[];
  faculty: string | null;
  createdAt: string; updatedAt: string;
}

async function getToken() {
  return await auth.currentUser?.getIdToken();
}

async function api(path: string, options?: RequestInit) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<'users' | 'chats' | 'overview'>('overview');
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [chats, setChats] = useState<BackendChat[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setFetching(true);
      try {
        setError('');
        const [usersRes, chatsRes] = await Promise.all([
          api('/api/admin/users'),
          api('/api/admin/chats'),
        ]);
        if (usersRes.success) setUsers(usersRes.users);
        if (chatsRes.success) setChats(chatsRes.chats);
      } catch (e: any) { setError(e.message); console.error(e); }
      finally { setFetching(false); }
    })();
  }, [user]);

  async function deleteUser(uid: string) {
    if (!confirm('Delete this user and all their chats?')) return;
    await api(`/api/admin/user/${uid}`, { method: 'DELETE' });
    setUsers(users.filter((u) => u.uid !== uid));
    setChats(chats.filter((c) => c.userId !== uid));
  }

  if (loading || !user) return <Loader />;

  const isAdmin = users.find((u) => u.uid === user.uid)?.role === 'admin';
  if (!isAdmin && users.length > 0 && !fetching) {
    router.replace('/dashboard');
    return null;
  }

  async function toggleRole(uid: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change this user's role to "${newRole}"?`)) return;
    await api(`/api/admin/user/${uid}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: newRole }),
    });
    setUsers(users.map((u) => (u.uid === uid ? { ...u, role: newRole } : u)));
  }

  const userEmailMap = Object.fromEntries(users.map((u) => [u.uid, u.email]));

  const filteredUsers = users.filter((u) =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.displayName?.toLowerCase().includes(search.toLowerCase())
  );
  const totalMsgs = users.reduce((s, u) => s + (u.messageCount ?? 0), 0);
  const today = new Date().toDateString();
  const activeToday = users.filter((u) => u.lastLogin && new Date(u.lastLogin).toDateString() === today).length;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ee', fontFamily: 'sans-serif' }}>
      <header className="admin-header" style={{ background: 'linear-gradient(135deg,#1a4731,#0d2e1f)', borderBottom: '3px solid #c9a84c', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #c9a84c', overflow: 'hidden', flexShrink: 0 }}>
          <img src="https://cu.ac.bd/wp-content/uploads/2021/12/logo1.png" alt="CU" style={{ width: 30, height: 30, objectFit: 'contain' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div>
          <h1 style={{ color: '#c9a84c', fontSize: '1rem', fontWeight: 700, fontFamily: 'Georgia,serif' }}>Admin Dashboard</h1>
          <p style={{ color: '#a8c5b0', fontSize: '0.7rem', letterSpacing: '0.05em' }}>University of Chittagong AI Assistant</p>
        </div>
        <div className="admin-header-actions" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="admin-user-name" style={{ color: '#a8c5b0', fontSize: '0.75rem' }}>{user.displayName || user.email}</span>
          <button onClick={async () => { await signOut(); router.replace('/login'); }}
            style={{ padding: '6px 12px', background: 'rgba(201,168,76,0.15)', border: '1px solid #c9a84c55', borderRadius: 8, color: '#c9a84c', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}>
            Sign Out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 12px' }}>
        {/* Tabs */}
        <div className="admin-nav" style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['overview', 'users', 'chats'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #c9a84c44', background: tab === t ? '#1a4731' : '#fff', color: tab === t ? '#f5f3ee' : '#1a4731', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' as const }}>
              {t === 'overview' ? '📊 Overview' : t} {t === 'users' ? `(${users.length})` : t === 'chats' ? `(${chats.length})` : ''}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="admin-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { icon: '👥', value: users.length, label: 'Total Users', color: '#1a4731' },
            { icon: '🟢', value: activeToday, label: 'Active Today', color: '#059669' },
            { icon: '💬', value: totalMsgs, label: 'Total Messages', color: '#c9a84c' },
            { icon: '🔐', value: users.filter((u) => u.role === 'admin').length, label: 'Admins', color: '#7c3aed' },
          ].map((s) => (
            <div key={s.label} style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid #e2ddd6', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 18px', marginBottom: 20, color: '#dc2626', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Users Tab */}
        {tab === 'users' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' as const, gap: 12 }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>Registered Users</h2>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..."
                className="search-input" style={{ padding: '8px 14px', border: '1.5px solid #c9a84c66', borderRadius: 8, outline: 'none', fontSize: '0.85rem', width: 240, background: '#fafaf8', color: '#1a1a1a', maxWidth: '100%' }} />
            </div>
            {fetching ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading users...</div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No users found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e2ddd6' }}>
                      {['User', 'Email', 'Role', 'Messages', 'Joined', 'Last Login', 'Admin', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u, i) => (
                      <tr key={u.uid} style={{ borderBottom: i < filteredUsers.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {u.photoURL
                              ? <img src={u.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                              : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a4731', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c', fontWeight: 700, fontSize: '0.85rem' }}>{(u.displayName || u.email || '?')[0].toUpperCase()}</div>
                            }
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' }}>{u.displayName || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.83rem', color: '#374151' }}>{u.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: u.role === 'admin' ? '#7c3aed1a' : '#1a47311a', color: u.role === 'admin' ? '#7c3aed' : '#1a4731' }}>
                            {(u.role ?? 'USER').toUpperCase()}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '0.83rem', color: '#374151', textAlign: 'center' }}>{u.messageCount ?? 0}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#6b7280' }}>{u.createdAt ? fmt(new Date(u.createdAt)) : '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: '0.78rem', color: '#6b7280' }}>{u.lastLogin ? fmt(new Date(u.lastLogin)) : '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => toggleRole(u.uid, u.role)}
                            style={{ padding: '4px 10px', background: u.role === 'admin' ? '#6b7280' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer' }}>
                            {u.role === 'admin' ? 'Revoke' : 'Make Admin'}
                          </button>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <button onClick={() => deleteUser(u.uid)}
                            style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 5, fontSize: '0.72rem', cursor: 'pointer' }}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Chats Tab */}
        {tab === 'chats' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>All Chats ({chats.length})</h2>
            </div>
            {fetching ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading chats...</div>
            ) : chats.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>No chats found.</div>
            ) : (
              chats.slice(0, 50).map((c, i) => (
                <div key={c._id} style={{ padding: '12px 20px', borderBottom: i < Math.min(chats.length, 50) - 1 ? '1px solid #f0ede8' : 'none' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' }}>{c.title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                    User: {userEmailMap[c.userId] || c.userId.slice(0, 12)+'...'} | Messages: {c.messages?.length || 0} | Last: {c.updatedAt ? fmt(new Date(c.updatedAt)) : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Overview Tab */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Messages per User Chart */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>Messages per User</h2>
              </div>
              {fetching ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
              ) : (
                <div style={{ padding: '20px' }}>
                  {(() => {
                    const top = [...users].sort((a, b) => (b.messageCount || 0) - (a.messageCount || 0)).slice(0, 10);
                    const max = Math.max(...top.map((u) => u.messageCount || 0), 1);
                    return top.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#6b7280', fontSize: '0.85rem' }}>No message data yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {top.map((u) => (
                          <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 160, fontSize: '0.78rem', color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{u.displayName || u.email || 'Unknown'}</span>
                            <div style={{ flex: 1, height: 26, background: '#f0ede8', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                              <div style={{ width: `${((u.messageCount || 0) / max) * 100}%`, minWidth: u.messageCount ? 4 : 0, height: '100%', background: 'linear-gradient(90deg,#1a4731,#2d6b4f)', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, transition: 'width 0.4s' }}>
                                <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 600, whiteSpace: 'nowrap' }}>{u.messageCount || 0}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Chats per Day Chart */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>Chats Created (Last 14 Days)</h2>
              </div>
              {fetching ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
              ) : (
                <div style={{ padding: '20px' }}>
                  {(() => {
                    const dayMap: Record<string, number> = {};
                    const now = new Date();
                    for (let i = 13; i >= 0; i--) {
                      const d = new Date(now);
                      d.setDate(d.getDate() - i);
                      dayMap[d.toDateString()] = 0;
                    }
                    chats.forEach((c) => {
                      const key = new Date(c.createdAt).toDateString();
                      if (key in dayMap) dayMap[key]++;
                    });
                    const entries = Object.entries(dayMap);
                    const maxVal = Math.max(...Object.values(dayMap), 1);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 4px' }}>
                        {entries.map(([day, count]) => (
                          <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#1a4731' }}>{count || ''}</span>
                            <div style={{ width: '100%', height: `${(count / maxVal) * 100}%`, minHeight: count ? 4 : 0, background: 'linear-gradient(180deg,#c9a84c,#a68a3a)', borderRadius: '4px 4px 0 0', transition: 'height 0.4s' }} />
                            <span style={{ fontSize: '0.55rem', color: '#6b7280', writingMode: 'vertical-lr', textOrientation: 'mixed', transform: 'rotate(180deg)', marginTop: 2 }}>{day.slice(4, 10)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Users Registered Chart */}
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
              <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>Users Registered (Last 14 Days)</h2>
              </div>
              {fetching ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading...</div>
              ) : (
                <div style={{ padding: '20px' }}>
                  {(() => {
                    const dayMap: Record<string, number> = {};
                    const now = new Date();
                    for (let i = 13; i >= 0; i--) {
                      const d = new Date(now);
                      d.setDate(d.getDate() - i);
                      dayMap[d.toDateString()] = 0;
                    }
                    users.forEach((u) => {
                      const key = new Date(u.createdAt).toDateString();
                      if (key in dayMap) dayMap[key]++;
                    });
                    const entries = Object.entries(dayMap);
                    const maxVal = Math.max(...Object.values(dayMap), 1);
                    return (
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140, padding: '0 4px' }}>
                        {entries.map(([day, count]) => (
                          <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                            <span style={{ fontSize: '0.62rem', fontWeight: 600, color: '#059669' }}>{count || ''}</span>
                            <div style={{ width: '100%', height: `${(count / maxVal) * 100}%`, minHeight: count ? 4 : 0, background: 'linear-gradient(180deg,#059669,#047857)', borderRadius: '4px 4px 0 0', transition: 'height 0.4s' }} />
                            <span style={{ fontSize: '0.55rem', color: '#6b7280', writingMode: 'vertical-lr', textOrientation: 'mixed', transform: 'rotate(180deg)', marginTop: 2 }}>{day.slice(4, 10)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fmt(d: Date) { return d.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' }); }

function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ee' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div><p style={{ color: '#1a4731' }}>Loading admin panel...</p></div>
    </div>
  );
}
