-- FEAT-2608-045 follow-up (11 Aug) - structured age limit replaces the
-- AGE_RESTRICTION checklist checkbox; Dress code merges into the
-- existing Event.dresscode field rather than a duplicate checklist item.
ALTER TABLE "Event" ADD COLUMN "ageLimit" TEXT;

-- Clean up the one QA event that used the now-removed checklist keys
-- (AGE_RESTRICTION, DRESS_CODE) before they're dropped from the known-key
-- list - an old key surviving in the array is harmless (server-side
-- filtering on the known list already ignores it), but no reason to
-- leave it stale.
UPDATE "Event"
SET "termsChecklist" = array_remove(array_remove("termsChecklist", 'AGE_RESTRICTION'), 'DRESS_CODE')
WHERE 'AGE_RESTRICTION' = ANY("termsChecklist") OR 'DRESS_CODE' = ANY("termsChecklist");
