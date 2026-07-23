-- Waitlist for full lineups. Additive only - existing PENDING/APPROVED/
-- REJECTED values and behavior untouched.
ALTER TYPE "ApplicationStatus" ADD VALUE 'WAITLISTED';
