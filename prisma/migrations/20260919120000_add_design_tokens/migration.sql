-- GEN-2609-075 - Admin-controlled design tokens, runtime layer (MVP).
-- Applied directly via Supabase:apply_migration against aforaudience-qa
-- (see 20260906120000_add_event_follow_target's own header for why this
-- project never uses `prisma migrate dev` / `_prisma_migrations` - shadow-
-- DB replay fails on an old migration and the pooled URL hangs the CLI).
-- This file documents what ran; it does not auto-run on its own.
--
-- Seeds DesignToken from globals.css's current defaults (82 existing
-- --afa-* tokens, values transcribed 1:1 from src/app/globals.css) plus
-- 11 new tokens this ticket introduces: 4 --afa-radius-* (Button.tsx's
-- border-radius values, previously hardcoded numbers, never tokenized),
-- 3 --afa-btn-padding-* (Button.tsx's SIZE_CHROME padding, same story),
-- and the 4 --font-* role tokens (display/ui/sans/mono), now pointing at
-- the --font-phys-* stable aliases added in layout.tsx so reassigning a
-- role's font never drifts if another role is reassigned too - see
-- src/lib/design-tokens.ts's header comment for the full reasoning.
--
-- `locked = true` on exactly 5 rows (surface-page, surface-raised, amber,
-- fill-solid, on-fill-solid) - the core brand palette, gated behind a
-- confirm dialog in the admin UI and re-checked server-side; unrelated to
-- check-design-tokens.js's own locked-palette CI rule, which keeps
-- blocking raw literals in application code regardless of this table.

CREATE TABLE "DesignToken" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT false,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DesignToken_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "DesignTokenVersion" (
  "id" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,

  CONSTRAINT "DesignTokenVersion_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DesignToken" ("key", "value", "group", "type", "locked", "updatedAt") VALUES
('--afa-amber', '#C9973A', 'color', 'color', true, now()),
('--afa-amber-tint', '#FFF8E1', 'color', 'color', false, now()),
('--afa-blue', '#4A6FA5', 'color', 'color', false, now()),
('--afa-blue-dark', '#2E5C8A', 'color', 'color', false, now()),
('--afa-brown-black', '#1A1000', 'color', 'color', false, now()),
('--afa-brown-dark', '#4A2E1A', 'color', 'color', false, now()),
('--afa-brown-gold', '#8A5A1E', 'color', 'color', false, now()),
('--afa-cream', '#F7F3EE', 'color', 'color', false, now()),
('--afa-cream-tint-1', '#FBF8F3', 'color', 'color', false, now()),
('--afa-cream-tint-2', '#FDF3E8', 'color', 'color', false, now()),
('--afa-cream-tint-3', '#FBF3E4', 'color', 'color', false, now()),
('--afa-error', '#B3261E', 'color', 'color', false, now()),
('--afa-error-bg', '#FDECEA', 'color', 'color', false, now()),
('--afa-error-border', '#F5C2C0', 'color', 'color', false, now()),
('--afa-forest', '#2F4A28', 'color', 'color', false, now()),
('--afa-gold', '#8A6A1F', 'color', 'color', false, now()),
('--afa-gold-bright', '#E8A800', 'color', 'color', false, now()),
('--afa-gray-taupe', '#8A877E', 'color', 'color', false, now()),
('--afa-gray-warm', '#6B655F', 'color', 'color', false, now()),
('--afa-green-black', '#001A10', 'color', 'color', false, now()),
('--afa-green-bright', '#2F7D4A', 'color', 'color', false, now()),
('--afa-green-dark', '#276749', 'color', 'color', false, now()),
('--afa-green-deep', '#166534', 'color', 'color', false, now()),
('--afa-green-forest', '#1E4620', 'color', 'color', false, now()),
('--afa-green-mid', '#2D6A4F', 'color', 'color', false, now()),
('--afa-indigo-black', '#0A001A', 'color', 'color', false, now()),
('--afa-indigo-gray', '#4A4A6A', 'color', 'color', false, now()),
('--afa-ink', '#0E0C0A', 'color', 'color', false, now()),
('--afa-ink-a13', '#0E0C0A22', 'color', 'color', false, now()),
('--afa-ink-a40', '#0E0C0A66', 'color', 'color', false, now()),
('--afa-ink-a8', '#0E0C0A15', 'color', 'color', false, now()),
('--afa-maroon', '#7A281F', 'color', 'color', false, now()),
('--afa-maroon-black', '#1A0500', 'color', 'color', false, now()),
('--afa-mint-tint', '#EAF3E7', 'color', 'color', false, now()),
('--afa-mint-tint-2', '#E7F4EC', 'color', 'color', false, now()),
('--afa-mist', '#E8E2D9', 'color', 'color', false, now()),
('--afa-olive', '#5A6B3A', 'color', 'color', false, now()),
('--afa-orange-dark', '#C2410C', 'color', 'color', false, now()),
('--afa-orange-tint', '#FFF3E6', 'color', 'color', false, now()),
('--afa-peach', '#F5A26E', 'color', 'color', false, now()),
('--afa-pink-dark', '#C2185B', 'color', 'color', false, now()),
('--afa-plum', '#7A4A8A', 'color', 'color', false, now()),
('--afa-plum-black', '#1A0A1A', 'color', 'color', false, now()),
('--afa-purple', '#7B4FA0', 'color', 'color', false, now()),
('--afa-red-alt', '#EF4444', 'color', 'color', false, now()),
('--afa-sage', '#4A6741', 'color', 'color', false, now()),
('--afa-social-blue', '#1D9BF0', 'color', 'color', false, now()),
('--afa-success-bg', '#F0FFF4', 'color', 'color', false, now()),
('--afa-tan', '#EDE4D6', 'color', 'color', false, now()),
('--afa-taupe', '#8A827A', 'color', 'color', false, now()),
('--afa-teal', '#3F8A72', 'color', 'color', false, now()),
('--afa-terracotta', '#C8441A', 'color', 'color', false, now()),
('--afa-terracotta-tint', '#FFF5F2', 'color', 'color', false, now()),
('--afa-white', '#FFF', 'color', 'color', false, now()),
('--afa-brand-mark', '#C8441A', 'color', 'color', false, now()),
('--afa-surface-page', '#141414', 'color', 'color', true, now()),
('--afa-surface-raised', '#1F1F1F', 'color', 'color', true, now()),
('--afa-surface-inverse', '#0A0A0A', 'color', 'color', false, now()),
('--afa-text-primary', '#F5F5F0', 'color', 'color', false, now()),
('--afa-text-secondary', 'rgba(245, 245, 240, 0.65)', 'color', 'color', false, now()),
('--afa-text-muted', 'rgba(245, 245, 240, 0.4)', 'color', 'color', false, now()),
('--afa-text-inverse', '#F5F5F0', 'color', 'color', false, now()),
('--afa-text-on-image', 'rgba(255, 255, 255, 0.5)', 'color', 'color', false, now()),
('--afa-fill-solid', '#FF5A36', 'color', 'color', true, now()),
('--afa-border-resting', 'rgba(245, 245, 240, 0.15)', 'color', 'color', false, now()),
('--afa-on-fill-solid', 'var(--afa-brown-black)', 'color', 'color', true, now()),
('--afa-sage-bright', '#7AA86E', 'color', 'color', false, now()),
('--afa-error-bright', '#E67870', 'color', 'color', false, now()),
('--afa-text-micro', '11px', 'size', 'dimension', false, now()),
('--afa-text-small', '12px', 'size', 'dimension', false, now()),
('--afa-text-ui', '13px', 'size', 'dimension', false, now()),
('--afa-text-body', '14px', 'size', 'dimension', false, now()),
('--afa-text-title', '16px', 'size', 'dimension', false, now()),
('--afa-text-heading', '24px', 'size', 'dimension', false, now()),
('--afa-text-page-title', '28px', 'size', 'dimension', false, now()),
('--afa-text-page-title-lg', '32px', 'size', 'dimension', false, now()),
('--afa-space-1', '4px', 'spacing', 'dimension', false, now()),
('--afa-space-2', '8px', 'spacing', 'dimension', false, now()),
('--afa-space-3', '12px', 'spacing', 'dimension', false, now()),
('--afa-space-4', '16px', 'spacing', 'dimension', false, now()),
('--afa-space-5', '20px', 'spacing', 'dimension', false, now()),
('--afa-space-6', '24px', 'spacing', 'dimension', false, now()),
('--afa-radius-sharp', '0px', 'radius', 'dimension', false, now()),
('--afa-radius-sm', '6px', 'radius', 'dimension', false, now()),
('--afa-radius-md', '8px', 'radius', 'dimension', false, now()),
('--afa-radius-pill', '999px', 'radius', 'dimension', false, now()),
('--afa-btn-padding-sm', '4px 10px', 'button', 'dimension-shorthand', false, now()),
('--afa-btn-padding-md', '9px 17px', 'button', 'dimension-shorthand', false, now()),
('--afa-btn-padding-lg', '12px 24px', 'button', 'dimension-shorthand', false, now()),
('--font-display', 'var(--font-phys-young-serif)', 'font', 'font-family', false, now()),
('--font-ui', 'var(--font-phys-schibsted-grotesk)', 'font', 'font-family', false, now()),
('--font-sans', 'var(--font-phys-instrument-sans)', 'font', 'font-family', false, now()),
('--font-mono', 'var(--font-phys-jetbrains-mono)', 'font', 'font-family', false, now());
