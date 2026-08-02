-- FEAT-2608-036 follow-up: carry country alongside defaultCity so the
-- header chip can show "Pune (IN)" for a saved/chosen location too.
ALTER TABLE "User" ADD COLUMN "defaultCountry" TEXT;
