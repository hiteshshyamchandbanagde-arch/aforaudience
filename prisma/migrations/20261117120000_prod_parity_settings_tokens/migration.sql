-- Prod parity (16 Nov). A database built only from `prisma migrate deploy`
-- did not match QA (QA was fixed out-of-band). Idempotent, and a no-op on
-- QA: every statement only touches rows QA does not have or values QA
-- already holds. scripts/migration-seed-parity.test.ts replays every
-- migration and checks the result against globals.css.

-- 1. 20260709070000 inserted a 'default' row; the live row is 'singleton'
--    (20260713190000). Remove the dead one so nothing can read it.
DELETE FROM "PlatformSettings" WHERE "id" = 'default';

-- 2. Two stale values that would override globals.css at runtime.
UPDATE "DesignToken" SET "value" = 'rgba(201, 151, 58, 0.15)', "updatedAt" = now()
WHERE "key" = '--afa-amber-tint' AND "value" <> 'rgba(201, 151, 58, 0.15)';
UPDATE "DesignToken" SET "value" = 'rgba(245, 245, 240, 0.5)', "updatedAt" = now()
WHERE "key" = '--afa-text-muted' AND "value" <> 'rgba(245, 245, 240, 0.5)';

-- 3. Keys globals.css no longer defines (QA does not have them).
DELETE FROM "DesignToken" WHERE "key" IN (
  '--afa-error-border',
  '--afa-radius-10px',
  '--afa-radius-12px',
  '--afa-red-alt',
  '--afa-terracotta',
  '--afa-text-10px',
  '--afa-text-15px',
  '--afa-text-18px',
  '--afa-text-20px',
  '--afa-text-inverse'
);

-- 4. Keys QA has that no migration inserted (values from QA, all unlocked).
--    --afa-amber-tint is here too: 20260921120000 deleted it, so a fresh
--    replay has no row for the UPDATE above to fix.
INSERT INTO "DesignToken" ("key", "value", "group", "type", "locked", "updatedAt") VALUES
('--afa-amber-border', 'rgba(201, 151, 58, 0.4)', 'color', 'color', false, now()),
('--afa-amber-strong', 'rgba(201, 151, 58, 0.6)', 'color', 'color', false, now()),
('--afa-amber-tint', 'rgba(201, 151, 58, 0.15)', 'color', 'color', false, now()),
('--afa-amber-wash', 'rgba(201, 151, 58, 0.08)', 'color', 'color', false, now()),
('--afa-blue-tint', 'rgba(74, 111, 165, 0.15)', 'color', 'color', false, now()),
('--afa-btn-padding-pill-md', '10px 18px', 'button', 'dimension-shorthand', false, now()),
('--afa-btn-padding-pill-sm', '6px 14px', 'button', 'dimension-shorthand', false, now()),
('--afa-error-edge', 'rgba(179, 38, 30, 0.3)', 'color', 'color', false, now()),
('--afa-error-tint', 'rgba(179, 38, 30, 0.1)', 'color', 'color', false, now()),
('--afa-fill-tint', 'rgba(255, 90, 54, 0.2)', 'color', 'color', false, now()),
('--afa-radius-2xl', '20px', 'radius', 'dimension', false, now()),
('--afa-radius-lg', '12px', 'radius', 'dimension', false, now()),
('--afa-radius-xl', '16px', 'radius', 'dimension', false, now()),
('--afa-radius-xs', '3px', 'radius', 'dimension', false, now()),
('--afa-sage-tint', 'rgba(74, 103, 65, 0.12)', 'color', 'color', false, now()),
('--afa-scrim', 'rgba(10, 10, 10, 0.7)', 'color', 'color', false, now()),
('--afa-scrim-strong', 'rgba(10, 10, 10, 0.9)', 'color', 'color', false, now()),
('--afa-selected', 'var(--afa-amber)', 'color', 'color', false, now()),
('--afa-selected-bg', 'rgba(201, 151, 58, 0.08)', 'color', 'color', false, now()),
('--afa-selected-border', 'rgba(201, 151, 58, 0.4)', 'color', 'color', false, now()),
('--afa-shadow', 'rgba(0, 0, 0, 0.3)', 'color', 'color', false, now()),
('--afa-space-36px', '36px', 'spacing', 'dimension', false, now()),
('--afa-space-40px', '40px', 'spacing', 'dimension', false, now()),
('--afa-space-56px', '56px', 'spacing', 'dimension', false, now()),
('--afa-space-64px', '64px', 'spacing', 'dimension', false, now()),
('--afa-space-80px', '80px', 'spacing', 'dimension', false, now()),
('--afa-success-tint', 'rgba(39, 103, 73, 0.15)', 'color', 'color', false, now()),
('--afa-text-body-lg', '15px', 'size', 'dimension', false, now()),
('--afa-text-caption', '10px', 'size', 'dimension', false, now()),
('--afa-text-display', '26px', 'size', 'dimension', false, now()),
('--afa-text-lead', '18px', 'size', 'dimension', false, now()),
('--afa-text-soft', 'rgba(245, 245, 240, 0.8)', 'color', 'color', false, now()),
('--afa-text-subheading', '22px', 'size', 'dimension', false, now()),
('--afa-text-subtitle', '20px', 'size', 'dimension', false, now()),
('--afa-tint-04', 'rgba(245, 245, 240, 0.04)', 'color', 'color', false, now()),
('--afa-tint-06', 'rgba(245, 245, 240, 0.06)', 'color', 'color', false, now()),
('--afa-tint-12', 'rgba(245, 245, 240, 0.12)', 'color', 'color', false, now()),
('--afa-tint-20', 'rgba(245, 245, 240, 0.2)', 'color', 'color', false, now()),
('--afa-tint-30', 'rgba(245, 245, 240, 0.3)', 'color', 'color', false, now()),
('--font-display', 'var(--font-phys-young-serif)', 'font', 'font-family', false, now()),
('--font-mono', 'var(--font-phys-jetbrains-mono)', 'font', 'font-family', false, now()),
('--font-sans', 'var(--font-phys-instrument-sans)', 'font', 'font-family', false, now()),
('--font-ui', 'var(--font-phys-schibsted-grotesk)', 'font', 'font-family', false, now())
ON CONFLICT ("key") DO NOTHING;
