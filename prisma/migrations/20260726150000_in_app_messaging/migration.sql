-- In-app messaging (session 36, 26 Jul) — design.md §9.4.
-- Generic Conversation/Message/ConversationParticipant shape shared by
-- all three confirmed-relationship pairs (Artist<->Organiser via
-- PERFORMANCE, Organiser<->Venue Owner via VENUE_BOOKING, Audience<->
-- Organiser via BOOKING, per-booking granularity per Hitesh's 26 Jul
-- decision). contextType/contextId is a loose reference, not an FK -
-- it points at a different table depending on contextType.

CREATE TYPE "ConversationContextType" AS ENUM ('PERFORMANCE', 'VENUE_BOOKING', 'BOOKING');

CREATE TABLE "Conversation" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "contextType" "ConversationContextType" NOT NULL,
  "contextId" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Conversation_contextType_contextId_key" ON "Conversation"("contextType", "contextId");

CREATE TABLE "ConversationParticipant" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "lastReadAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

CREATE TABLE "Message" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES "User"("id"),
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- RLS deny-by-default, same pattern as every table since the tenth
-- amendment (15 Jul) - Prisma bypasses via the postgres role, no policy
-- needed since only server-side API routes touch these tables.
ALTER TABLE "Conversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConversationParticipant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;
