/**
 * Venue seed script — see docs/venue-seed-spec.md for the full brief.
 *
 * Two-step, additive-only script. Never touches existing Users, Artists,
 * Bookings, Events, or the 12 pre-existing Venues — only backfills missing
 * VenueOwner rows and tops up each VenueOwner to exactly 10 Venues.
 *
 * Step 1 — VenueOwner backfill: every User with role VENUE_OWNER that has
 * no VenueOwner row yet gets one (isApproved: true).
 *
 * Step 2 — Venue top-up: every VenueOwner (all ~113 after step 1) ends up
 * with exactly 10 Venues, 4 distinct cities (GA + Numbered(Guided) + Canvas
 * layout per docs/venue-seed-spec.md's table), realistic name/address,
 * city-centroid lat/lng, min 3 HOURLY/3 DAILY/3 FLEXIBLE rate types, real
 * Seat rows for NUMBERED venues.
 *
 * Run:
 *   npx tsx scripts/qa-seed-venues.ts --check-only   (guard check only, no DB writes, no DB connection)
 *   npx tsx scripts/qa-seed-venues.ts                (default: preview, read-only)
 *   npx tsx scripts/qa-seed-venues.ts --preview      (same as above, explicit)
 *   npx tsx scripts/qa-seed-venues.ts --execute      (real run — writes to the DB)
 *
 * Defaults to preview (like scripts/qa-fix-user-display-names.ts) given the
 * real volume here (~1130 Venues, hundreds of thousands of Seat rows).
 */

import "dotenv/config"
import { PrismaClient, Role, RateType, VenueSeatingMode } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// ---------------------------------------------------------------------------
// Hard guard — identical pattern to the other qa-*.ts scripts.
// ---------------------------------------------------------------------------

const QA_PROJECT_REF = "nqiyrypmjtogoocerxtu"
const PROD_PROJECT_REF = "cncumfwwnjcwacggrgsr"

function assertQaDatabase(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("[seed-venues] DATABASE_URL is not set. Refusing to run.")
    process.exit(1)
  }
  if (url.includes(PROD_PROJECT_REF)) {
    console.error(`[seed-venues] DATABASE_URL points at PROD (${PROD_PROJECT_REF}). Refusing to run.`)
    process.exit(1)
  }
  if (!url.includes(QA_PROJECT_REF)) {
    console.error(`[seed-venues] DATABASE_URL does not reference the QA project (${QA_PROJECT_REF}). Refusing to run.`)
    process.exit(1)
  }
  return url
}

// ---------------------------------------------------------------------------
// Deterministic hash — same FNV-1a approach as qa-fix-user-display-names.ts.
// ---------------------------------------------------------------------------

function hashInt(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}
function pickIndex(seed: string, poolLength: number): number {
  return hashInt(seed) % poolLength
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// ---------------------------------------------------------------------------
// City pool — 30 India (Pune-first) + 7 international, per spec. Centroid
// lat/lng are approximate (city-scale, not geocode-accurate — per spec,
// good enough for map-plotting realism at seed-data scale). Neighborhood
// lists are a curated handful of real, well-known localities per city, not
// exhaustive (per spec).
// ---------------------------------------------------------------------------

type CityInfo = { name: string; state: string; country: string; lat: number; lng: number; neighborhoods: string[] }

const CITY_POOL: CityInfo[] = [
  { name: "Pune", state: "Maharashtra", country: "India", lat: 18.5204, lng: 73.8567, neighborhoods: ["Koregaon Park", "FC Road", "Baner", "Viman Nagar", "Kalyani Nagar"] },
  { name: "Mumbai", state: "Maharashtra", country: "India", lat: 19.0760, lng: 72.8777, neighborhoods: ["Bandra", "Andheri", "Lower Parel", "Powai", "Juhu"] },
  { name: "Bengaluru", state: "Karnataka", country: "India", lat: 12.9716, lng: 77.5946, neighborhoods: ["Indiranagar", "Koramangala", "Whitefield", "MG Road", "Jayanagar"] },
  { name: "Delhi", state: "Delhi", country: "India", lat: 28.7041, lng: 77.1025, neighborhoods: ["Connaught Place", "Hauz Khas", "Saket", "Dwarka", "Karol Bagh"] },
  { name: "Hyderabad", state: "Telangana", country: "India", lat: 17.3850, lng: 78.4867, neighborhoods: ["Banjara Hills", "Jubilee Hills", "Gachibowli", "Madhapur", "Secunderabad"] },
  { name: "Chennai", state: "Tamil Nadu", country: "India", lat: 13.0827, lng: 80.2707, neighborhoods: ["T Nagar", "Adyar", "Anna Nagar", "Nungambakkam", "Velachery"] },
  { name: "Kolkata", state: "West Bengal", country: "India", lat: 22.5726, lng: 88.3639, neighborhoods: ["Park Street", "Salt Lake", "Ballygunge", "New Town", "Alipore"] },
  { name: "Ahmedabad", state: "Gujarat", country: "India", lat: 23.0225, lng: 72.5714, neighborhoods: ["Navrangpura", "Satellite", "Vastrapur", "Bodakdev", "CG Road"] },
  { name: "Jaipur", state: "Rajasthan", country: "India", lat: 26.9124, lng: 75.7873, neighborhoods: ["Civil Lines", "C-Scheme", "Malviya Nagar", "Vaishali Nagar", "Mansarovar"] },
  { name: "Nagpur", state: "Maharashtra", country: "India", lat: 21.1458, lng: 79.0882, neighborhoods: ["Sitabuldi", "Dharampeth", "Civil Lines", "Sadar", "Ramdaspeth"] },
  { name: "Indore", state: "Madhya Pradesh", country: "India", lat: 22.7196, lng: 75.8577, neighborhoods: ["Vijay Nagar", "Rajwada", "Palasia", "Sapna Sangeeta", "Bhawarkuan"] },
  { name: "Chandigarh", state: "Chandigarh", country: "India", lat: 30.7333, lng: 76.7794, neighborhoods: ["Sector 17", "Sector 22", "Sector 35", "Elante", "Sector 9"] },
  { name: "Lucknow", state: "Uttar Pradesh", country: "India", lat: 26.8467, lng: 80.9462, neighborhoods: ["Hazratganj", "Gomti Nagar", "Aliganj", "Indira Nagar", "Alambagh"] },
  { name: "Bhopal", state: "Madhya Pradesh", country: "India", lat: 23.2599, lng: 77.4126, neighborhoods: ["MP Nagar", "Arera Colony", "New Market", "Kolar Road", "Shahpura"] },
  { name: "Patna", state: "Bihar", country: "India", lat: 25.5941, lng: 85.1376, neighborhoods: ["Boring Road", "Fraser Road", "Kankarbagh", "Patliputra Colony", "Bailey Road"] },
  { name: "Surat", state: "Gujarat", country: "India", lat: 21.1702, lng: 72.8311, neighborhoods: ["Athwa", "Vesu", "Adajan", "City Light", "Piplod"] },
  { name: "Kochi", state: "Kerala", country: "India", lat: 9.9312, lng: 76.2673, neighborhoods: ["Marine Drive", "Fort Kochi", "Kakkanad", "Edappally", "MG Road"] },
  { name: "Coimbatore", state: "Tamil Nadu", country: "India", lat: 11.0168, lng: 76.9558, neighborhoods: ["RS Puram", "Gandhipuram", "Race Course", "Peelamedu", "Saibaba Colony"] },
  { name: "Visakhapatnam", state: "Andhra Pradesh", country: "India", lat: 17.6868, lng: 83.2185, neighborhoods: ["MVP Colony", "Dwaraka Nagar", "Beach Road", "Gajuwaka", "Siripuram"] },
  { name: "Guwahati", state: "Assam", country: "India", lat: 26.1445, lng: 91.7362, neighborhoods: ["Fancy Bazar", "Zoo Road", "Ganeshguri", "Six Mile", "Uzan Bazar"] },
  { name: "Bhubaneswar", state: "Odisha", country: "India", lat: 20.2961, lng: 85.8245, neighborhoods: ["Saheed Nagar", "Patia", "Jaydev Vihar", "Nayapalli", "Chandrasekharpur"] },
  { name: "Thiruvananthapuram", state: "Kerala", country: "India", lat: 8.5241, lng: 76.9366, neighborhoods: ["Kowdiar", "Pattom", "Vazhuthacaud", "Sasthamangalam", "Kazhakkoottam"] },
  { name: "Amritsar", state: "Punjab", country: "India", lat: 31.6340, lng: 74.8723, neighborhoods: ["Lawrence Road", "Ranjit Avenue", "Hall Bazar", "Mall Road", "Green Avenue"] },
  { name: "Dehradun", state: "Uttarakhand", country: "India", lat: 30.3165, lng: 78.0322, neighborhoods: ["Rajpur Road", "Clock Tower", "Ballupur", "Prem Nagar", "Sahastradhara Road"] },
  { name: "Ranchi", state: "Jharkhand", country: "India", lat: 23.3441, lng: 85.3096, neighborhoods: ["Main Road", "Lalpur", "Harmu", "Kanke Road", "Circular Road"] },
  { name: "Raipur", state: "Chhattisgarh", country: "India", lat: 21.2514, lng: 81.6296, neighborhoods: ["Shankar Nagar", "Civil Lines", "Pandri", "Telibandha", "Devendra Nagar"] },
  { name: "Panaji", state: "Goa", country: "India", lat: 15.4909, lng: 73.8278, neighborhoods: ["Miramar", "Dona Paula", "Altinho", "Campal", "Fontainhas"] },
  { name: "Mysuru", state: "Karnataka", country: "India", lat: 12.2958, lng: 76.6394, neighborhoods: ["Vijayanagar", "Saraswathipuram", "Gokulam", "Jayalakshmipuram", "Kuvempunagar"] },
  { name: "Vadodara", state: "Gujarat", country: "India", lat: 22.3072, lng: 73.1812, neighborhoods: ["Alkapuri", "Fatehgunj", "Sayajigunj", "Manjalpur", "Gotri"] },
  { name: "Nashik", state: "Maharashtra", country: "India", lat: 19.9975, lng: 73.7898, neighborhoods: ["College Road", "Gangapur Road", "Panchavati", "Indira Nagar", "Nashik Road"] },
  { name: "New York", state: "New York", country: "United States", lat: 40.7128, lng: -74.0060, neighborhoods: ["Manhattan", "Brooklyn", "SoHo", "Chelsea", "Williamsburg"] },
  { name: "London", state: "England", country: "United Kingdom", lat: 51.5074, lng: -0.1278, neighborhoods: ["Soho", "Camden", "Shoreditch", "Notting Hill", "Covent Garden"] },
  { name: "Dubai", state: "Dubai", country: "United Arab Emirates", lat: 25.2048, lng: 55.2708, neighborhoods: ["Downtown Dubai", "Jumeirah", "Business Bay", "Al Barsha", "Dubai Marina"] },
  { name: "Singapore", state: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, neighborhoods: ["Orchard", "Clarke Quay", "Marina Bay", "Bugis", "Tanjong Pagar"] },
  { name: "Sydney", state: "New South Wales", country: "Australia", lat: -33.8688, lng: 151.2093, neighborhoods: ["Bondi", "Surry Hills", "Darling Harbour", "Newtown", "The Rocks"] },
  { name: "Toronto", state: "Ontario", country: "Canada", lat: 43.6532, lng: -79.3832, neighborhoods: ["Downtown", "Yorkville", "Kensington Market", "Liberty Village", "The Annex"] },
  { name: "Tokyo", state: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, neighborhoods: ["Shibuya", "Shinjuku", "Ginza", "Roppongi", "Asakusa"] },
]

/** 4 distinct cities per owner, cycled deterministically by owner index — a consecutive 4-window (wrapping) over the 37-city pool, offset by index*4. India-heavy since only 7/37 slots are international. */
function citiesForOwner(ownerIndex: number): CityInfo[] {
  const offset = (ownerIndex * 4) % CITY_POOL.length
  return [0, 1, 2, 3].map((k) => CITY_POOL[(offset + k) % CITY_POOL.length])
}

// ---------------------------------------------------------------------------
// Naming — flavor word + type-appropriate suffix, no city baked in.
// ---------------------------------------------------------------------------

const FLAVOR_WORDS = [
  "Blue Note", "Sunset", "Silver Screen", "Rhythm House", "The Attic", "Marina Bay", "Old Town", "Crescent",
  "Skyline", "Velvet Room", "Riverside", "Moonlight", "Amber", "Cascade", "Horizon", "Lantern", "Meridian",
  "Copper", "Ivory", "Solstice", "Beacon", "Grand", "Emerald", "Paradise", "Zenith", "Timber", "Harbor",
  "Aurora", "Nightingale", "Cobalt", "Orchid", "Sapphire", "Willow",
]

// Partitioned from the spec's exact 9 suffixes by capacity/seating-mode
// realism — a general-admission open floor reads as "Lounge"/"Community
// Center"/"Hall", not "Amphitheatre"; a large numbered venue reads the
// other way. No suffixes invented beyond the spec's list.
const SUFFIX_GA = ["Lounge", "Community Center", "Hall"]
const SUFFIX_NUMBERED_SMALL = ["Theatre", "Arena"] // capacity < 400
const SUFFIX_NUMBERED_LARGE = ["Auditorium", "Amphitheatre", "Convention Centre", "Grounds"] // capacity >= 400

function venueName(seed: string, seatingMode: VenueSeatingMode, capacity: number): string {
  const flavor = FLAVOR_WORDS[pickIndex(`${seed}:flavor`, FLAVOR_WORDS.length)]
  const suffixPool =
    seatingMode === "GENERAL_ADMISSION" ? SUFFIX_GA : capacity >= 400 ? SUFFIX_NUMBERED_LARGE : SUFFIX_NUMBERED_SMALL
  const suffix = suffixPool[pickIndex(`${seed}:suffix`, suffixPool.length)]
  const useThe = pickIndex(`${seed}:the`, 2) === 0
  return useThe ? `The ${flavor} ${suffix}` : `${flavor} ${suffix}`
}

function venueAddress(seed: string, city: CityInfo): string {
  const neighborhood = city.neighborhoods[pickIndex(`${seed}:hood`, city.neighborhoods.length)]
  const buildingNumber = 1 + pickIndex(`${seed}:num`, 899) // 1-899
  return `${buildingNumber}, ${neighborhood}, ${city.name}`
}

// ---------------------------------------------------------------------------
// Seat-map generation — mirrors src/app/dashboard/venue/[id]/seat-map/
// page.tsx's defaultZoneName/rowLetterAt/computeGridSeats. Not directly
// imported: those are module-private (unexported) helpers inside a
// large 'use client' page component, not a shared lib, so importing them
// here would mean either modifying app UI code for a seed script or
// pulling in a 2000-line React component into a Node script. Reimplemented
// faithfully instead — rowLetterAt and the zone-name cycle are copied
// verbatim; computeGridSeats is simplified (drops vertical-aisle/row-
// alignment UI features not needed for seed realism) but produces the same
// shape: continuous row lettering across zones, defaultZoneName() labels,
// arithmetic x/y grid.
// ---------------------------------------------------------------------------

function rowLetterAt(index: number): string {
  let i = index + 1
  let s = ""
  while (i > 0) {
    const rem = (i - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    i = Math.floor((i - 1) / 26)
  }
  return s
}

const ZONE_NAME_CYCLE = ["Front", "Middle", "Back", "Recliner"]
function defaultZoneName(zeroBasedIndex: number): string {
  return ZONE_NAME_CYCLE[zeroBasedIndex] ?? `Section ${zeroBasedIndex + 1}`
}

type SeatPlan = { tierLabel: string; row: string; number: string; x: number; y: number }

const SEAT_SPACING_X = 26
const SEAT_SPACING_Y = 30
const ORIGIN_X = 40
const ORIGIN_Y = 90 // below STAGE_CLEARANCE_Y (70px in the real builder)

/** Rows split across 2-3 zones (defaultZoneName cycle), continuous row lettering — same shape the real Guided Setup grid generator produces. */
function planZoneRows(capacity: number): { columns: number; rowsPerZone: number[] } {
  const columns = capacity >= 400 ? 24 : capacity >= 150 ? 16 : 10
  const totalRows = Math.max(1, Math.ceil(capacity / columns))
  const numZones = totalRows >= 15 ? 3 : totalRows >= 6 ? 2 : 1
  const base = Math.floor(totalRows / numZones)
  const extra = totalRows % numZones
  const rowsPerZone = Array.from({ length: numZones }, (_, z) => base + (z < extra ? 1 : 0))
  return { columns, rowsPerZone }
}

/** Guided (grid) seat generation — clean arithmetic grid, mirrors computeGridSeats. */
function generateGridSeats(capacity: number): SeatPlan[] {
  const { columns, rowsPerZone } = planZoneRows(capacity)
  const seats: SeatPlan[] = []
  let globalRow = 0
  rowsPerZone.forEach((rows, zoneIdx) => {
    const zoneName = defaultZoneName(zoneIdx)
    for (let r = 0; r < rows; r++) {
      const rowLetter = rowLetterAt(globalRow)
      const y = ORIGIN_Y + globalRow * SEAT_SPACING_Y
      for (let c = 1; c <= columns; c++) {
        const x = ORIGIN_X + (c - 1) * SEAT_SPACING_X
        seats.push({ tierLabel: zoneName, row: rowLetter, number: String(c), x, y })
      }
      globalRow++
    }
  })
  return seats
}

/**
 * Manual Canvas (organic) seat generation — same zone/row/number labeling
 * as the grid path (real Manual Canvas placement auto-increments row/
 * number independent of click position too, per placeSeat() in the real
 * builder), but x/y gets deterministic jitter instead of a clean grid, so
 * the layout reads as irregular/hand-placed rather than a perfect grid.
 */
function generateCanvasSeats(capacity: number, venueId: string): SeatPlan[] {
  const { columns, rowsPerZone } = planZoneRows(capacity)
  const seats: SeatPlan[] = []
  let globalRow = 0
  rowsPerZone.forEach((rows, zoneIdx) => {
    const zoneName = defaultZoneName(zoneIdx)
    for (let r = 0; r < rows; r++) {
      const rowLetter = rowLetterAt(globalRow)
      const baseY = ORIGIN_Y + globalRow * SEAT_SPACING_Y
      for (let c = 1; c <= columns; c++) {
        const seatSeed = `${venueId}:${globalRow}:${c}`
        const jitterX = (pickIndex(`${seatSeed}:jx`, 17) - 8) // -8..+8 px
        const jitterY = (pickIndex(`${seatSeed}:jy`, 13) - 6) // -6..+6 px
        const x = ORIGIN_X + (c - 1) * SEAT_SPACING_X + jitterX
        const y = baseY + jitterY
        seats.push({ tierLabel: zoneName, row: rowLetter, number: String(c), x, y })
      }
      globalRow++
    }
  })
  return seats
}

// ---------------------------------------------------------------------------
// Per-owner 10-slot city/type template. Fixed order so truncation (for
// owners that already have 1 pre-existing venue) deterministically drops
// from the end (city4's Canvas slot) rather than picking arbitrarily.
// ---------------------------------------------------------------------------

type SlotType = "GA" | "GUIDED" | "CANVAS"
type Slot = { cityIdx: 0 | 1 | 2 | 3; type: SlotType }

const SLOT_TEMPLATE: Slot[] = [
  { cityIdx: 0, type: "GA" },
  { cityIdx: 0, type: "GUIDED" },
  { cityIdx: 0, type: "CANVAS" },
  { cityIdx: 1, type: "GA" },
  { cityIdx: 1, type: "GUIDED" },
  { cityIdx: 1, type: "CANVAS" },
  { cityIdx: 2, type: "GA" },
  { cityIdx: 2, type: "GUIDED" },
  { cityIdx: 3, type: "GA" },
  { cityIdx: 3, type: "CANVAS" },
]

function rateTypeForExtraSlot(ownerIndex: number): RateType {
  const r = ownerIndex % 3
  return r === 0 ? "HOURLY" : r === 1 ? "DAILY" : "FLEXIBLE"
}

/** Rate-type plan for `count` new venues, given how many of each type this owner already has (across ALL its current venues, pre-existing + previously seeded). */
function planRateTypes(count: number, existing: { hourly: number; daily: number; flexible: number }, ownerIndex: number): RateType[] {
  const hourlyDeficit = Math.max(0, 3 - existing.hourly)
  const dailyDeficit = Math.max(0, 3 - existing.daily)
  const flexDeficit = Math.max(0, 3 - existing.flexible)
  const plan: RateType[] = []
  for (let i = 0; i < hourlyDeficit && plan.length < count; i++) plan.push("HOURLY")
  for (let i = 0; i < dailyDeficit && plan.length < count; i++) plan.push("DAILY")
  for (let i = 0; i < flexDeficit && plan.length < count; i++) plan.push("FLEXIBLE")
  while (plan.length < count) plan.push(rateTypeForExtraSlot(ownerIndex))
  return plan
}

function rateFieldsFor(rateType: RateType, capacity: number): { hourlyRate: number | null; dailyRate: number | null; minDurationHours: number | null } {
  if (rateType === "HOURLY") return { hourlyRate: 500 + capacity * 2, dailyRate: null, minDurationHours: 2 }
  if (rateType === "DAILY") return { hourlyRate: null, dailyRate: 5000 + capacity * 10, minDurationHours: null }
  return { hourlyRate: null, dailyRate: null, minDurationHours: null } // FLEXIBLE — negotiated per-booking, no venue-level rate
}

// ---------------------------------------------------------------------------
// Data access
// ---------------------------------------------------------------------------

type OwnerRow = { id: string; userId: string }
type ExistingVenueAgg = { count: number; hourly: number; daily: number; flexible: number; ids: Set<string> }

async function fetchMissingVenueOwnerUsers(prisma: PrismaClient) {
  return prisma.user.findMany({
    where: { role: Role.VENUE_OWNER, venueOwner: null },
    select: { id: true },
  })
}

async function fetchAllVenueOwners(prisma: PrismaClient): Promise<OwnerRow[]> {
  return prisma.venueOwner.findMany({ select: { id: true, userId: true }, orderBy: { id: "asc" } })
}

async function fetchExistingVenueAggByOwner(prisma: PrismaClient): Promise<Map<string, ExistingVenueAgg>> {
  const venues = await prisma.venue.findMany({ select: { id: true, ownerId: true, rateType: true } })
  const map = new Map<string, ExistingVenueAgg>()
  for (const v of venues) {
    const agg = map.get(v.ownerId) ?? { count: 0, hourly: 0, daily: 0, flexible: 0, ids: new Set<string>() }
    agg.count++
    agg.ids.add(v.id)
    if (v.rateType === "HOURLY") agg.hourly++
    else if (v.rateType === "DAILY") agg.daily++
    else if (v.rateType === "FLEXIBLE") agg.flexible++
    map.set(v.ownerId, agg)
  }
  return map
}

// ---------------------------------------------------------------------------
// Planning — pure, given current DB state. Returns exactly what step 2
// would create, without writing anything, so preview and execute share
// one code path.
// ---------------------------------------------------------------------------

type VenuePlan = {
  id: string
  ownerId: string
  ownerIndex: number
  city: CityInfo
  seatingMode: VenueSeatingMode
  generationMethod: "GA" | "GUIDED" | "CANVAS"
  rateType: RateType
  capacity: number
}

/** Deterministic, fixed per-owner-per-template-slot id — decoupled from
 * existing-venue count so resuming a crashed partial run can tell exactly
 * which of the 10 template slots already exist (by id) rather than
 * inferring position from a count, which breaks the moment "count" mixes
 * this script's own rows with an unrelated pre-existing venue (the 12
 * base-seed owners each already have 1 venue in a city outside our pool -
 * that venue doesn't correspond to any template slot, so slice(0,needed)
 * on a resume would silently regenerate slot 0..N again under new ids
 * instead of continuing from wherever the crash left off). */
function slotVenueId(ownerId: string, templateIndex: number): string {
  return `${ownerId}-venue-t${templateIndex}`
}

function planVenuesForOwner(owner: OwnerRow, ownerIndex: number, existing: ExistingVenueAgg): VenuePlan[] {
  const ownSlotsPresent = SLOT_TEMPLATE.filter((_, i) => existing.ids.has(slotVenueId(owner.id, i))).length
  const foreignCount = existing.count - ownSlotsPresent // pre-existing venues not created by this script (e.g. base-seed's 1-per-owner)
  const targetSlotCount = Math.max(0, Math.min(SLOT_TEMPLATE.length, 10 - foreignCount))
  const targetSlots = SLOT_TEMPLATE.slice(0, targetSlotCount) // deterministic truncation from the end when a foreign venue already occupies one of the 10

  const toCreate = targetSlots
    .map((slot, i) => ({ slot, templateIndex: i }))
    .filter(({ templateIndex }) => !existing.ids.has(slotVenueId(owner.id, templateIndex)))
  if (toCreate.length === 0) return []

  const cities = citiesForOwner(ownerIndex)
  const rateTypes = planRateTypes(toCreate.length, existing, ownerIndex)

  return toCreate.map(({ slot, templateIndex }, i) => {
    const city = cities[slot.cityIdx]
    const seatingMode: VenueSeatingMode = slot.type === "GA" ? "GENERAL_ADMISSION" : "NUMBERED"
    const id = slotVenueId(owner.id, templateIndex)
    // Capacity seeded off the fixed template slot (not `i` in toCreate),
    // so it stays the same value across a resume regardless of how many
    // slots were already skipped.
    const capacity = 100 + pickIndex(`${owner.id}:cap:${templateIndex}`, 901) // 100-1000
    return {
      id,
      ownerId: owner.id,
      ownerIndex,
      city,
      seatingMode,
      generationMethod: slot.type,
      rateType: rateTypes[i],
      capacity,
    }
  })
}

async function buildFullPlan(prisma: PrismaClient): Promise<{ missingOwnerUsers: { id: string }[]; venuePlans: VenuePlan[]; ownerCount: number }> {
  const missingOwnerUsers = await fetchMissingVenueOwnerUsers(prisma)

  // Plan step 1's new VenueOwner rows too (deterministic id), so step 2's
  // planning can include them without a real DB round-trip in preview mode.
  const plannedNewOwners: OwnerRow[] = missingOwnerUsers.map((u) => ({ id: `${u.id}-profile`, userId: u.id }))
  const existingOwners = await fetchAllVenueOwners(prisma)
  const allOwners = [...existingOwners, ...plannedNewOwners].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const existingVenueAgg = await fetchExistingVenueAggByOwner(prisma)
  const emptyAgg: ExistingVenueAgg = { count: 0, hourly: 0, daily: 0, flexible: 0, ids: new Set<string>() }

  const venuePlans: VenuePlan[] = []
  allOwners.forEach((owner, ownerIndex) => {
    const existing = existingVenueAgg.get(owner.id) ?? emptyAgg
    venuePlans.push(...planVenuesForOwner(owner, ownerIndex, existing))
  })

  return { missingOwnerUsers, venuePlans, ownerCount: allOwners.length }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printReport(missingOwnerUsers: { id: string }[], venuePlans: VenuePlan[], ownerCount: number) {
  console.log(`\n[seed-venues] Step 1 — VenueOwner backfill: ${missingOwnerUsers.length} rows to create.`)
  console.log(`[seed-venues] Step 2 — Venue owners after step 1: ${ownerCount}. New Venues to create: ${venuePlans.length}.`)

  const numbered = venuePlans.filter((p) => p.seatingMode === "NUMBERED")
  const ga = venuePlans.filter((p) => p.seatingMode === "GENERAL_ADMISSION")
  const byRate = { HOURLY: 0, DAILY: 0, FLEXIBLE: 0 }
  for (const p of venuePlans) byRate[p.rateType]++
  const estSeatRows = numbered.reduce((sum, p) => sum + (p.generationMethod === "GUIDED" ? generateGridSeats(p.capacity).length : generateCanvasSeats(p.capacity, p.id).length), 0)

  console.log(`[seed-venues]   GA: ${ga.length}, NUMBERED: ${numbered.length} (Guided: ${numbered.filter((p) => p.generationMethod === "GUIDED").length}, Canvas: ${numbered.filter((p) => p.generationMethod === "CANVAS").length})`)
  console.log(`[seed-venues]   Rate types — HOURLY: ${byRate.HOURLY}, DAILY: ${byRate.DAILY}, FLEXIBLE: ${byRate.FLEXIBLE}`)
  console.log(`[seed-venues]   Estimated Seat rows to create: ~${estSeatRows.toLocaleString()}`)

  console.log(`\n[seed-venues] Sample (15 venues across owners/cities/types):`)
  const sampleIdxs = [0, 1, 2, 3, 8, 9, 10, 20, 100, 150, 300, 500, 700, venuePlans.length - 2, venuePlans.length - 1].filter((i) => i >= 0 && i < venuePlans.length)
  for (const i of [...new Set(sampleIdxs)]) {
    const p = venuePlans[i]
    const name = venueName(p.id, p.seatingMode, p.capacity)
    const address = venueAddress(p.id, p.city)
    const rates = rateFieldsFor(p.rateType, p.capacity)
    console.log(
      `  [${p.ownerId}] "${name}" | ${address} (${p.city.state}, ${p.city.country}) | cap=${p.capacity} | ${p.seatingMode}${p.seatingMode === "NUMBERED" ? `/${p.generationMethod}` : ""} | ${p.rateType}` +
        (rates.hourlyRate !== null ? ` hourlyRate=${rates.hourlyRate}` : "") +
        (rates.dailyRate !== null ? ` dailyRate=${rates.dailyRate}` : "")
    )
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function executeStep1(prisma: PrismaClient, missingOwnerUsers: { id: string }[]): Promise<number> {
  if (missingOwnerUsers.length === 0) return 0
  const data = missingOwnerUsers.map((u) => ({ id: `${u.id}-profile`, userId: u.id, isApproved: true }))
  let created = 0
  for (const batch of chunk(data, 500)) {
    const res = await prisma.venueOwner.createMany({ data: batch, skipDuplicates: true })
    created += res.count
  }
  return created
}

async function executeStep2(prisma: PrismaClient, venuePlans: VenuePlan[]): Promise<{ venuesCreated: number; seatsCreated: number }> {
  let venuesCreated = 0
  let seatsCreated = 0

  for (const batch of chunk(venuePlans, 300)) {
    const data = batch.map((p) => ({
      id: p.id,
      ownerId: p.ownerId,
      name: venueName(p.id, p.seatingMode, p.capacity),
      address: venueAddress(p.id, p.city),
      city: p.city.name,
      state: p.city.state,
      country: p.city.country,
      lat: p.city.lat,
      lng: p.city.lng,
      placeId: null,
      capacity: p.capacity,
      photos: [`https://picsum.photos/seed/${p.id}/1200/800`],
      facilities: [] as string[],
      seatingMode: p.seatingMode,
      isApproved: true,
      ...rateFieldsFor(p.rateType, p.capacity),
      rateType: p.rateType,
    }))
    const res = await prisma.venue.createMany({ data, skipDuplicates: true })
    venuesCreated += res.count
  }

  const numberedPlans = venuePlans.filter((p) => p.seatingMode === "NUMBERED")
  for (const p of numberedPlans) {
    const seats = p.generationMethod === "GUIDED" ? generateGridSeats(p.capacity) : generateCanvasSeats(p.capacity, p.id)
    for (const seatBatch of chunk(seats, 3000)) {
      const res = await prisma.seat.createMany({
        data: seatBatch.map((s) => ({ venueId: p.id, tierLabel: s.tierLabel, row: s.row, number: s.number, x: s.x, y: s.y })),
        skipDuplicates: true,
      })
      seatsCreated += res.count
    }
  }

  return { venuesCreated, seatsCreated }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const databaseUrl = assertQaDatabase()

  if (process.argv.includes("--check-only")) {
    console.log(`[seed-venues] Guard check passed: DATABASE_URL references the QA Supabase project (${QA_PROJECT_REF}).`)
    console.log("[seed-venues] --check-only: exiting before any database connection is made. No writes.")
    return
  }

  const execute = process.argv.includes("--execute")

  const connectionString = databaseUrl.includes("uselibpqcompat=")
    ? databaseUrl
    : `${databaseUrl}${databaseUrl.includes("?") ? "&" : "?"}uselibpqcompat=true`

  // max:1, not the sibling scripts' max:5 — every write loop below is a
  // sequential for-of with await (no Promise.all/mapWithConcurrency), so
  // this script never actually needs more than one live connection at a
  // time. Matches src/lib/prisma.ts's own max:1, set there after a real,
  // previously-live EMAXCONNSESSION incident (Supabase's Session Pooler
  // hard-caps at 15 total concurrent clients across everything hitting
  // this project — the app, this script, and any concurrent admin
  // queries share that same ceiling). Capping at 1 here removes any
  // question of this ~376K-row run contributing more than a single
  // connection's worth of pressure to that shared limit.
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 1, idleTimeoutMillis: 10_000 })
  const adapter = new PrismaPg(pool, { disposeExternalPool: false })
  const prisma = new PrismaClient({ adapter })

  try {
    const { missingOwnerUsers, venuePlans, ownerCount } = await buildFullPlan(prisma)
    printReport(missingOwnerUsers, venuePlans, ownerCount)

    if (!execute) {
      console.log("\n[seed-venues] Preview only — nothing was written. Re-run with --execute to create for real.")
      return
    }

    console.log(`\n[seed-venues] --execute passed. Running step 1 (VenueOwner backfill)...`)
    const ownersCreated = await executeStep1(prisma, missingOwnerUsers)
    console.log(`[seed-venues] Step 1 done: ${ownersCreated} VenueOwner rows created.`)

    console.log(`[seed-venues] Running step 2 (Venue + Seat creation, ${venuePlans.length} venues planned)...`)
    const { venuesCreated, seatsCreated } = await executeStep2(prisma, venuePlans)
    console.log(`[seed-venues] Step 2 done: ${venuesCreated} Venues created, ${seatsCreated} Seat rows created.`)

    const finalOwnerCount = await prisma.venueOwner.count()
    const finalVenueCount = await prisma.venue.count()
    const finalSeatCount = await prisma.seat.count()
    console.log(`\n[seed-venues] Post-run independent counts: VenueOwner=${finalOwnerCount}, Venue=${finalVenueCount}, Seat=${finalSeatCount}`)
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

main().catch((err) => {
  console.error("[seed-venues] Failed:", err)
  process.exit(1)
})
