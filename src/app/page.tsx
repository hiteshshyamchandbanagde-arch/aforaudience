import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import HeroRotator from "@/components/HeroRotator";

const TICKER_UNIQUE_ITEMS = ["Open Mic — Mumbai Tonight", "Poetry Slam — Delhi Saturday", "Stand Up Special — Bangalore", "Theater Night — Pune", "Open Mic — Hyderabad Friday", "Comedy Lineup — Chennai", "Spoken Word — Kolkata"];
const tickerItems = [...TICKER_UNIQUE_ITEMS, ...TICKER_UNIQUE_ITEMS];

const HERO_STATS = [{ num: "2,400+", label: "Artists" }, { num: "840+", label: "Events Monthly" }, { num: "120+", label: "Cities" }];

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: "#F7F3EE", color: "#0E0C0A", fontFamily: "Georgia, serif" }}>

      <SiteNav variant="home" />

      {/* HERO */}
      <section style={{ padding: "96px 48px 80px" }}>
        <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", alignItems: "stretch", gap: "48px", flexWrap: "wrap" }}>
        <div style={{ maxWidth: "560px", flex: "1 1 480px" }}>
          <div style={{ fontFamily: "monospace", fontSize: "12px", letterSpacing: "0.12em", color: "#C8441A", textTransform: "uppercase", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "inline-block", width: "32px", height: "1px", background: "#C8441A" }}></span>
            Live Art. Real Moments.
          </div>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(44px, 5vw, 72px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-1.5px", color: "#0E0C0A", marginBottom: "28px" }}>
            Where <em style={{ fontStyle: "italic", color: "#C8441A" }}>Art</em><br />finds its<br />Crowd
          </h1>
          <p style={{ fontSize: "18px", fontWeight: 300, color: "#0E0C0A", opacity: 0.65, maxWidth: "440px", lineHeight: 1.7, marginBottom: "44px", fontFamily: "system-ui, sans-serif" }}>
            The world&apos;s first live art universe — connecting comedians, poets, open mic artists, organisers, and venues in one living ecosystem.
          </p>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/events" style={{ background: "#C8441A", color: "white", padding: "16px 36px", borderRadius: "6px", fontSize: "15px", fontWeight: 600, textDecoration: "none" }}>
              Explore Events
            </Link>
            <Link href="/profile" style={{ background: "transparent", color: "#0E0C0A", padding: "16px 36px", borderRadius: "6px", fontSize: "15px", fontWeight: 500, textDecoration: "none", border: "1.5px solid rgba(14,12,10,0.2)" }}>
              I&apos;m an Artist →
            </Link>
          </div>

          {/* STATS (default position — under CTAs, all screen sizes) */}
          <div className="hero-stats-inline" style={{ display: "flex", gap: "40px", marginTop: "56px", paddingTop: "40px", borderTop: "1px solid rgba(14,12,10,0.1)", flexWrap: "wrap" }}>
            {HERO_STATS.map((s) => (
              <div key={s.label}>
                <div style={{ fontFamily: "Georgia, serif", fontSize: "32px", fontWeight: 700, color: "#0E0C0A", lineHeight: 1, marginBottom: "4px" }}>{s.num}</div>
                <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#0E0C0A", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* STATS (wide-screen only — fills the gap between text and hero image; hidden below 1600px, inline version above hidden above it) */}
        <div className="hero-stats-gap" style={{ flex: "0 0 auto", display: "none", flexDirection: "column", justifyContent: "center", gap: "36px", padding: "0 4px" }}>
          {HERO_STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "30px", fontWeight: 700, color: "#0E0C0A", lineHeight: 1, marginBottom: "4px", whiteSpace: "nowrap" }}>{s.num}</div>
              <div style={{ fontFamily: "monospace", fontSize: "11px", color: "#0E0C0A", opacity: 0.5, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ flex: "1 1 400px", maxWidth: "720px" }}>
          <HeroRotator />
        </div>
        </div>
      </section>

      {/* TICKER */}
      <div style={{ background: "#0E0C0A", color: "#F7F3EE", padding: "14px 0", overflow: "hidden", borderTop: "2px solid #C8441A" }}>
        <div style={{ display: "flex", gap: "0", whiteSpace: "nowrap", animation: "ticker 28s linear infinite", willChange: "transform", backfaceVisibility: "hidden" }}>
          {tickerItems.map((item, i) => (
            <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "16px", padding: "0 32px", fontFamily: "monospace", fontSize: "13px" }}>
              <span style={{ color: "#C8441A" }}>◆</span> {item}
            </span>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <section style={{ padding: "100px 48px", background: "white" }}>
        <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#C8441A", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "#C8441A", display: "inline-block" }}></span>
          How it works
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1px", color: "#0E0C0A", marginBottom: "56px" }}>
          Four steps to your<br /><em style={{ color: "#C8441A" }}>perfect night out</em>
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "2px" }}>
          {[
            { num: "01", icon: "🔍", title: "Discover", desc: "Browse events by city, mood, genre or vibe. Free shows, paid shows — filter what fits your night." },
            { num: "02", icon: "🎟️", title: "Book", desc: "Pick your seat, pay securely via UPI, card or wallet. Done in under 60 seconds." },
            { num: "03", icon: "📲", title: "Get Ticket", desc: "Receive your PDF ticket + SMS confirmation instantly. Show up, scan and walk in." },
            { num: "04", icon: "⭐", title: "Rate & Tip", desc: "After the show, rate each performer and send a digital tip directly to the artist." },
          ].map((step) => (
            <div key={step.num} style={{ background: "#F7F3EE", padding: "40px 32px" }}>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "72px", fontWeight: 900, color: "#C8441A", opacity: 0.12, lineHeight: 1, marginBottom: "20px", letterSpacing: "-3px" }}>{step.num}</div>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>{step.icon}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "20px", fontWeight: 700, color: "#0E0C0A", marginBottom: "10px" }}>{step.title}</div>
              <div style={{ fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "#0E0C0A", opacity: 0.6, lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section style={{ padding: "100px 48px", background: "#F7F3EE" }}>
        <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#C8441A", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "#C8441A", display: "inline-block" }}></span>
          Who&apos;s it for
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1px", color: "#0E0C0A", marginBottom: "16px" }}>
          One platform.<br /><em style={{ color: "#C8441A" }}>Every role.</em>
        </h2>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "17px", fontWeight: 300, color: "#0E0C0A", opacity: 0.6, maxWidth: "560px", lineHeight: 1.7, marginBottom: "56px" }}>
          Whether you perform, organise, own a space or simply love live art — AforAudience is built for you.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          {[
            {
              icon: "👥", name: "Audience", tag: "Art Lover",
              pitch: "Never miss a show that matches your mood.",
              benefits: ["Filter events by Navarasa — the feeling you want tonight", "Instant PDF ticket, no queue at the door", "Rate and tip artists directly after the show"],
              cta: "Explore Events", href: "/events",
            },
            {
              icon: "🎤", name: "Artist", tag: "Comedian · Poet · Musician",
              pitch: "Get discovered. Get booked. Build a reputation that travels with you.",
              benefits: ["A portable Hype Score and review history — yours, not the venue's", "Apply to open mics and shows across cities, not just one scene", "Zero commission on your slot or your tips"],
              cta: "Apply as Artist", href: "/profile",
            },
            {
              icon: "🎪", name: "Organiser", tag: "Event Manager",
              pitch: "Run the whole show — lineup to ticket to payout — from one place.",
              benefits: ["Post events and manage lineups without spreadsheets or group chats", "Sell tickets with built-in payments, no manual reconciliation", "Never taxed on venue rentals, performer slots, or ticket sales"],
              cta: "Become an Organiser", href: "/profile",
            },
            {
              icon: "🏛️", name: "Venue Owner", tag: "Cafe · Theater · Rooftop",
              pitch: "Turn empty hours into booked nights.",
              benefits: ["List your space and set availability in minutes", "Get matched with organisers actively looking for a room", "Keep 100% of your rental — AforAudience takes no cut"],
              cta: "List Your Venue", href: "/profile",
            },
          ].map((role) => (
            <div key={role.name} style={{ border: "1.5px solid rgba(14,12,10,0.1)", borderRadius: "12px", padding: "32px 28px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "36px", marginBottom: "16px" }}>{role.icon}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "19px", fontWeight: 700, color: "#0E0C0A", marginBottom: "4px" }}>{role.name}</div>
              <span style={{ fontFamily: "monospace", fontSize: "10px", padding: "3px 9px", borderRadius: "4px", background: "#E8E2D9", color: "#0E0C0A", opacity: 0.7, alignSelf: "flex-start", marginBottom: "16px" }}>{role.tag}</span>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "15px", fontStyle: "italic", color: "#C8441A", lineHeight: 1.5, marginBottom: "18px" }}>{role.pitch}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
                {role.benefits.map((b) => (
                  <li key={b} style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "#0E0C0A", opacity: 0.65, lineHeight: 1.5, display: "flex", gap: "8px" }}>
                    <span style={{ color: "#C8441A", flexShrink: 0 }}>✓</span>{b}
                  </li>
                ))}
              </ul>
              <Link href={role.href} style={{ fontFamily: "system-ui, sans-serif", fontSize: "13px", fontWeight: 600, color: "#C8441A", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                {role.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* NAVARASA */}
      <section style={{ padding: "100px 48px", background: "white", textAlign: "center" }}>
        <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "#C8441A", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "#C8441A", display: "inline-block" }}></span>
          Ancient Indian Wisdom
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1px", color: "#0E0C0A", marginBottom: "16px" }}>
          Find art by <em style={{ color: "#C8441A" }}>Navarasa</em>
        </h2>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "17px", fontWeight: 300, color: "#0E0C0A", opacity: 0.6, maxWidth: "560px", margin: "0 auto 56px", lineHeight: 1.7 }}>
          The 9 emotions of Indian classical art. Search events by the feeling you want to experience tonight.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(70px, 1fr))", gap: "8px", maxWidth: "900px", margin: "0 auto" }}>
          {[
            { emoji: "❤️", name: "Shringara", sanskrit: "Love" },
            { emoji: "😂", name: "Hasya", sanskrit: "Laughter" },
            { emoji: "😢", name: "Karuna", sanskrit: "Sorrow" },
            { emoji: "⚡", name: "Raudra", sanskrit: "Fury" },
            { emoji: "🦁", name: "Vira", sanskrit: "Courage" },
            { emoji: "😨", name: "Bhayanaka", sanskrit: "Fear" },
            { emoji: "🤢", name: "Bibhatsa", sanskrit: "Disgust" },
            { emoji: "🤩", name: "Adbhuta", sanskrit: "Wonder" },
            { emoji: "🕊️", name: "Shanta", sanskrit: "Peace" },
          ].map((rasa) => (
            <div key={rasa.name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "20px 8px", borderRadius: "10px", cursor: "pointer" }}>
              <div style={{ fontSize: "32px" }}>{rasa.emoji}</div>
              <div style={{ fontFamily: "Georgia, serif", fontSize: "12px", fontWeight: 700, color: "#0E0C0A" }}>{rasa.name}</div>
              <div style={{ fontFamily: "monospace", fontSize: "10px", color: "#0E0C0A", opacity: 0.4 }}>{rasa.sanskrit}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: "#C8441A", textAlign: "center", padding: "100px 48px" }}>
        <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)", marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
          <span style={{ width: "24px", height: "1px", background: "rgba(255,255,255,0.5)", display: "inline-block" }}></span>
          Join AforAudience
        </div>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(32px, 3.5vw, 52px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-1px", color: "white", marginBottom: "16px" }}>
          The stage is set.<br />Are you ready?
        </h2>
        <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "18px", color: "rgba(255,255,255,0.75)", maxWidth: "540px", margin: "0 auto 44px", lineHeight: 1.7 }}>
          Join thousands of artists, organisers, venue owners and art lovers already on the platform.
        </p>
        <div style={{ display: "flex", gap: "14px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/events" style={{ background: "white", color: "#C8441A", padding: "16px 36px", borderRadius: "6px", fontSize: "15px", fontWeight: 700, textDecoration: "none" }}>
            Find an Event Tonight
          </Link>
          <Link href="/profile" style={{ background: "transparent", color: "white", padding: "16px 36px", borderRadius: "6px", fontSize: "15px", fontWeight: 500, textDecoration: "none", border: "2px solid rgba(255,255,255,0.4)" }}>
            Join as Artist
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#0E0C0A", color: "#F7F3EE", padding: "64px 48px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "48px", marginBottom: "48px" }}>
          <div>
            <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", fontWeight: 700, color: "#F7F3EE", marginBottom: "12px" }}>
              <span style={{ color: "#C8441A" }}>A</span>forAudience
            </div>
            <p style={{ fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "rgba(247,243,238,0.45)", lineHeight: 1.65, maxWidth: "280px" }}>
              The world&apos;s first live art universe — where every comedian, poet, musician, organiser, venue and fan is connected.
            </p>
          </div>
          {[
            {
              title: "Platform",
              links: [
                { label: "Browse Events", href: "/events" },
                { label: "Find Artists", href: "/artists" },
                { label: "Explore Venues", href: "/venues" },
                { label: "Livestreams", href: "/livestreams" },
              ],
            },
            {
              title: "Join As",
              links: [
                { label: "Artist", href: "/register" },
                { label: "Organiser", href: "/register" },
                { label: "Venue Owner", href: "/register" },
                { label: "Audience", href: "/register" },
              ],
            },
            {
              title: "Company",
              links: [
                { label: "About Us", href: "/about" },
                { label: "Blog", href: "/blog" },
                { label: "Careers", href: "/careers" },
                { label: "Privacy Policy", href: "/privacy" },
              ],
            },
          ].map((col) => (
            <div key={col.title}>
              <div style={{ fontFamily: "monospace", fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "#C9973A", marginBottom: "20px" }}>{col.title}</div>
              <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                {col.links.map((link) => (
                  <li key={link.label}><Link href={link.href} style={{ fontFamily: "system-ui, sans-serif", fontSize: "14px", color: "rgba(247,243,238,0.5)", textDecoration: "none" }}>{link.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "32px", borderTop: "1px solid rgba(255,255,255,0.08)", fontFamily: "system-ui, sans-serif", fontSize: "13px", color: "rgba(247,243,238,0.3)", flexWrap: "wrap", gap: "8px" }}>
          <span>© 2025 AforAudience. All rights reserved.</span>
          <span>Made with ❤️ for the art world</span>
        </div>
      </footer>

      <style>{`
        @keyframes ticker {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        @media (min-width: 1600px) {
          .hero-stats-inline { display: none !important; }
          .hero-stats-gap { display: flex !important; }
        }
      `}</style>
    </main>
  );
}