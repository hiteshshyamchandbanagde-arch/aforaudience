-- Session 62 - Organiser/Venue Owner bio profiles + Audience optional bio (design.md §9.5)
-- User.bio: optional "About You" text, applies to any role but primarily targets
-- Audience (who have no dedicated child profile table) since their name+photo
-- already surface publicly in ratings/feedback today.
ALTER TABLE "User" ADD COLUMN "bio" TEXT;

-- VenueOwner.bio: Organiser already has a bio column; VenueOwner didn't.
ALTER TABLE "VenueOwner" ADD COLUMN "bio" TEXT;
