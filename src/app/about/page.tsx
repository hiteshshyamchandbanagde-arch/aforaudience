import type { Metadata } from "next"
import Link from "next/link"
import SiteNav from "@/components/SiteNav"

export const metadata: Metadata = {
  title: "About — AforAudience",
  description:
    "We built this because live art in India deserved a home. A note from the founder, our beliefs, and the promises we hold ourselves to.",
}

// ---------------------------------------------------------------------------
// Design tokens — reuse the site's existing brand vocabulary rather than
// introducing new fonts/colors. Consistency with the rest of the app matters
// more than novelty on a slow-read editorial page.
// ---------------------------------------------------------------------------
const INK = "#0E0C0A"
const PAPER = "#F7F3EE"
const EMBER = "#C8441A"
const MIST = "#E8E2D9"
const SERIF = "Georgia, 'Playfair Display', serif"
const SANS = "system-ui, -apple-system, sans-serif"
const MONO = "ui-monospace, 'SF Mono', Menlo, monospace"

// Small ornament used between beats of the founder note — used sparingly.
function Ornament() {
  return (
    <div
      aria-hidden
      style={{
        textAlign: "center",
        color: EMBER,
        opacity: 0.55,
        fontFamily: SERIF,
        fontSize: "20px",
        letterSpacing: "0.6em",
        paddingLeft: "0.6em",
        margin: "56px 0",
      }}
    >
      · · ·
    </div>
  )
}

// Small uppercase eyebrow — used at the top of each act to encode structure
// (this page really is six acts of an argument, so the numbering carries
// information, not decoration).
function ActLabel({ num, label }: { num: string; label: string }) {
  return (
    <div
      style={{
        fontFamily: MONO,
        fontSize: "11px",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        color: EMBER,
        marginBottom: "20px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
      }}
    >
      <span>{num}</span>
      <span aria-hidden style={{ display: "inline-block", width: "36px", height: "1px", background: EMBER, opacity: 0.5 }} />
      <span style={{ color: INK, opacity: 0.55 }}>{label}</span>
    </div>
  )
}

// Pull-quote — used only 3 times across the whole page for the lines that
// carry the argument's weight.
function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote
      style={{
        fontFamily: SERIF,
        fontStyle: "italic",
        fontSize: "clamp(26px, 3.6vw, 40px)",
        lineHeight: 1.25,
        color: EMBER,
        letterSpacing: "-0.01em",
        borderLeft: `2px solid ${EMBER}`,
        paddingLeft: "clamp(20px, 3vw, 32px)",
        margin: "48px 0",
      }}
    >
      {children}
    </blockquote>
  )
}

// Section heading — the title of each act
function ActTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: SERIF,
        fontSize: "clamp(32px, 4vw, 48px)",
        fontWeight: 700,
        lineHeight: 1.15,
        letterSpacing: "-0.02em",
        color: INK,
        marginBottom: "32px",
      }}
    >
      {children}
    </h2>
  )
}

// Subheading inside a section
function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: SERIF,
        fontSize: "clamp(22px, 2.4vw, 28px)",
        fontWeight: 700,
        lineHeight: 1.25,
        letterSpacing: "-0.01em",
        color: INK,
        marginTop: "48px",
        marginBottom: "20px",
      }}
    >
      {children}
    </h3>
  )
}

// Body paragraph — the workhorse text style
function P({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: SERIF,
        fontSize: "clamp(17px, 1.4vw, 19px)",
        lineHeight: 1.75,
        color: INK,
        opacity: 0.88,
        marginBottom: "22px",
      }}
    >
      {children}
    </p>
  )
}

// Strong inline — used for the emphasized in-flow lines like "connection"
function E({ children }: { children: React.ReactNode }) {
  return (
    <strong style={{ color: INK, fontWeight: 700 }}>{children}</strong>
  )
}

// Italic in-flow, using serif italic
function I({ children }: { children: React.ReactNode }) {
  return <em style={{ fontStyle: "italic" }}>{children}</em>
}

export default function AboutPage() {
  return (
    <main style={{ background: PAPER, color: INK, minHeight: "100vh" }}>
      <SiteNav />

      {/* ================================================================
          MASTHEAD — quiet, editorial. No hero image. The words are the hero.
          A tiny eyebrow, a large serif title, a subtitle in italic.
          ================================================================ */}
      <header
        style={{
          maxWidth: "760px",
          margin: "0 auto",
          padding: "clamp(64px, 10vw, 128px) clamp(24px, 5vw, 40px) clamp(48px, 8vw, 80px)",
        }}
      >
        <div
          style={{
            fontFamily: MONO,
            fontSize: "11px",
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: EMBER,
            marginBottom: "28px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <span aria-hidden style={{ display: "inline-block", width: "32px", height: "1px", background: EMBER }} />
          <span>About</span>
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: "clamp(40px, 6vw, 68px)",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: INK,
            marginBottom: "24px",
          }}
        >
          We built this because <I>live art in India</I> deserved a home.
        </h1>
        <p
          style={{
            fontFamily: SERIF,
            fontStyle: "italic",
            fontSize: "clamp(18px, 1.8vw, 22px)",
            lineHeight: 1.55,
            color: INK,
            opacity: 0.6,
            maxWidth: "560px",
          }}
        >
          A note from the founder — followed by the beliefs we build against, the promises we hold ourselves to, and what we are asking of you.
        </p>
      </header>

      {/* ================================================================
          THE ARTICLE COLUMN — narrow measure (~680px), heavy vertical
          rhythm, generous type. Everything below sits inside this container.
          ================================================================ */}
      <div
        style={{
          maxWidth: "680px",
          margin: "0 auto",
          padding: "0 clamp(24px, 5vw, 40px) clamp(80px, 10vw, 140px)",
        }}
      >
        {/* ====== I. Founder note ====== */}
        <section>
          <ActLabel num="I" label="A note from the founder" />

          <P>
            I am a performing artist. I know what it is to write something in silence and wonder if it will ever be heard. Every performing artist, poet, comedian, dancer, singer, storyteller, and theatre artist I have met knows the same feeling.
          </P>

          <P>For years, I watched something bother me.</P>

          <P>
            A comedian I loved would perform in a Pune café to seventeen people, and three days later I&rsquo;d learn about it on social media — too late. A poet from Kochi would post a video that would move me to tears, and I&rsquo;d have no way to know when she was performing next, or where, or how to be in the room. A venue owner in Andheri would tell me his space sat empty most Tuesdays, while a group of theatre students two kilometres away scrambled to find somewhere to stage their play. An artist I&rsquo;d followed for a year would quietly stop posting, because getting booked was too hard, and the gigs paid too little, and nobody was watching.
          </P>

          <P>
            None of these problems were technology problems. They were <E>connection</E> problems.
          </P>

          <P>
            The live art scene in India — comedy, poetry, music, dance, theatre, storytelling, everything raw and beautiful and unstreamable — has never had a home. It lives on messaging-app forwards, on stories that vanish in 24 hours, on posters in cafés you happened to walk past. The artists are extraordinary. The audiences are hungry. The venues are ready.
          </P>

          <PullQuote>But there is no thread connecting them.</PullQuote>

          <P>
            <E>AforAudience is that thread.</E>
          </P>

          <P>
            That&rsquo;s the whole point. That&rsquo;s the entire idea. Everything else — the seat maps, the Navarasa search, the artist profiles, the venue calendars, the tips, the reviews — those are just how we make the thread strong enough to hold.
          </P>

          <div
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: "17px",
              color: INK,
              opacity: 0.55,
              marginTop: "40px",
            }}
          >
            — The Founder
          </div>
        </section>

        <Ornament />

        {/* ====== II. What we believe ====== */}
        <section>
          <ActLabel num="II" label="What we believe" />
          <ActTitle>Four beliefs we build against.</ActTitle>

          <Sub>Live art is not entertainment. It is a form of being together.</Sub>
          <P>There is something a screen cannot give you. Something an OTT special cannot give you. Something a streaming service cannot give you.</P>
          <P>
            It is the shared breath of a room when a comedian says the thing no one was supposed to say. It is the silence after a poet&rsquo;s last line. It is the moment a musician looks up from her instrument and <I>sees</I> the audience seeing her. It is the way a theatre actor&rsquo;s voice fills a small room and changes the air.
          </P>
          <P>
            That is what live art is for. Not consumption. <E>Communion.</E>
          </P>
          <P>
            We built AforAudience because that experience should not depend on luck, algorithms, or knowing the right people. It should be one tap away.
          </P>

          <Sub>The artist is the point. Everyone else — including us — is in service of the artist.</Sub>
          <P>We don&rsquo;t say this lightly.</P>
          <P>
            Every artist who joins AforAudience gets something they have never had before: <E>a portable, permanent reputation.</E> A comedian who kills it in Bengaluru can walk into a room in Berlin next year with the receipts to prove it. A poet who moved an audience in Kochi can show a Mumbai organiser exactly what happened in that room. Every review, every rating, every follow, every tip becomes part of that artist&rsquo;s story — proof that travels with them.
          </P>
          <P>That is new. That is what we exist for.</P>
          <P>
            And we mean it especially for the artists nobody has heard of yet. The 14-year-old writing poems in a small town. The 40-year-old walking into their first open mic. The theatre student staging her first play. The dancer whose classical training has never met an audience beyond her guru&rsquo;s living room. <E>They deserve a stage they can find, an audience that can find them, and a record of what happened that they own forever.</E>
          </P>

          <Sub>The audience is not the product. The audience is the co-author.</Sub>
          <P>
            You&rsquo;ll notice we don&rsquo;t call our users &ldquo;consumers.&rdquo; We call them the audience. Because that is what they are — and it is not a small word.
          </P>
          <P>
            When you attend a show on AforAudience, you are not just watching. You are the second half of the art. Your presence, your reaction, your rating, your review — those shape what happens next. You decide which artists rise. You decide which venues thrive. You decide which cities become live art capitals.
          </P>
          <P>
            <E>We build the platform. You build the scene.</E>
          </P>

          <Sub>The scene doesn&rsquo;t belong to any one city. Or any one country.</Sub>
          <P>
            We started in India because it is where we live and where the wound was clearest. But live art is universal. A stand-up comedian in Lagos. A slam poet in Manila. A folk musician in Buenos Aires. A theatre collective in Nairobi. They all deserve what our Pune poets and Mumbai comedians deserve. Discoverability. Dignity. A room full of the right people. A record of the work that carries their name forward.
          </P>
          <P>
            AforAudience will be for them too — not as a copy of the Indian model, but as an invitation to build their own scenes on the same connective tissue.
          </P>
          <P>
            <E>Our vision is not to be a bigger ticketing site. It is to be the world&rsquo;s first shared home for live art.</E>
          </P>
        </section>

        <Ornament />

        {/* ====== III. What we promise ====== */}
        <section>
          <ActLabel num="III" label="What we promise" />
          <ActTitle>Four promises we hold ourselves to.</ActTitle>

          <P>
            We are a young platform. We will make mistakes. But some things we decided from Day One, and we won&rsquo;t compromise on:
          </P>

          <Sub>We will never tax the scene.</Sub>
          <P>
            Not the venue owner who takes a chance on a new comic. Not the organiser who runs an open mic on a Wednesday night. Not the artist who is just starting out. Not the rental between a venue and an organiser. Not the fee an organiser pays a performer.
          </P>

          <PullQuote>None of it.</PullQuote>

          <P>
            We will build a real business over time — through optional Pro features for venues and organisers who want more, through a small booking fee on audience tickets (which we use, transparently, to keep the platform free for artists), through livestream revenue shares, through featured placements. That is how we sustain ourselves.
          </P>
          <P>
            But the <E>core transaction of live art itself — artist, organiser, venue, audience — will remain untaxed by us. Forever.</E>
          </P>
          <P>That is not a marketing line. It is a design constraint we hold ourselves to.</P>

          <Sub>The free version will always be genuinely useful.</Sub>
          <P>
            We will not cripple free features to force upgrades. If a free artist profile is worse than what you can already build for yourself elsewhere, we have failed. Pro tiers exist for people who want <I>more</I>, not for people who want <I>what free should already give them</I>.
          </P>

          <Sub>We will earn our right to charge before we charge.</Sub>
          <P>
            We would rather grow slower with your trust than grow faster without it. Every rupee we ever take from you will be optional, transparent, and tied to something we uniquely provide.
          </P>

          <Sub>We will remember who this is for.</Sub>
          <P>
            Every product decision — every feature, every filter, every default — will pass through one question: <I>does this serve the artist, the audience, the organiser, the venue?</I> If it only serves us, we will not ship it.
          </P>
        </section>

        <Ornament />

        {/* ====== IV. What you get, as an audience member ====== */}
        <section>
          <ActLabel num="IV" label="What you get, as an audience member" />
          <ActTitle>You are not a user. You are a patron.</ActTitle>

          <P>
            You are not a passive user here. You are a <E>patron</E> — in the oldest, most beautiful sense of the word.
          </P>
          <P>When you book a show on AforAudience:</P>

          <ol
            style={{
              listStyle: "none",
              padding: 0,
              margin: "32px 0",
              counterReset: "patron",
            }}
          >
            {[
              {
                title: "You are discovering art that would otherwise be hidden.",
                body: "Small rooms, unknown poets, first-time comics, veterans playing intimate shows, theatre groups running their first production, dancers presenting their first solo. Not the big, promoted stuff — the real stuff.",
              },
              {
                title: "You are voting with your presence.",
                body: "Every ticket you buy tells us — and the world — which artists to watch.",
              },
              {
                title: "You are leaving a fingerprint on someone's career.",
                body: "Your review, your rating, your follow becomes part of the artist's permanent story. When a venue in a city they have never been to asks \u201Cshould we book them?\u201D, your voice is part of the answer.",
              },
              {
                title: "You are helping an artist become visible to the world.",
                body: "Every rating you leave, every artist you follow, every tip you send is a signal that travels beyond this platform. You are how great artists stop being local secrets.",
              },
              {
                title: "You are building your own Art Passport.",
                body: "Every show you attend, every city you experience it in, every emotion (Navarasa) you sit with — becomes a badge, a record, a life in art. Something to look back on. Something to be proud of.",
              },
              {
                title: "You are supporting the platform that makes it possible.",
                body: "Through a small booking fee that lets us keep it free for the artists you love.",
              },
            ].map((item, idx) => (
              <li
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "48px 1fr",
                  gap: "clamp(12px, 2vw, 20px)",
                  padding: "24px 0",
                  borderBottom: `1px solid ${MIST}`,
                }}
              >
                <div
                  aria-hidden
                  style={{
                    fontFamily: SERIF,
                    fontSize: "clamp(28px, 3vw, 36px)",
                    fontStyle: "italic",
                    color: EMBER,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                    paddingTop: "6px",
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(18px, 1.6vw, 21px)",
                      fontWeight: 700,
                      color: INK,
                      marginBottom: "8px",
                      lineHeight: 1.4,
                    }}
                  >
                    {item.title}
                  </div>
                  <div
                    style={{
                      fontFamily: SERIF,
                      fontSize: "clamp(16px, 1.3vw, 18px)",
                      color: INK,
                      opacity: 0.7,
                      lineHeight: 1.7,
                    }}
                  >
                    {item.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <P>
            <E>That is not consumption. That is participation.</E>
          </P>
        </section>

        <Ornament />

        {/* ====== V. What we ask of you ====== */}
        <section>
          <ActLabel num="V" label="What we ask of you" />
          <ActTitle>The whole deal, in four lines.</ActTitle>

          <div style={{ margin: "40px 0 32px" }}>
            {[
              { role: "an artist", ask: "bring your craft. We will bring the audience." },
              { role: "an organiser", ask: "run the shows you have been dreaming of. We will bring the tools." },
              { role: "a venue owner", ask: "open your doors on the nights they used to be closed. We will bring the people who fill them." },
              { role: "an audience member", ask: "show up. Sit with strangers. Feel something together. Then tell us — and the world — what you felt." },
            ].map((item) => (
              <div
                key={item.role}
                style={{
                  fontFamily: SERIF,
                  fontSize: "clamp(17px, 1.5vw, 20px)",
                  lineHeight: 1.7,
                  color: INK,
                  marginBottom: "20px",
                  paddingLeft: "clamp(16px, 2vw, 24px)",
                  borderLeft: `2px solid ${MIST}`,
                }}
              >
                If you are <E>{item.role}</E>: {item.ask}
              </div>
            ))}
          </div>

          <P>
            <E>That is the whole deal.</E>
          </P>
        </section>

        <Ornament />

        {/* ====== VI. Who we are ====== */}
        <section>
          <ActLabel num="VI" label="Who we are" />

          <P>
            AforAudience is built by one person right now, working nights and weekends, funded from their own pocket, in service of a scene they love. That will change over time — one day there will be a team, and offices, and all the trappings of a company. But the reason we exist will not.
          </P>
          <P>We are not here to be the next unicorn.</P>

          <PullQuote>We are here to be the last platform an artist ever needs.</PullQuote>
        </section>

        <Ornament />

        {/* ====== Closing note + signoff ====== */}
        <section>
          <P>
            <I>
              If you have read this far, thank you. Genuinely. If any part of this resonates with your own experience of live art — as artist, as organiser, as venue, as audience — then this platform is yours. Come build it with us.
            </I>
          </P>

          <div
            style={{
              marginTop: "72px",
              paddingTop: "48px",
              borderTop: `1px solid ${MIST}`,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: "clamp(28px, 4vw, 44px)",
                lineHeight: 1.2,
                color: EMBER,
                letterSpacing: "-0.01em",
                marginBottom: "20px",
              }}
            >
              Where art finds its crowd.
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: "11px",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: INK,
                opacity: 0.5,
              }}
            >
              — AforAudience
            </div>
          </div>

          {/* Quiet CTAs so a moved reader has somewhere to go */}
          <div
            style={{
              marginTop: "64px",
              display: "flex",
              gap: "12px",
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <Link
              href="/events"
              style={{
                fontFamily: SANS,
                fontSize: "14px",
                fontWeight: 600,
                color: PAPER,
                background: INK,
                padding: "14px 28px",
                borderRadius: "6px",
                textDecoration: "none",
              }}
            >
              Explore Events
            </Link>
            <Link
              href="/register"
              style={{
                fontFamily: SANS,
                fontSize: "14px",
                fontWeight: 600,
                color: INK,
                background: "transparent",
                padding: "14px 28px",
                borderRadius: "6px",
                textDecoration: "none",
                border: `1.5px solid ${INK}`,
              }}
            >
              Join AforAudience
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
