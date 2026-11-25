-- "Artist Background" expanded storytelling section. Additive only,
-- all nullable.
ALTER TABLE "Artist" ADD COLUMN "tagline" TEXT;
ALTER TABLE "Artist" ADD COLUMN "fullBiography" TEXT;
ALTER TABLE "Artist" ADD COLUMN "journey" TEXT;
ALTER TABLE "Artist" ADD COLUMN "influences" TEXT;
ALTER TABLE "Artist" ADD COLUMN "acknowledgments" TEXT;
ALTER TABLE "Artist" ADD COLUMN "goals" TEXT;
