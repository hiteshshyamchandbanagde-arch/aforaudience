-- Optional screenshot attachment on feedback submissions. Stored as a
-- base64 data URL directly on the row for MVP simplicity — no Vercel
-- Blob/S3 wired up yet. Client resizes images to fit well under ~1MB
-- before encoding. Fine at low volume; migrate to real blob storage if
-- attachments become heavily used.

ALTER TABLE "Feedback"
  ADD COLUMN "attachmentData" TEXT;
