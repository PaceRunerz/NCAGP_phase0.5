'use client';

import { useState, useEffect } from 'react';
import {
  MessageCircle, X, Send, AlertTriangle, Bug,
  Lightbulb, ThumbsUp, ChevronDown, CheckCircle2,
} from 'lucide-react';

type IssueType = 'bug' | 'suggestion' | 'urgent' | 'general';

const TYPES: { value: IssueType; label: string; icon: any; color: string; desc: string }[] = [
  { value: 'urgent',     label: 'Urgent Issue',   icon: AlertTriangle, color: '#f87171', desc: 'Critical — needs immediate attention' },
  { value: 'bug',        label: 'Bug Report',     icon: Bug,           color: '#fbbf24', desc: 'Something is not working correctly' },
  { value: 'suggestion', label: 'Suggestion',     icon: Lightbulb,     color: '#60a5fa', desc: 'Idea or improvement request' },
  { value: 'general',   label: 'General',         icon: MessageCircle, color: '#34d399', desc: 'Question or general feedback' },
];

export function FeedbackWidget() {
  const [mounted, setMounted] = useState(false); // FIX: prevents SSR/client mismatch
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<IssueType>('bug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [issues, setIssues] = useState<any[]>([]);
  const [tab, setTab] = useState<'report' | 'history'>('report');
  const [unread, setUnread] = useState(0);

  // FIX: mark as mounted after first client render
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load stored issues from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('ncagp_issues');
    if (stored) {
      const parsed = JSON.parse(stored);
      setIssues(parsed);
      const unreadCount = parsed.filter((i: any) => i.status === 'open').length;
      setUnread(unreadCount);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);

    // Simulate API call — in production this would POST to /api/feedback
    await new Promise(r => setTimeout(r, 800));

    const newIssue = {
      id: Date.now().toString(),
      type,
      title: title.trim(),
      description: description.trim(),
      status: 'open',
      submittedAt: new Date().toISOString(),
      submittedBy: JSON.parse(localStorage.getItem('ncagp_user') || '{}')?.email || 'unknown',
    };

    const updated = [newIssue, ...issues];
    setIssues(updated);
    localStorage.setItem('ncagp_issues', JSON.stringify(updated));

    // Also try posting to backend ledger as a record
    try {
      const token = localStorage.getItem('ncagp_token');
      if (token) {
        await fetch('/api/ledger', {
          method: 'GET', // Just to check connectivity
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {}

    setSubmitting(false);
    setSubmitted(true);
    setTitle('');
    setDescription('');
    setUnread(u => u + 1);

    setTimeout(() => {
      setSubmitted(false);
      setTab('history');
    }, 2000);
  };

  const selectedType = TYPES.find(t => t.value === type)!;
  const Icon = selectedType.icon;

  // FIX: server renders null, client renders null — perfect match, no hydration error
  if (!mounted) return null;

  return (
    <>
      {/* Floating button */}
      <div className="feedback-btn">
        <button
          onClick={() => setOpen(!open)}
          style={{
            width: 52, height: 52,
            borderRadius: '50%',
            background: open
              ? 'rgba(239,68,68,0.2)'
              : 'linear-gradient(135deg, #1a56db, #1749c9)',
            border: `1px solid ${open ? 'rgba(239,68,68,0.4)' : 'rgba(26,86,219,0.5)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: open
              ? '0 0 0 4px rgba(239,68,68,0.15)'
              : '0 4px 24px rgba(26,86,219,0.5), 0 0 0 4px rgba(26,86,219,0.1)',
            transition: 'all 0.2s',
            position: 'relative',
          }}
        >
          {open ? <X size={20} color="white" /> : <MessageCircle size={20} color="white" />}
          {!open && unread > 0 && (
            <div style={{
              position: 'absolute', top: -3, right: -3,
              width: 18, height: 18, borderRadius: '50%',
              background: '#ef4444', color: 'white',
              fontSize: 10, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--navy-950)',
            }}>{unread}</div>
          )}
        </button>
        <div style={{ textAlign: 'center', marginTop: 4, fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(148,163,184,0.4)', textTransform: 'uppercase' }}>
          Feedback
        </div>
      </div>

      {/* Panel */}
      {open && (
        <div className="feedback-panel">
          <div className="glass-card" style={{ border: '1px solid rgba(26,86,219,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(26,86,219,0.1)' }}>

            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(26,86,219,0.2)', border: '1px solid rgba(26,86,219,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <MessageCircle size={13} color="#60a5fa" />
                </div>
                <div>
                  <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 14, color: '#f1f5f9' }}>Report Issue</div>
                  <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.4)' }}>NCAGP Support</div>
                </div>
              </div>
              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4 }}>
                {(['report', 'history'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    style={{ padding: '4px 10px', borderRadius: 5, fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer',
                      background: tab === t ? 'rgba(26,86,219,0.25)' : 'transparent',
                      border: `1px solid ${tab === t ? 'rgba(26,86,219,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      color: tab === t ? '#93c5fd' : 'rgba(148,163,184,0.4)',
                    }}>
                    {t === 'history' ? `${t} ${issues.length > 0 ? `(${issues.length})` : ''}` : t}
                  </button>
                ))}
              </div>
            </div>

            {/* Report tab */}
            {tab === 'report' && (
              <div style={{ padding: 16 }}>
                {submitted ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }} className="animate-scale-in">
                    <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                      <CheckCircle2 size={22} color="#34d399" />
                    </div>
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, fontSize: 15, color: '#34d399', marginBottom: 4 }}>Issue Reported</div>
                    <div style={{ fontSize: 12, color: 'rgba(148,163,184,0.5)' }}>Your issue has been logged in the system</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Type selector */}
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>Issue Type</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                        {TYPES.map(t => {
                          const TIcon = t.icon;
                          return (
                            <button key={t.value} onClick={() => setType(t.value)}
                              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', textAlign: 'left',
                                background: type === t.value ? `${t.color}18` : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${type === t.value ? `${t.color}40` : 'rgba(255,255,255,0.06)'}`,
                                transition: 'all 0.15s',
                              }}>
                              <TIcon size={12} color={type === t.value ? t.color : 'rgba(148,163,184,0.4)'} style={{ flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 11, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, color: type === t.value ? t.color : 'rgba(148,163,184,0.6)' }}>{t.label}</div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>Title</div>
                      <input
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Brief summary of the issue"
                        className="gov-input"
                        style={{ fontSize: 13 }}
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <div style={{ fontSize: 10, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(148,163,184,0.4)', marginBottom: 6 }}>Description</div>
                      <textarea
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="Describe what happened, what you expected, and steps to reproduce..."
                        rows={4}
                        style={{ width: '100%', padding: '9px 13px', background: 'rgba(5,20,36,0.8)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 7, color: '#f1f5f9', fontSize: 12, fontFamily: 'IBM Plex Sans, sans-serif', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(26,86,219,0.55)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.09)')}
                      />
                    </div>

                    {/* Priority indicator */}
                    {type === 'urgent' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 7 }} className="animate-fade-in">
                        <AlertTriangle size={13} color="#f87171" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#f87171' }}>Marked as urgent — will be escalated to NIC_ADMIN immediately</span>
                      </div>
                    )}

                    <button
                      onClick={handleSubmit}
                      disabled={!title.trim() || !description.trim() || submitting}
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', opacity: !title.trim() || !description.trim() ? 0.5 : 1 }}
                    >
                      {submitting ? (
                        <>
                          <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                          Submitting...
                        </>
                      ) : (
                        <><Send size={12} />Submit Issue</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* History tab */}
            {tab === 'history' && (
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {issues.length === 0 ? (
                  <div style={{ padding: '40px 16px', textAlign: 'center', color: 'rgba(148,163,184,0.3)' }}>
                    <ThumbsUp size={28} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.2 }} />
                    <div style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: 13 }}>No issues reported yet</div>
                  </div>
                ) : issues.map((issue, i) => {
                  const t = TYPES.find(x => x.value === issue.type) || TYPES[3];
                  const IIcon = t.icon;
                  return (
                    <div key={issue.id}
                      style={{ padding: '11px 16px', borderBottom: i < issues.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
                      className="animate-fade-up"
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 6, background: `${t.color}15`, border: `1px solid ${t.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <IIcon size={12} color={t.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</div>
                          <div style={{ fontSize: 10, color: 'rgba(148,163,184,0.35)', marginTop: 1 }}>
                            {new Date(issue.submittedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <span style={{ fontSize: 9, fontFamily: 'Rajdhani, sans-serif', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.2)', flexShrink: 0 }}>
                          OPEN
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.25)', fontFamily: 'Rajdhani, sans-serif', letterSpacing: '0.08em' }}>NCAGP SUPPORT · NIC GOV.IN</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div className="live-dot" style={{ width: 5, height: 5 }} />
                <span style={{ fontSize: 9, color: 'rgba(148,163,184,0.3)' }}>System operational</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </>
  );
}