'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/auth';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { auth } from '@/lib/firebase';
import { useAuth } from './contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

const SUGGESTED_QUESTIONS = [
  'Tell me about the e-payment system at CU',
  'Who is the Vice-Chancellor of the University of Chittagong?',
  'How many faculties does the University of Chittagong have?',
  'Can you list all the faculties and departments at CU?',
  'চট্টগ্রাম বিশ্ববিদ্যালয়ের ইতিহাস কী??',
  'শাটল ট্রেনের সময়সূচি কী?',
];

interface ChatSummary {
  _id: string;
  title: string;
  updatedAt: string;
  faculty: string | null;
}

async function getAuthHeaders() {
  const token = await auth.currentUser?.getIdToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function api(path: string, options?: RequestInit) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers: { ...headers, ...options?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function Page() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
  const [likedMessages, setLikedMessages] = useState<Set<string>>(new Set());
  const [dislikedMessages, setDislikedMessages] = useState<Set<string>>(new Set());
  const [copiedMessages, setCopiedMessages] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lightboxUrl) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setLightboxUrl(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxUrl]);

  const toggleLike = (id: string) => {
    setLikedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setDislikedMessages((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleDislike = (id: string) => {
    setDislikedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    setLikedMessages((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const copyMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const text = msg.parts?.filter((p) => p.type === 'text').map((p: any) => p.text).join('\n') || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessages((prev) => new Set(prev).add(messageId));
      setTimeout(() => setCopiedMessages((prev) => { const next = new Set(prev); next.delete(messageId); return next; }), 2000);
    } catch { console.error('Copy failed'); }
  };

  const shareMessage = async (messageId: string) => {
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return;
    const text = msg.parts?.filter((p) => p.type === 'text').map((p: any) => p.text).join('\n') || '';
    if (navigator.share) {
      try { await navigator.share({ text }); } catch { /* user cancelled */ }
    } else {
      await copyMessage(messageId);
    }
  };

  const facultyColors: Record<string, string> = {
    cse: '#059669', eee: '#dc2626', business: '#7c3aed', science: '#2563eb',
    law: '#d97706', arts: '#0891b2', social: '#9333ea', education: '#65a30d',
  };

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  const messagesRef = useRef<typeof messages>([]);
  const currentChatIdRef = useRef<string | null>(null);

  const saveChat = useCallback(async (msgs: typeof messages) => {
    if (!user || msgs.length === 0) return;
    const userMsg = msgs.find((m) => m.role === 'user');
    const title = userMsg?.parts?.find((p) => p.type === 'text')?.text?.slice(0, 50) || 'New Chat';
    try {
      const messagesForBackend = msgs.map((m) => ({
        role: m.role,
        content: (m.parts?.find((p) => p.type === 'text') as { text: string } | undefined)?.text || '',
      }));
      const payload: any = { title, messages: messagesForBackend };
      if (currentChatIdRef.current) payload.chatId = currentChatIdRef.current;
      const data = await api('/api/chat/save', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (data.success && data.chat?._id) {
        currentChatIdRef.current = data.chat._id;
        setCurrentChatId(data.chat._id);
        setChatHistory((prev) => {
          const exists = prev.find((c) => c._id === data.chat._id);
          if (exists) {
            return prev.map((c) => c._id === data.chat._id ? { ...c, title, updatedAt: data.chat.updatedAt } : c);
          }
          return [{ _id: data.chat._id, title, updatedAt: data.chat.updatedAt, faculty: null }, ...prev];
        });
      }
    } catch (e) { console.error('Save chat error:', e); }
  }, [user]);

  const {
    messages,
    sendMessage,
    status,
    stop,
    error,
    regenerate,
    setMessages,
  } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    onFinish: async () => {
      saveChat(messagesRef.current);
    },
    onError: (error) => console.error('Chat error:', error),
  });

  messagesRef.current = messages;
  currentChatIdRef.current = currentChatId;

  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await api('/api/chat/history');
        if (res.success) setChatHistory(res.chats);
      } catch (e) { console.error('Failed to load history:', e); }
    })();
  }, [user]);

  async function loadChat(chatId: string) {
    try {
      const data = await api(`/api/chat/${chatId}`);
      if (data.success && data.chat) {
        const normalizedMessages = (data.chat.messages || []).map((m: any) => ({
          id: m.id || crypto.randomUUID(),
          role: m.role,
          parts: m.parts || (m.content ? [{ type: 'text' as const, text: m.content }] : []),
        }));
        setMessages(normalizedMessages);
        setCurrentChatId(data.chat._id);
        setSidebarOpen(false);
      }
    } catch (e) { console.error('Load chat error:', e); }
  }

  async function confirmDelete(chatId: string) {
    try {
      await api(`/api/chat/${chatId}`, { method: 'DELETE' });
      setChatHistory((prev) => prev.filter((c) => c._id !== chatId));
      if (currentChatId === chatId) {
        setCurrentChatId(null);
        setMessages([]);
      }
    } catch (e) { console.error('Delete chat error:', e); }
    setDeletingChatId(null);
  }

  function newChat() {
    setCurrentChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && (!files || files.length === 0)) return;
    sendMessage({ text: input, files });
    setInput('');
    setFiles(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestedQuestion = (q: string) => {
    setInput(q);
    textareaRef.current?.focus();
  };

  const isProcessing = status === 'submitted' || status === 'streaming';
  const isReady = status === 'ready';

  const actionBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', padding: '4px 6px', borderRadius: 4, transition: 'all 0.15s', lineHeight: 1, fontFamily: 'sans-serif' };

  // ── Loading / unauthenticated ───────────────────────────────────────────────
  if (loading || !user) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: '#f5f3ee',
      }}>
        <div style={{ textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🎓</div>
          <p style={{ color: '#1a4731' }}>Loading...</p>
        </div>
      </div>
    );
  }

  const displayName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'User';

  return (
    <div className="flex h-screen" style={{ background: '#f5f3ee', fontFamily: "'Georgia', 'Times New Roman', serif" }}>

      {/* ── Sidebar ── */}
      <div className={`sidebar-panel ${sidebarOpen ? 'open' : ''}`} style={{
        width: sidebarOpen ? 280 : 0,
        minWidth: sidebarOpen ? 280 : 0,
        background: '#0d2e1f',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s, min-width 0.2s',
        overflow: 'hidden', borderRight: sidebarOpen ? '2px solid #c9a84c44' : 'none',
      }}>
        <div style={{ padding: '14px 12px', borderBottom: '1px solid #c9a84c33', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setSidebarOpen(false)} style={{ color: '#c9a84c', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: 4 }}>✕</button>
          <span style={{ color: '#c9a84c', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Chat History</span>
        </div>
        <button onClick={newChat}
          style={{ margin: '10px 12px', padding: '8px 0', background: '#c9a84c', color: '#0d2e1f', border: 'none', borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'sans-serif' }}>
          + New Chat
        </button>
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 8px' }}>
          {chatHistory.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: '0.75rem', fontFamily: 'sans-serif', lineHeight: 1.6 }}>
              <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>💬</div>
              No chats yet.<br />Start a conversation above.
            </div>
          ) : (
            <>
              <div style={{ padding: '4px 10px 8px', fontSize: '0.62rem', color: '#6b7280', fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #c9a84c22' }}>
                Recent Chats
              </div>
              {chatHistory.map((chat) => (
                <div key={chat._id}>
                  {deletingChatId === chat._id ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 10px', margin: '2px 0' }}>
                      <span style={{ fontSize: '0.72rem', color: '#f5f3ee', fontFamily: 'sans-serif', flex: 1 }}>Delete this chat?</span>
                      <button onClick={() => confirmDelete(chat._id)}
                        style={{ padding: '4px 10px', background: '#dc2626', border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 600 }}>Yes</button>
                      <button onClick={() => setDeletingChatId(null)}
                        style={{ padding: '4px 10px', background: '#6b7280', border: 'none', borderRadius: 4, color: '#fff', fontSize: '0.65rem', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 600 }}>No</button>
                    </div>
                  ) : (
                    <div className="sidebar-chat-item" style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '2px 0' }}>
                      <button onClick={() => loadChat(chat._id)}
                        style={{ flex: 1, textAlign: 'left', padding: '10px 10px', background: currentChatId === chat._id ? '#c9a84c22' : 'transparent', border: 'none', borderRadius: 8, color: '#f5f3ee', cursor: 'pointer', fontFamily: 'sans-serif', transition: 'background 0.15s' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {chat.title}
                          {chat.faculty && <span style={{ display: 'inline-block', marginLeft: 6, padding: '1px 6px', borderRadius: 4, fontSize: '0.58rem', fontWeight: 700, fontFamily: 'sans-serif', letterSpacing: '0.02em', background: `${facultyColors[chat.faculty.toLowerCase()] || '#6b7280'}33`, color: facultyColors[chat.faculty.toLowerCase()] || '#6b7280', verticalAlign: 'middle' }}>{chat.faculty.toUpperCase()}</span>}
                        </div>
                        <div style={{ fontSize: '0.62rem', color: '#6b7280', marginTop: 3, fontFamily: 'sans-serif' }}>{relativeDate(chat.updatedAt)}</div>
                      </button>
                      <button onClick={() => setDeletingChatId(chat._id)}
                        style={{ padding: '6px 8px', background: 'transparent', border: 'none', borderRadius: 5, color: '#6b7280', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'sans-serif', flexShrink: 0, transition: 'opacity 0.15s', opacity: 0.5 }} className="sidebar-delete-btn">🗑️</button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* ── Header ── */}
        <header style={{ background: 'linear-gradient(135deg, #1a4731 0%, #0d2e1f 100%)', borderBottom: '3px solid #c9a84c' }} className="px-4 sm:px-6 py-3 sm:py-4">
          <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-4 header-content">

            {/* Sidebar toggle */}
            <button onClick={() => setSidebarOpen(true)}
              style={{ color: '#c9a84c', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 4, flexShrink: 0 }}>
              ☰
            </button>

            {/* Logo */}
            <div className="chat-logo" style={{ width: 52, height: 52, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: '2px solid #c9a84c', overflow: 'hidden' }}>
              <img
                src="https://cu.ac.bd/wp-content/uploads/2021/12/logo1.png"
                alt="CU Logo"
                style={{ width: 44, height: 44, objectFit: 'contain' }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>

            {/* Title */}
            <div className="header-title">
              <h1 style={{ color: '#c9a84c', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.02em', lineHeight: 1.2 }}>
                চট্টগ্রাম বিশ্ববিদ্যালয়
              </h1>
              <p style={{ color: '#a8c5b0', fontSize: '0.8rem', marginTop: 2, fontFamily: 'sans-serif', letterSpacing: '0.05em' }}>
                University of Chittagong · AI Assistant{isProcessing && ' · Searching...'}
              </p>
            </div>

            {/* Right side */}
            <div className="ml-auto flex items-center gap-2 sm:gap-3 header-right">
              <span className="status-label" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: isProcessing ? '#f59e0b' : '#4ade80', boxShadow: isProcessing ? '0 0 8px #f59e0b' : '0 0 8px #4ade80' }} />
              <span className="status-label" style={{ color: '#a8c5b0', fontSize: '0.75rem', fontFamily: 'sans-serif' }}>
                {isProcessing ? 'Searching...' : 'Live'}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 4 }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #c9a84c', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#1a4731', border: '1.5px solid #c9a84c88', flexShrink: 0 }}>
                    {displayName[0].toUpperCase()}
                  </div>
                )}
                <button onClick={() => router.push('/dashboard')}
                  className="user-name-btn"
                  style={{ padding: '4px 10px', background: 'rgba(201,168,76,0.15)', border: '1px solid #c9a84c55', borderRadius: 7, color: '#c9a84c', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 600 }}>
                  {displayName}
                </button>
              </div>
              <button onClick={async () => { await signOut(); router.replace('/login'); }}
                className="signout-btn"
                style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.07)', border: '1px solid #ffffff22', borderRadius: 7, color: '#f5f3ee', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'sans-serif' }}>
                Sign Out
              </button>
            </div>
          </div>
        </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6 messages-area">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5">

          {/* Empty state */}
          {messages.length === 0 && (
            <div className="text-center mt-8">
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#1a4731', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #c9a84c' }}>
                <span style={{ fontSize: 32 }}>🎓</span>
              </div>
              <h2 style={{ color: '#1a4731', fontSize: '1.4rem', fontWeight: 700, marginBottom: 8 }}>
                Welcome, {displayName}!
              </h2>
              <p style={{ color: '#5a7a68', fontSize: '0.95rem', marginBottom: 24, fontFamily: 'sans-serif', maxWidth: 420, margin: '0 auto 24px' }}>
                Ask me anything about the University of Chittagong...
              </p>
              <div className="suggestions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxWidth: 560, margin: '0 auto' }}>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleSuggestedQuestion(q)}
                    style={{ background: '#fff', border: '1px solid #c9a84c44', borderRadius: 10, padding: '10px 14px', textAlign: 'left', fontSize: '0.82rem', color: '#1a4731', cursor: 'pointer', fontFamily: 'sans-serif', lineHeight: 1.4, transition: 'all 0.15s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#1a4731'; e.currentTarget.style.color = '#f5f3ee'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#1a4731'; }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>

              {/* Assistant avatar */}
              {message.role === 'assistant' && (
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a4731', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10, marginTop: 4, border: '1.5px solid #c9a84c', fontSize: 16 }}>
                  🎓
                </div>
              )}

              {/* Bubble */}
              <div className="message-bubble" style={{
                maxWidth: '75%',
                borderRadius: message.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '12px 16px',
                background: message.role === 'user' ? 'linear-gradient(135deg, #1a4731 0%, #0d2e1f 100%)' : '#ffffff',
                color: message.role === 'user' ? '#f5f3ee' : '#1a1a1a',
                border: message.role === 'user' ? '1px solid #c9a84c33' : '1px solid #e2ddd6',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              }}>
                <div style={{ fontSize: '0.72rem', fontFamily: 'sans-serif', opacity: 0.6, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {message.role === 'user' ? 'You' : 'CU Assistant'}
                </div>

                <div className="space-y-2">
                  {message.parts.map((part, index) => {
                    if (part.type === 'text') return (
                      <div key={index} style={{ fontSize: '0.93rem', lineHeight: 1.65, fontFamily: message.role === 'user' ? 'sans-serif' : "'Georgia', serif" }}>
                        {message.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={{
                              p: ({ children }) => <p style={{ margin: '0 0 8px 0' }}>{children}</p>,
                              strong: ({ children }) => <strong style={{ fontWeight: 700, color: 'inherit' }}>{children}</strong>,
                              ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ul>,
                              ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ol>,
                              li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                              code: ({ children }) => <code style={{ background: '#f0ede8', padding: '2px 6px', borderRadius: 4, fontSize: '0.85em', fontFamily: 'monospace' }}>{children}</code>,
                              table: ({ children }) => <div style={{ overflowX: 'auto', margin: '8px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>{children}</table></div>,
                              thead: ({ children }) => <thead style={{ background: '#1a4731', color: '#f5f0e8' }}>{children}</thead>,
                              tbody: ({ children }) => <tbody>{children}</tbody>,
                              tr: ({ children }) => <tr style={{ borderBottom: '1px solid #d4c9a8' }}>{children}</tr>,
                              th: ({ children }) => <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>{children}</th>,
                              td: ({ children }) => <td style={{ padding: '8px 10px', verticalAlign: 'top' }}>{children}</td>,
                            }}
                          >
                            {part.text}
                          </ReactMarkdown>
                        ) : (
                          <span style={{ whiteSpace: 'pre-wrap' }}>{part.text}</span>
                        )}
                      </div>
                    );
                    if (part.type === 'file') return (
                      <div key={index} style={{ marginTop: 8 }}>
                        {part.mediaType?.startsWith('image/') ? (
                          <img src={part.url} alt={part.filename || 'Uploaded image'} onClick={() => setLightboxUrl(part.url)} style={{ width: 140, height: 140, borderRadius: 8, objectFit: 'cover', border: '1px solid #e2ddd6', cursor: 'pointer' }} />
                        ) : (
                          <a href={part.url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: '#1a4731', fontFamily: 'sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0ede8', padding: '3px 8px', borderRadius: 4, textDecoration: 'none', border: '1px solid #c9a84c44' }}>
                            📎 {part.filename || 'Download file'}
                          </a>
                        )}
                      </div>
                    );
                    if (part.type === 'source-url') return (
                      <div key={index} style={{ marginTop: 8 }}>
                        <a href={part.url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.75rem', color: '#1a4731', fontFamily: 'sans-serif', display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0ede8', padding: '3px 8px', borderRadius: 4, textDecoration: 'none', border: '1px solid #c9a84c44' }}>
                          🔗 {part.title || (part.url ? new URL(part.url).hostname : 'Source')}
                        </a>
                      </div>
                    );
                    return null;
                  })}
                </div>

                {message.role === 'assistant' && (
                  <div className="message-actions" style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 8, opacity: 0.4, transition: 'opacity 0.15s' }}>
                    <button onClick={() => copyMessage(message.id)} title="Copy" style={{ ...actionBtnStyle, color: copiedMessages.has(message.id) ? '#059669' : 'inherit' }}>{copiedMessages.has(message.id) ? '✓' : '📋'}</button>
                    <button onClick={() => toggleLike(message.id)} title="Good response" style={{ ...actionBtnStyle, color: '#059669', background: likedMessages.has(message.id) ? '#05966922' : 'transparent' }}>👍</button>
                    <button onClick={() => toggleDislike(message.id)} title="Bad response" style={{ ...actionBtnStyle, color: '#dc2626', background: dislikedMessages.has(message.id) ? '#dc262622' : 'transparent' }}>👎</button>
                    <button onClick={() => shareMessage(message.id)} title="Share" style={actionBtnStyle}>📤</button>
                  </div>
                )}
              </div>

              {/* User avatar */}
              {message.role === 'user' && (
                user.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', marginLeft: 10, marginTop: 4, border: '1.5px solid #c9a84c', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 10, marginTop: 4, fontSize: 14, fontWeight: 700, color: '#1a4731' }}>
                    {displayName[0].toUpperCase()}
                  </div>
                )
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {status === 'submitted' && (
            <div className="flex justify-start items-center gap-3">
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1a4731', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid #c9a84c', fontSize: 16 }}>🎓</div>
              <div style={{ background: '#fff', border: '1px solid #e2ddd6', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  {[0, 1, 2].map((i) => (
                    <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#1a4731', animation: 'bounce 1.2s infinite', animationDelay: `${i * 0.2}s` }} />
                  ))}
                  <span style={{ fontSize: '0.75rem', color: '#5a7a68', marginLeft: 6, fontFamily: 'sans-serif' }}>searching...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Error bar ── */}
      {error && (
        <div style={{ background: '#fef2f2', borderTop: '1px solid #fecaca', padding: '10px 16px' }}>
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <p style={{ color: '#dc2626', fontSize: '0.85rem', fontFamily: 'sans-serif' }}>⚠️ {error.message || 'Something went wrong.'}</p>
            <button onClick={() => regenerate()} style={{ color: '#dc2626', fontSize: '0.85rem', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'sans-serif' }}>Retry</button>
          </div>
        </div>
      )}

      {/* ── Input Area ── */}
      <div style={{ background: '#fff', borderTop: '2px solid #c9a84c33', padding: '10px 12px' }} className="input-area sm:px-4 sm:py-3.5">
        <div className="max-w-4xl mx-auto">

          {/* File previews */}
          {files && files.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
              {Array.from(files).map((file, index) => (
                <div key={index} style={{ position: 'relative', background: '#f0ede8', borderRadius: 8, padding: 8 }}>
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontFamily: 'sans-serif' }}>
                      <span>📎</span>
                      <span style={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    </div>
                  )}
                  <button onClick={() => setFiles(undefined)} style={{ position: 'absolute', top: -4, right: -4, background: '#dc2626', color: '#fff', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>×</button>
                </div>
              ))}
            </div>
          )}

          <div className="input-area-inner" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <input type="file" onChange={(e) => e.target.files && setFiles(e.target.files)} className="hidden" id="file-upload" multiple accept="image/*,.txt,.pdf" ref={fileInputRef} />
            <label htmlFor="file-upload" className="attach-btn" style={{ padding: '8px 10px', background: '#f0ede8', border: '1px solid #c9a84c44', borderRadius: 10, cursor: 'pointer', fontSize: '1.1rem', flexShrink: 0 }}>📎</label>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about CU..."
              style={{ flex: 1, padding: '8px 10px', border: '1.5px solid #c9a84c66', borderRadius: 12, outline: 'none', resize: 'none', fontFamily: 'sans-serif', fontSize: '0.9rem', lineHeight: 1.5, background: '#fafaf8', color: '#1a1a1a', transition: 'border-color 0.15s', minHeight: 44 }}
              rows={1}
              disabled={!isReady}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#1a4731')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#c9a84c66')}
            />

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {isProcessing && (
                <button type="button" onClick={stop} style={{ padding: '8px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>Stop</button>
              )}
              <button
                onClick={handleSubmit}
                disabled={(!input.trim() && (!files || files.length === 0)) || !isReady}
                className="send-btn"
                style={{ padding: '8px 16px', background: ((!input.trim() && (!files || files.length === 0)) || !isReady) ? '#9ca3af' : 'linear-gradient(135deg, #1a4731 0%, #0d2e1f 100%)', color: '#fff', border: '1px solid #c9a84c44', borderRadius: 10, cursor: (!input.trim() || !isReady) ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0 }}
              >
                Send →
              </button>
            </div>
          </div>

          <div className="hidden-mobile sm:block" style={{ marginTop: 8, textAlign: 'center', fontSize: '0.72rem', color: '#5a7a68', fontFamily: 'sans-serif' }}>
            {status === 'submitted' && '⏳ Sending...'}
            {status === 'streaming' && '🔍 Searching cu.ac.bd for live information...'}
            {status === 'ready' && '✅ Ready · Searches cu.ac.bd live'}
          </div>
        </div>
      </div>

      </div>{/* end flex-1 main */}

      {/* Lightbox */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)} style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <img src={lightboxUrl} alt="Enlarged" style={{ maxWidth: '90vw', maxHeight: '90vh', borderRadius: 12, objectFit: 'contain', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
          <span style={{ position: 'absolute', top: 20, right: 24, color: '#fff', fontSize: '2rem', cursor: 'pointer', fontWeight: 300, lineHeight: 1 }}>×</span>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        .sidebar-chat-item button:first-child:hover { background: #c9a84c11 !important; }
        .sidebar-chat-item:hover .sidebar-delete-btn { opacity: 1 !important; }
        .message-actions:hover { opacity: 1 !important; }
        .message-actions button:hover { background: #f0ede8 !important; }
      `}</style>
    </div>
  );
}

function relativeDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString('en-BD', { day: 'numeric', month: 'short', year: 'numeric' });
}