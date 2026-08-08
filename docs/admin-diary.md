# Admin Diary

Running log of company/legal/administrative milestones for AforAudience — separate from `design.md` (product/engineering decisions). Entries are dated, most recent first.

---

## 09 Aug 2026

- **Company registration: COMPLETE.**
- **PAN: received.**
- **Current account: pending.**
- **GST registration: pending.**

**Relevant standing gates (see `design.md` / session memory for full context):**
- Production freeze (no `qa→main` merge, no prod Supabase, no Razorpay live keys, no KYC, no prod webhook secret) lifts only on Hitesh's explicit signal — "company registered" was the named trigger. Registration is now complete, but current account and GST are still pending, and CA regulatory consultation (Section 9(5)/194-O TDS) is still open. **Freeze has NOT been explicitly lifted by Hitesh as of this entry — do not treat registration completion alone as that signal.** Confirm explicitly before any prod action.
- **Confirmed by Hitesh (09 Aug): GST is pending.** Earlier session context noting GST e-commerce-operator registration as "confirmed" was inaccurate — corrected here and in standing memory.
