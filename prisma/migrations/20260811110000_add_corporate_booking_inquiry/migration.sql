-- FEAT-2608-046: corporate show booking, inquiry-only (no payment flow)
CREATE TYPE "CorporateInquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

CREATE TABLE "CorporateBookingInquiry" (
    "id" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "eventType" TEXT,
    "city" TEXT,
    "preferredDate" TIMESTAMP(3),
    "budgetRange" TEXT,
    "message" TEXT,
    "status" "CorporateInquiryStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorporateBookingInquiry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CorporateBookingInquiry_artistId_idx" ON "CorporateBookingInquiry"("artistId");

ALTER TABLE "CorporateBookingInquiry" ADD CONSTRAINT "CorporateBookingInquiry_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
