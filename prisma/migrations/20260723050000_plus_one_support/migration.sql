-- "+1" mandatory audience support feature.
ALTER TABLE "Event" ADD COLUMN "plusOnesRequired" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PlusOne" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "performanceId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlusOne_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlusOne_userId_performanceId_key" ON "PlusOne"("userId", "performanceId");

ALTER TABLE "PlusOne" ADD CONSTRAINT "PlusOne_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlusOne" ADD CONSTRAINT "PlusOne_performanceId_fkey" FOREIGN KEY ("performanceId") REFERENCES "Performance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlusOne" ADD CONSTRAINT "PlusOne_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
