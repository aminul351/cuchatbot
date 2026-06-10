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

interface BackendFaculty {
  _id: string; name: string; slug: string; type: string;
  description: string; departments: string[];
  teachers: { name: string; designation: string; email: string }[];
  createdAt: string;
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
  const [tab, setTab] = useState<'users' | 'chats' | 'faculty'>('users');
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [chats, setChats] = useState<BackendChat[]>([]);
  const [faculties, setFaculties] = useState<BackendFaculty[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [editingFaculty, setEditingFaculty] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BackendFaculty>>({});

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
        const [usersRes, chatsRes, facRes] = await Promise.all([
          api('/api/admin/users'),
          api('/api/admin/chats'),
          api('/api/admin/faculty'),
        ]);
        if (usersRes.success) setUsers(usersRes.users);
        if (chatsRes.success) setChats(chatsRes.chats);
        if (facRes.success) setFaculties(facRes.faculties);
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

  async function saveFaculty(slug: string) {
    await api(`/api/admin/faculty/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editData),
    });
    setEditingFaculty(null);
    const facRes = await api('/api/admin/faculty');
    if (facRes.success) setFaculties(facRes.faculties);
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
          {(['users', 'chats', 'faculty'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #c9a84c44', background: tab === t ? '#1a4731' : '#fff', color: tab === t ? '#f5f3ee' : '#1a4731', fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' as const }}>
              {t} {t === 'users' ? `(${users.length})` : t === 'chats' ? `(${chats.length})` : `(${faculties.length})`}
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
                    User: {userEmailMap[c.userId] || c.userId.slice(0, 12)+'...'} | Faculty: {c.faculty || 'N/A'} | Messages: {c.messages?.length || 0} | Last: {c.updatedAt ? fmt(new Date(c.updatedAt)) : ''}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Faculty Tab */}
        {tab === 'faculty' && (
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2ddd6', boxShadow: '0 2px 12px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #e2ddd6' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a4731' }}>Faculty Data ({faculties.length})</h2>
            </div>
            {fetching ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading faculty...</div>
            ) : (
              faculties.map((f, i) => (
                <div key={f._id} style={{ padding: '16px 20px', borderBottom: i < faculties.length - 1 ? '1px solid #f0ede8' : 'none' }}>
                  {editingFaculty === f.slug ? (
                    <div>
                      <input value={editData.description || ''} onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                        style={{ width: '100%', padding: '8px 12px', border: '1.5px solid #c9a84c66', borderRadius: 6, fontSize: '0.85rem', marginBottom: 8 }} placeholder="Description" />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => saveFaculty(f.slug)} style={{ padding: '6px 14px', background: '#1a4731', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setEditingFaculty(null)} style={{ padding: '6px 14px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1a4731' }}>{f.name}</span>
                          <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: 10, background: '#f0ede8', color: '#6b7280' }}>{f.type}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
                          {f.departments?.length || 0} departments · {f.teachers?.length || 0} teachers
                        </div>
                        {f.description && <div style={{ fontSize: '0.82rem', color: '#374151', marginTop: 6 }}>{f.description.slice(0, 200)}</div>}
                      </div>
                      <button onClick={() => { setEditingFaculty(f.slug); setEditData({ description: f.description }); }}
                        style={{ padding: '6px 14px', background: '#1a4731', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0 }}>
                        Edit
                      </button>
                    </div>
                  )}
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

function Loader() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3ee' }}>
      <div style={{ textAlign: 'center' }}><div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div><p style={{ color: '#1a4731' }}>Loading admin panel...</p></div>
    </div>
  );
}
