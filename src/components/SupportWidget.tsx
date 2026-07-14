'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Floating support widget: chat first, feedback-form fallback.
 *
 * Two panels in one component:
 *   - Chat: talks to POST /api/chat, which answers ONLY from
 *     src/lib/site-knowledge.ts (see that file + the chat route for why).
 *   - Feedback: a plain form (category + message) to POST /api/feedback.
 *
 * The bridge between them: when the chatbot's answer looks like an
 * "I don't know" (heuristic on the backend, see `suggestsFallback` in
 * the API response), a small "Send this to the team instead" button
 * appears under that message, pre-filling the feedback form with the
 * unanswered question. One coherent feature, not two bolted together.
 *
 * Kept as a single file, inline styles, no new dependencies — consistent
 * with InstallPrompt.tsx's approach elsewhere in this codebase.
 *
 * Positioning: bottom-right circular button, distinct from
 * InstallPrompt's full-width bottom banner (that one is bottom-center/
 * full-width; this is a small corner button) so the two never visually
 * collide even if both are showing at once.
 */

type Panel = 'closed' | 'chat' | 'feedback';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  suggestsFallback?: boolean;
}

const FEEDBACK_CATEGORIES: { value: string; label: string }[] = [
  { value: 'QUESTION', label: 'Question' },
  { value: 'BUG', label: 'Bug' },
  { value: 'FEATURE_IDEA', label: 'Feature idea' },
  { value: 'GENERAL', label: 'General feedback' },
  { value: 'OTHER', label: 'Other' },
];

export default function SupportWidget() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>('closed');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const [fbCategory, setFbCategory] = useState('QUESTION');
  const [fbMessage, setFbMessage] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbSubmitted, setFbSubmitted] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [chatMessages]);

  // Hide entirely on admin pages — dense chrome already, and admin
  // users have direct DB/dashboard access rather than needing self-serve
  // support.
  if (pathname?.startsWith('/admin')) return null;

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    setChatError(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setChatError(data.error || 'Something went wrong. Please try again.');
        setChatLoading(false);
        return;
      }

      const data: { answer: string; suggestsFallback: boolean } = await res.json();
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, suggestsFallback: data.suggestsFallback },
      ]);
    } catch {
      setChatError('Could not reach the assistant. Check your connection and try again.');
    } finally {
      setChatLoading(false);
    }
  };

  const jumpToFeedbackFromChat = (question: string) => {
    setFbCategory('QUESTION');
    setFbMessage(question);
    setFbSubmitted(false);
    setPanel('feedback');
  };

  const submitFeedback = async (fromChatbot: boolean) => {
    if (!fbMessage.trim() || fbSubmitting) return;
    setFbSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: fbCategory,
          message: fbMessage.trim(),
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
          fromChatbot,
        }),
      });
      if (res.ok) {
        setFbSubmitted(true);
        setFbMessage('');
      }
    } catch {
      // Silent — the form stays populated so the user can retry the
      // submit button without retyping anything.
    } finally {
      setFbSubmitting(false);
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      {panel === 'closed' && (
        <button
          onClick={() => setPanel('chat')}
          aria-label="Open support chat"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 45,
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#C8441A',
            color: 'white',
            border: 'none',
            boxShadow: '0 6px 20px rgba(0,0,0,0.2)',
            fontSize: 24,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          💬
        </button>
      )}

      {panel !== 'closed' && (
        <div
          role="dialog"
          aria-label="Support"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 45,
            width: 340,
            maxWidth: 'calc(100vw - 32px)',
            height: 480,
            maxHeight: 'calc(100vh - 100px)',
            background: '#F7F3EE',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header with tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#0E0C0A',
              color: '#F7F3EE',
              padding: '10px 12px',
            }}
          >
            <button
              onClick={() => setPanel('chat')}
              style={{
                background: panel === 'chat' ? '#C8441A' : 'transparent',
                color: '#F7F3EE',
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Ask a question
            </button>
            <button
              onClick={() => setPanel('feedback')}
              style={{
                background: panel === 'feedback' ? '#C8441A' : 'transparent',
                color: '#F7F3EE',
                border: 'none',
                borderRadius: 999,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                marginLeft: 6,
              }}
            >
              Feedback
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setPanel('closed')}
              aria-label="Close"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#F7F3EE',
                fontSize: 20,
                cursor: 'pointer',
                opacity: 0.8,
              }}
            >
              ×
            </button>
          </div>

          {/* Chat panel */}
          {panel === 'chat' && (
            <>
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                {chatMessages.length === 0 && (
                  <div style={{ color: '#6B655F', fontSize: 13, lineHeight: 1.5 }}>
                    Ask anything about booking, becoming an Artist or Organiser, fees, or how
                    AforAudience works. If I don&apos;t know, you can send it straight to the
                    team.
                  </div>
                )}
                {chatMessages.map((m, i) => (
                  <div key={i}>
                    <div
                      style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        background: m.role === 'user' ? '#C8441A' : 'white',
                        color: m.role === 'user' ? 'white' : '#0E0C0A',
                        padding: '8px 12px',
                        borderRadius: 12,
                        fontSize: 14,
                        lineHeight: 1.4,
                        maxWidth: '85%',
                        marginLeft: m.role === 'user' ? 'auto' : 0,
                      }}
                    >
                      {m.content}
                    </div>
                    {m.role === 'assistant' && m.suggestsFallback && (
                      <button
                        onClick={() => {
                          const lastUserMsg = [...chatMessages]
                            .slice(0, i)
                            .reverse()
                            .find((mm) => mm.role === 'user');
                          jumpToFeedbackFromChat(lastUserMsg?.content ?? m.content);
                        }}
                        style={{
                          marginTop: 6,
                          background: 'transparent',
                          border: '1px solid #C8441A',
                          color: '#C8441A',
                          borderRadius: 999,
                          padding: '5px 12px',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Send this to the team
                      </button>
                    )}
                  </div>
                ))}
                {chatLoading && <div style={{ color: '#6B655F', fontSize: 13 }}>Thinking…</div>}
                {chatError && <div style={{ color: '#C8441A', fontSize: 13 }}>{chatError}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid #E5DFD5' }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendChatMessage();
                  }}
                  placeholder="Type your question…"
                  style={{
                    flex: 1,
                    border: '1px solid #E5DFD5',
                    borderRadius: 999,
                    padding: '8px 14px',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    background: '#C8441A',
                    color: 'white',
                    border: 'none',
                    borderRadius: 999,
                    padding: '8px 16px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: chatLoading ? 'default' : 'pointer',
                    opacity: chatLoading || !chatInput.trim() ? 0.6 : 1,
                  }}
                >
                  Send
                </button>
              </div>
            </>
          )}

          {/* Feedback panel */}
          {panel === 'feedback' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
              {fbSubmitted ? (
                <div style={{ textAlign: 'center', padding: '32px 8px' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Thanks — sent!</div>
                  <div style={{ fontSize: 13, color: '#6B655F' }}>
                    The team will follow up if needed.
                  </div>
                  <button
                    onClick={() => setFbSubmitted(false)}
                    style={{
                      marginTop: 16,
                      background: 'transparent',
                      border: '1px solid #C8441A',
                      color: '#C8441A',
                      borderRadius: 999,
                      padding: '6px 16px',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Send another
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: '#6B655F', marginBottom: 10 }}>
                    Report a bug, suggest a feature, or ask something directly.
                  </div>
                  <select
                    value={fbCategory}
                    onChange={(e) => setFbCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #E5DFD5',
                      fontSize: 14,
                      marginBottom: 10,
                    }}
                  >
                    {FEEDBACK_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    value={fbMessage}
                    onChange={(e) => setFbMessage(e.target.value)}
                    placeholder="Tell us what's on your mind…"
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: '1px solid #E5DFD5',
                      fontSize: 14,
                      resize: 'vertical',
                      marginBottom: 10,
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    onClick={() => submitFeedback(false)}
                    disabled={fbSubmitting || !fbMessage.trim()}
                    style={{
                      width: '100%',
                      background: '#C8441A',
                      color: 'white',
                      border: 'none',
                      borderRadius: 999,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: fbSubmitting ? 'default' : 'pointer',
                      opacity: fbSubmitting || !fbMessage.trim() ? 0.6 : 1,
                    }}
                  >
                    {fbSubmitting ? 'Sending…' : 'Send'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
