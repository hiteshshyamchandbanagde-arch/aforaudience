-- Session 39, PR #224: GenreRequest tracks "Other" genre submissions
-- pending admin approval before they become a public filter-chip option
-- on /artists. Applied to QA via Supabase:apply_migration MCP; this file
-- is documentation only (does not propagate to prod).
CREATE TYPE "GenreRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "GenreRequest" (
  "id" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "status" "GenreRequestStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "GenreRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GenreRequest_value_key" ON "GenreRequest"("value");
