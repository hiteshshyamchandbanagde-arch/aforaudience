'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Floating support widget: chat first, feedback-form fallback.
 *
 * Chat is free and open to everyone — guests and paying audience alike,
 * no login gate, no payment gate. This was a deliberate call: the
 * platform's browse-first principle (design doc §2) never gates basic
 * platform functions behind money or identity, and the people who most
 * need quick answers are prospective bookers who haven't paid yet —
 * gating support behind payment would remove help exactly when it does
 * the most good. See the design doc for the fuller reasoning.
 *
 * Instead, cost/abuse is bounded by an admin-configurable per-session
 * message cap (`PlatformSettings.chatMaxMessagesPerSession`, editable at
 * /dashboard/admin/settings, default 15). Enforced via sessionStorage —
 * a soft cost guard, not a hard security boundary. A determined user can
 * reset it by clearing storage; that's an accepted trade-off since the
 * goal is bounding ordinary usage, not adversarial abuse prevention.
 *
 * Feedback tab supports an optional screenshot attachment. Client-side
 * resize/recompress via canvas keeps the upload well under ~1MB before
 * base64-encoding it into the request — see MAX_ATTACHMENT_DIMENSION
 * and JPEG_QUALITY below. Stored directly on the Feedback row for MVP
 * simplicity (no Vercel Blob wired up yet); fine at low volume.
 */

type Panel = 'closed' | 'chat' | 'feedback';

/** On-brand chat icon — a warm spotlight glow (kept from the previous
 * mic design, matches the "live performance" theme) behind a simple
 * speech-bubble glyph. Replaces the earlier stage-mic icon: user testing
 * (Hitesh, session 44) showed it reads as a literal microphone/voice-input
 * control on mobile, not as "open chat" — a plain speech bubble is
 * unambiguous while still sitting on the same terracotta glow so the
 * button doesn't lose its identity. Uses currentColor so it inherits the
 * button/text color it's placed in.
 *
 * `pulse` adds a subtle breathing animation to the spotlight glow - used
 * only on the closed floating button (an idle "waiting for someone to
 * step up" cue), not once the panel is open, where it'd just be
 * distracting. Pure SVG SMIL animation, no separate stylesheet needed. */
function ChatIcon({ size = 24, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="9" r="9" fill="var(--afa-terracotta)" opacity="0.18">
        {pulse && (
          <>
            <animate attributeName="opacity" values="0.18;0.32;0.18" dur="2.6s" repeatCount="indefinite" />
            <animate attributeName="r" values="9;10;9" dur="2.6s" repeatCount="indefinite" />
          </>
        )}
      </circle>
      <path
        d="M4.5 9.5a6.5 6 0 0 1 6.5-6h2a6.5 6 0 0 1 6.5 6c0 3.31-3.13 6-7 6-.86 0-1.68-.13-2.43-.38L6 17l.9-3.3A6.02 6.02 0 0 1 4.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="8.7" cy="9.3" r="1" fill="currentColor" />
      <circle cx="12" cy="9.3" r="1" fill="currentColor" />
      <circle cx="15.3" cy="9.3" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="19" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

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

const SESSION_COUNT_KEY = 'afora_chat_message_count';
const MAX_ATTACHMENT_DIMENSION = 1280; // px, longest side, before compression
const JPEG_QUALITY = 0.7;
const MAX_ATTACHMENT_BYTES = 1_000_000; // matches server's ~1.4MB data-URL cap with base64 overhead

export default function SupportWidget() {
  const pathname = usePathname();
  const [panel, setPanel] = useState<Panel>('closed');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cap + config state — fetched once on mount.
  const [maxMessages, setMaxMessages] = useState<number | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);

  // Feedback state
  const [fbCategory, setFbCategory] = useState('QUESTION');
  const [fbMessage, setFbMessage] = useState('');
  // Feedback cmsa7h3x2 - Hitesh asked for a structured template so bug
  // reports come in usable (what happened vs what was expected) instead
  // of one-line "it's broken" messages. Only shown for category=BUG;
  // other categories (feature ideas, questions) don't fit a
  // repro/expected/actual shape and keep the free-text textarea. Page
  // isn't a field here - window.location.pathname is already captured
  // automatically below, no need to make the user type it.
  const [bugAction, setBugAction] = useState('');
  const [bugExpected, setBugExpected] = useState('');
  const [bugActual, setBugActual] = useState('');
  // Lighter structure for FEATURE_IDEA - just enough to get the "why"
  // without the repro/expected/actual shape a bug needs. Problem is
  // optional (some ideas are pure "wouldn't it be nice", not a pain
  // point) - the idea itself is the only required part.
  const [featureProblem, setFeatureProblem] = useState('');
  const [featureIdea, setFeatureIdea] = useState('');
  const [fbSubmitting, setFbSubmitting] = useState(false);
  const [fbSubmitted, setFbSubmitted] = useState(false);
  const [fbFromChatbot, setFbFromChatbot] = useState(false);
  const [fbAttachmentPreview, setFbAttachmentPreview] = useState<string | null>(null);
  const [fbAttachmentDataUrl, setFbAttachmentDataUrl] = useState<string | null>(null);
  const [fbAttachmentError, setFbAttachmentError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Load the cap + chat-enabled flag once, and the session's running
  // count from sessionStorage (resets per tab/session, not per page nav).
  useEffect(() => {
    fetch('/api/chat/config')
      .then((res) => res.json())
      .then((data) => {
        setMaxMessages(data.maxMessagesPerSession);
        setChatEnabled(data.chatEnabled);
      })
      .catch(() => {
        // If config fails to load, fail open on the UI (show chat) but
        // the backend will still enforce via its own settings read —
        // worst case the user sees an error on send, not a broken cap.
        setChatEnabled(true);
      });

    try {
      const stored = sessionStorage.getItem(SESSION_COUNT_KEY);
      setSessionCount(stored ? parseInt(stored, 10) || 0 : 0);
    } catch {
      // sessionStorage disabled — cap just won't persist across
      // messages within the tab; each send still checks the current
      // in-memory count, so it degrades gracefully rather than breaking.
    }
  }, []);

  const capReached = maxMessages !== null && sessionCount >= maxMessages;

  const EXCLUDED_PREFIXES = ['/auth', '/checkout', '/api', '/admin', '/dashboard/messages'];
  if (pathname && EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return null;
  }

  const incrementSessionCount = () => {
    const next = sessionCount + 1;
    setSessionCount(next);
    try {
      sessionStorage.setItem(SESSION_COUNT_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading || capReached || !chatEnabled) return;

    const nextMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(nextMessages);
    setChatInput('');
    setChatLoading(true);
    incrementSessionCount();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              data.error || 'Something went wrong. Try the feedback form below instead.',
          },
        ]);
        return;
      }

      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.answer, suggestsFallback: data.suggestsFallback },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: "Couldn't reach the assistant. Try the feedback form below instead.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  // Suggested improvement (2 Aug, Hitesh asked for feedback-form ideas):
  // the chatbot's "send this to the team" fallback always landed as
  // category=QUESTION, even when someone was clearly describing
  // something broken in plain language ("nothing happens when I
  // click..."). Simple keyword check - not trying to be clever, just
  // catching the obvious cases - so those land pre-selected as BUG and
  // get the structured template instead of dumping a vague sentence
  // into Question. Genuine questions are unaffected.
  const BUG_SIGNAL_WORDS = [
    'not working', "doesn't work", 'does not work', 'broken', 'error',
    'bug', 'crash', 'stuck', 'fails', 'failed', 'blank', 'nothing happens',
    "won't", 'wont ', "can't", 'cant ', 'unable to', 'glitch',
  ];
  const looksLikeBugReport = (text: string) => {
    const lower = text.toLowerCase();
    return BUG_SIGNAL_WORDS.some((w) => lower.includes(w));
  };

  const openFeedbackFromChat = (unansweredQuestion: string) => {
    if (looksLikeBugReport(unansweredQuestion)) {
      setFbCategory('BUG');
      setBugAction(unansweredQuestion);
      setFbMessage('');
    } else {
      setFbCategory('QUESTION');
      setFbMessage(unansweredQuestion);
      setBugAction('');
    }
    setFbFromChatbot(true);
    setFbSubmitted(false);
    setPanel('feedback');
  };

  // Bug fix (2 Aug) - fromChatbot was ONLY ever set true via the specific
  // "Send this to the team" CTA above, which only appears when the bot's
  // answer happens to match a narrow keyword regex (suggestsFallback).
  // Three other ways into the feedback panel - the plain "Feedback" tab
  // click, the "chat unavailable" fallback button, and the session-limit
  // link - all skipped it entirely, even when the person clearly arrived
  // mid-conversation. Result: fromChatbot was true on zero rows in the
  // whole database despite people genuinely reporting bugs through chat
  // first. Fixed by deriving it from actual engagement (does this
  // session have any chat messages at all?) rather than only the one
  // narrow CTA, and routing every panel-switch-to-feedback through this
  // one helper instead of four separate ad-hoc setPanel('feedback')
  // calls.
  const switchToFeedbackPanel = () => {
    if (chatMessages.length > 0) setFbFromChatbot(true);
    setFbSubmitted(false);
    setPanel('feedback');
  };

  const handleAttachmentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFbAttachmentError('');
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFbAttachmentError('Please attach an image file.');
      return;
    }

    // Resize/recompress via canvas so we never ship a multi-megabyte
    // phone photo straight into the request body. Longest side capped
    // at MAX_ATTACHMENT_DIMENSION, re-encoded as JPEG at JPEG_QUALITY.
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > height && width > MAX_ATTACHMENT_DIMENSION) {
        height = Math.round((height * MAX_ATTACHMENT_DIMENSION) / width);
        width = MAX_ATTACHMENT_DIMENSION;
      } else if (height > MAX_ATTACHMENT_DIMENSION) {
        width = Math.round((width * MAX_ATTACHMENT_DIMENSION) / height);
        height = MAX_ATTACHMENT_DIMENSION;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setFbAttachmentError("Couldn't process that image. Try a different file.");
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);

      // Rough byte size of a base64 data URL: length * 0.75 (minus the
      // small header). Good enough for a client-side sanity check;
      // server re-validates the real length regardless.
      const approxBytes = Math.round((dataUrl.length - 22) * 0.75);
      if (approxBytes > MAX_ATTACHMENT_BYTES) {
        setFbAttachmentError('That image is still too large after compression. Try a smaller screenshot.');
        return;
      }

      setFbAttachmentDataUrl(dataUrl);
      setFbAttachmentPreview(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setFbAttachmentError("Couldn't read that image. Try a different file.");
    };
    img.src = objectUrl;
  };

  const clearAttachment = () => {
    setFbAttachmentDataUrl(null);
    setFbAttachmentPreview(null);
    setFbAttachmentError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isBugCategory = fbCategory === 'BUG';
  const isFeatureCategory = fbCategory === 'FEATURE_IDEA';
  const composedBugMessage = `What I did: ${bugAction.trim()}\nWhat I expected: ${bugExpected.trim()}\nWhat happened instead: ${bugActual.trim()}`;
  const composedFeatureMessage = featureProblem.trim()
    ? `Problem: ${featureProblem.trim()}\nIdea: ${featureIdea.trim()}`
    : `Idea: ${featureIdea.trim()}`;
  const fbCanSubmit = isBugCategory
    ? Boolean(bugAction.trim() && bugActual.trim())
    : isFeatureCategory
      ? Boolean(featureIdea.trim())
      : Boolean(fbMessage.trim());

  const submitFeedback = async () => {
    if (!fbCanSubmit || fbSubmitting) return;
    setFbSubmitting(true);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: fbCategory,
          message: isBugCategory ? composedBugMessage : isFeatureCategory ? composedFeatureMessage : fbMessage.trim(),
          pageUrl: typeof window !== 'undefined' ? window.location.pathname : undefined,
          fromChatbot: fbFromChatbot,
          attachmentData: fbAttachmentDataUrl ?? undefined,
        }),
      });
      if (res.ok) {
        setFbSubmitted(true);
        setFbMessage('');
        setBugAction('');
        setBugExpected('');
        setBugActual('');
        setFeatureProblem('');
        setFeatureIdea('');
        setFbFromChatbot(false);
        clearAttachment();
      } else {
        const data = await res.json();
        setFbAttachmentError(data.error || 'Something went wrong. Try again.');
      }
    } catch {
      // Silent — the submitted state just won't flip; user can retry.
    } finally {
      setFbSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setPanel(panel === 'closed' ? 'chat' : 'closed')}
        aria-label={panel === 'closed' ? 'Open support chat' : 'Close support chat'}
        title={panel === 'closed' ? 'Chat with us' : 'Close'}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 45,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--afa-ink)',
          color: 'var(--afa-cream)',
          border: 'none',
          boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          fontSize: 24,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 8px 26px rgba(0,0,0,0.32)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)' }}
      >
        {panel === 'closed' ? <ChatIcon size={26} pulse /> : <CloseIcon size={22} />}
      </button>

      {panel !== 'closed' && (
        <div
          role="dialog"
          aria-label="Support"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 88,
            zIndex: 45,
            width: 340,
            maxWidth: 'calc(100vw - 40px)',
            height: 460,
            maxHeight: 'calc(100vh - 140px)',
            background: 'var(--afa-cream)',
            borderRadius: 16,
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ display: 'flex', borderBottom: '1px solid #E5DCCF' }}>
            <button
              onClick={() => setPanel('chat')}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: panel === 'chat' ? 'var(--afa-ink)' : 'transparent',
                color: panel === 'chat' ? 'var(--afa-cream)' : 'var(--afa-ink)',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Ask a question
            </button>
            <button
              onClick={switchToFeedbackPanel}
              style={{
                flex: 1,
                padding: '12px 8px',
                background: panel === 'feedback' ? 'var(--afa-ink)' : 'transparent',
                color: panel === 'feedback' ? 'var(--afa-cream)' : 'var(--afa-ink)',
                border: 'none',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Feedback
            </button>
          </div>

          {panel === 'chat' && (
            <>
              {!chatEnabled ? (
                <div style={{ flex: 1, padding: 20, textAlign: 'center' }}>
                  <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--afa-ink)' }}>
                    <ChatIcon size={36} />
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>
                    Chat is temporarily unavailable.
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--afa-gray-warm)', marginBottom: 16 }}>
                    Please use the feedback form instead — the team reads these personally.
                  </div>
                  <button
                    onClick={switchToFeedbackPanel}
                    style={{
                      background: 'var(--afa-terracotta)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 999,
                      padding: '8px 16px',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    Go to feedback form
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                    {chatMessages.length === 0 && (
                      <div style={{ color: 'var(--afa-gray-warm)', fontSize: 13, padding: 8 }}>
                        Ask anything about booking, becoming an Artist/Organiser, fees, or
                        how AforAudience works.
                      </div>
                    )}
                    {chatMessages.map((m, i) => (
                      <div key={i} style={{ marginBottom: 10 }}>
                        <div
                          style={{
                            display: 'inline-block',
                            maxWidth: '85%',
                            padding: '8px 12px',
                            borderRadius: 12,
                            fontSize: 14,
                            lineHeight: 1.4,
                            background: m.role === 'user' ? 'var(--afa-terracotta)' : 'var(--afa-tan)',
                            color: m.role === 'user' ? 'white' : 'var(--afa-ink)',
                            float: m.role === 'user' ? 'right' : 'left',
                            clear: 'both',
                          }}
                        >
                          {m.content}
                        </div>
                        {m.role === 'assistant' && m.suggestsFallback && (
                          <div style={{ clear: 'both', marginTop: 4 }}>
                            <button
                              onClick={() =>
                                openFeedbackFromChat(chatMessages[i - 1]?.content ?? m.content)
                              }
                              style={{
                                fontSize: 12,
                                color: 'var(--afa-terracotta)',
                                background: 'transparent',
                                border: '1px solid var(--afa-terracotta)',
                                borderRadius: 999,
                                padding: '4px 10px',
                                cursor: 'pointer',
                              }}
                            >
                              Send this to the team →
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                    {chatLoading && (
                      <div style={{ color: 'var(--afa-gray-warm)', fontSize: 13, padding: 8 }}>
                        Thinking…
                      </div>
                    )}
                    {capReached && (
                      <div
                        style={{
                          background: 'var(--afa-orange-tint)',
                          border: '1px solid #F0D9BF',
                          borderRadius: 8,
                          padding: 10,
                          fontSize: 13,
                          marginTop: 8,
                        }}
                      >
                        You&apos;ve reached the question limit for this session. Need more
                        help?{' '}
                        <button
                          onClick={switchToFeedbackPanel}
                          style={{
                            color: 'var(--afa-terracotta)',
                            background: 'transparent',
                            border: 'none',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            textDecoration: 'underline',
                          }}
                        >
                          Use the feedback form
                        </button>
                        .
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  <div style={{ display: 'flex', borderTop: '1px solid #E5DCCF', padding: 8 }}>
                    <input
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendChatMessage();
                      }}
                      disabled={capReached}
                      placeholder={capReached ? 'Question limit reached' : 'Type your question…'}
                      style={{
                        flex: 1,
                        border: '1px solid #E5DCCF',
                        borderRadius: 999,
                        padding: '8px 14px',
                        fontSize: 14,
                        outline: 'none',
                        opacity: capReached ? 0.5 : 1,
                      }}
                    />
                    <button
                      onClick={sendChatMessage}
                      disabled={chatLoading || !chatInput.trim() || capReached}
                      style={{
                        marginLeft: 8,
                        background: 'var(--afa-terracotta)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 999,
                        padding: '8px 16px',
                        fontWeight: 600,
                        fontSize: 14,
                        cursor: chatLoading || capReached ? 'default' : 'pointer',
                        opacity: chatLoading || !chatInput.trim() || capReached ? 0.6 : 1,
                      }}
                    >
                      Send
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {panel === 'feedback' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {fbSubmitted ? (
                <div style={{ textAlign: 'center', padding: '40px 12px' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Thanks — got it.</div>
                  <div style={{ fontSize: 13, color: 'var(--afa-gray-warm)' }}>
                    The team reviews these personally.
                  </div>
                </div>
              ) : (
                <>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    What&apos;s this about?
                  </label>
                  <select
                    value={fbCategory}
                    onChange={(e) => setFbCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: '1px solid #E5DCCF',
                      fontSize: 14,
                      marginBottom: 12,
                    }}
                  >
                    {FEEDBACK_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  {isBugCategory ? (
                    <>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        What did you do?
                      </label>
                      <textarea
                        value={bugAction}
                        onChange={(e) => setBugAction(e.target.value)}
                        rows={2}
                        placeholder="e.g. Entered my full name on the Sign Up page"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          fontSize: 14,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        What did you expect? <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                      </label>
                      <textarea
                        value={bugExpected}
                        onChange={(e) => setBugExpected(e.target.value)}
                        rows={2}
                        placeholder="e.g. A username to be suggested automatically"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          fontSize: 14,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        What happened instead?
                      </label>
                      <textarea
                        value={bugActual}
                        onChange={(e) => setBugActual(e.target.value)}
                        rows={2}
                        placeholder="e.g. The field stayed blank, had to type it myself"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          fontSize: 14,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />
                    </>
                  ) : isFeatureCategory ? (
                    <>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        What problem does this solve? <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
                      </label>
                      <textarea
                        value={featureProblem}
                        onChange={(e) => setFeatureProblem(e.target.value)}
                        rows={2}
                        placeholder="e.g. I can never remember which events I already reported feedback on"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          fontSize: 14,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        What would you like to see?
                      </label>
                      <textarea
                        value={featureIdea}
                        onChange={(e) => setFeatureIdea(e.target.value)}
                        rows={3}
                        placeholder="e.g. A page showing my own past feedback and its status"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          fontSize: 14,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                        Message
                      </label>
                      <textarea
                        value={fbMessage}
                        onChange={(e) => setFbMessage(e.target.value)}
                        rows={5}
                        placeholder="Tell us what's up…"
                        style={{
                          width: '100%',
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          fontSize: 14,
                          resize: 'vertical',
                          marginBottom: 12,
                        }}
                      />
                    </>
                  )}

                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                    Screenshot (optional)
                  </label>
                  {fbAttachmentPreview ? (
                    <div style={{ marginBottom: 12 }}>
                      <img
                        src={fbAttachmentPreview}
                        alt="Attachment preview"
                        style={{
                          maxWidth: '100%',
                          maxHeight: 120,
                          borderRadius: 8,
                          border: '1px solid #E5DCCF',
                          display: 'block',
                          marginBottom: 6,
                        }}
                      />
                      <button
                        onClick={clearAttachment}
                        style={{
                          fontSize: 12,
                          color: 'var(--afa-terracotta)',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          textDecoration: 'underline',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div style={{ marginBottom: 12 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAttachmentSelect}
                        style={{ fontSize: 13 }}
                      />
                    </div>
                  )}
                  {fbAttachmentError && (
                    <div style={{ fontSize: 12, color: 'var(--afa-error)', marginBottom: 12 }}>
                      {fbAttachmentError}
                    </div>
                  )}

                  <button
                    onClick={submitFeedback}
                    disabled={fbSubmitting || !fbCanSubmit}
                    style={{
                      width: '100%',
                      background: 'var(--afa-terracotta)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 999,
                      padding: '10px',
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: fbSubmitting ? 'default' : 'pointer',
                      opacity: fbSubmitting || !fbCanSubmit ? 0.6 : 1,
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
