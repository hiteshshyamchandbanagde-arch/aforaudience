/**
 * Site knowledge base for the support chatbot.
 *
 * This is the ONLY source the chatbot is allowed to answer from — see
 * the system prompt in `src/app/api/chat/route.ts`, which instructs
 * the model to answer using nothing else and to say "I don't know"
 * (triggering the feedback-form handoff) for anything not covered here.
 *
 * Content is drawn from `docs/design.md`. The refund policy entry is
 * deliberately honest that it's undecided (§9.5) rather than inventing
 * an answer — a wrong refund-policy answer from a bot is the single
 * worst thing this feature could produce on a platform handling real
 * ticket payments.
 *
 * Editing this file is a normal PR, no special deploy process. Keep
 * entries short (2-4 sentences) — the model synthesizes across
 * entries for multi-part questions, it doesn't need a perfect keyword
 * match.
 */

export interface KnowledgeEntry {
  topic: string;
  content: string;
}

export const SITE_KNOWLEDGE: KnowledgeEntry[] = [
  {
    topic: 'What AforAudience is',
    content:
      'AforAudience is a live art and event discovery platform connecting Artists (comedians, poets, musicians, open mic performers), Organisers, Venue Owners, and Audiences across India, starting in Pune. The tagline is "Where Art Finds Its Crowd." It exists to fix a fragmented, hard-to-discover live performance scene.',
  },
  {
    topic: 'Cost to audience — booking fee',
    content:
      'Booking a ticket costs the listed ticket price plus a small platform booking fee, shown as a separate line item at checkout before payment. The fee is never hidden or added silently. Depending on the event and current platform settings, this fee may currently be ₹0.',
  },
  {
    topic: "The platform's core promise — no commission on the scene",
    content:
      'AforAudience takes zero commission on venue rentals (what an Organiser pays a Venue Owner), zero commission on performer compensation (what an Organiser pays or is paid by an Artist), and zero commission on the ticket price itself. The only platform charge is the small audience-side booking fee at checkout. This is a permanent commitment, not a promotional period.',
  },
  {
    topic: 'How to book a ticket',
    content:
      'You can browse events without an account. When you tap "Book Now," you are asked to sign in (phone OTP or email) only at that point — never before. After signing in, pick your seats and pay via Razorpay (UPI, cards, wallets). Your ticket — a PDF with a QR code — is emailed to you as soon as payment confirms.',
  },
  {
    topic: 'Refund policy',
    content:
      "The refund policy is still being finalized and is not yet published. If you need to cancel a booking, you can do so from the My Tickets page — your seat is released immediately — but whether a refund is issued, and on what timeline, has not yet been decided by the platform. Please use the feedback form below to ask about a specific booking, and check back here soon — this answer will update the moment the policy ships.",
  },
  {
    topic: 'How to become an Artist',
    content:
      'From your Profile page, tap "Apply as Artist." There is no approval gate — your artist profile activates right away. You may still want to verify your account before applying to paid lineup slots, since some Organisers restrict auto-accepted applications to verified accounts.',
  },
  {
    topic: 'How to become an Organiser or list a Venue',
    content:
      'From your Profile page, tap "Become an Organiser" or "List Your Venue." Both require a short application and admin approval before the full dashboard unlocks. You can still log in while your application is pending — you will see a "Pending Approval" status instead of the full dashboard.',
  },
  {
    topic: 'Performer compensation — paid, free, or buy-in slots',
    content:
      'When an Organiser builds a lineup, each slot is marked Paid (the Organiser owes the Artist a fee), Free (open-mic/exposure, no money either way), or Buy-in (the Artist pays the Organiser a small spot fee). This is settled directly between the Organiser and Artist — the platform records the agreed terms for both sides\' clarity but does not process this payment or take any cut.',
  },
  {
    topic: 'Contacting the platform / getting help',
    content:
      'If this assistant cannot answer your question, use the "Send to team" option that appears below its response, or switch to the feedback tab in this same widget. Feedback and questions submitted this way go directly to the team.',
  },
  {
    topic: 'Account verification',
    content:
      "Verifying your account (via the phone OTP flow) is optional for browsing and booking as an audience member, but it unlocks certain Artist features — specifically, some Organisers configure their events to auto-accept lineup applications only from verified accounts.",
  },
];

/**
 * Renders the knowledge base as plain text for injection into the
 * chatbot's system prompt. Kept as a simple topic/content list —
 * Haiku 4.5 handles synthesis across entries well without needing
 * structured markup.
 */
export function renderKnowledgeBaseForPrompt(): string {
  return SITE_KNOWLEDGE.map((entry) => `### ${entry.topic}\n${entry.content}`).join('\n\n');
}
