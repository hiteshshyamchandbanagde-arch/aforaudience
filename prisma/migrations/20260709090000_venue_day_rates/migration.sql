-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateTable
CREATE TABLE "VenueDayRate" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "hourlyRate" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION,

    CONSTRAINT "VenueDayRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VenueDayRate_venueId_dayOfWeek_key" ON "VenueDayRate"("venueId", "dayOfWeek");

ALTER TABLE "VenueDayRate" ADD CONSTRAINT "VenueDayRate_venueId_fkey"
    FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
