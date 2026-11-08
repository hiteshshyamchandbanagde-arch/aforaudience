// D1 (Hitesh, 8 Nov) - self-tests for "Pay at entry" + attendance in
// src/lib/pay-at-entry.ts. Regression shape: on origin/qa this module does
// not exist (no pay-at-entry mode, every priced booking is blocked by the
// S1a switch), so these fail; on the branch they pass.
//
//   npx tsx scripts/pay-at-entry.test.ts
import assert from 'node:assert/strict'
import { PAID_BOOKINGS_DISABLED } from '../src/lib/paid-bookings'
import {
  PAY_AT_ENTRY_MAX_SEATS,
  bookingPlan,
  canMarkNoShow,
  effectiveAttendance,
  eventEndAt,
  payAtEntrySeatCapError,
  resolveEventPaymentMode,
  shouldAutoNoShow,
} from '../src/lib/pay-at-entry'

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`ok - ${name}`)
}

// --- mode / switch matrix (booking create) ---
test('[D1] ONLINE + switch OFF -> 403 PAID_BOOKINGS_DISABLED', () => {
  const r = bookingPlan('ONLINE', 30000, false)
  assert.equal(r.kind, 'blocked')
  if (r.kind === 'blocked') {
    assert.equal(r.status, 403)
    assert.equal(r.body.code, PAID_BOOKINGS_DISABLED)
  }
})
test('[D1] PAY_AT_ENTRY + switch OFF -> reserve at entry (201 path, not blocked)', () => {
  assert.deepEqual(bookingPlan('PAY_AT_ENTRY', 30000, false), { kind: 'atEntry' })
})
test('[D1] PAY_AT_ENTRY + switch ON -> still at entry (no Razorpay)', () => {
  assert.deepEqual(bookingPlan('PAY_AT_ENTRY', 30000, true), { kind: 'atEntry' })
})
test('[D1] ONLINE + switch ON -> online checkout exactly as today', () => {
  assert.deepEqual(bookingPlan('ONLINE', 30000, true), { kind: 'online' })
})
test('[D1] legacy row with no mode + priced follows S1a (blocked OFF, online ON)', () => {
  assert.equal(bookingPlan(undefined, 100, false).kind, 'blocked')
  assert.equal(bookingPlan(null, 100, true).kind, 'online')
})
test('[D1] zero amount is free in every mode and switch state', () => {
  for (const m of ['FREE', 'PAY_AT_ENTRY', 'ONLINE'] as const) {
    assert.deepEqual(bookingPlan(m, 0, false), { kind: 'free' })
    assert.deepEqual(bookingPlan(m, 0, true), { kind: 'free' })
  }
})

// --- 4-seat cap ---
test('[D1] pay-at-entry cap is 4 seats', () => {
  assert.equal(PAY_AT_ENTRY_MAX_SEATS, 4)
  assert.equal(payAtEntrySeatCapError('PAY_AT_ENTRY', 1), null)
  assert.equal(payAtEntrySeatCapError('PAY_AT_ENTRY', 4), null)
  assert.match(String(payAtEntrySeatCapError('PAY_AT_ENTRY', 5)), /4 seats/)
})
test('[D1] cap does not apply to FREE / ONLINE', () => {
  assert.equal(payAtEntrySeatCapError('FREE', 10), null)
  assert.equal(payAtEntrySeatCapError('ONLINE', 10), null)
})

// --- event create/edit mode resolution ---
test('[D1] priced + PAY_AT_ENTRY allowed while switch OFF', () => {
  assert.deepEqual(resolveEventPaymentMode('PAY_AT_ENTRY', true, false), { ok: true, mode: 'PAY_AT_ENTRY' })
})
test('[D1] priced + ONLINE refused (403) while switch OFF, allowed ON', () => {
  const off = resolveEventPaymentMode('ONLINE', true, false)
  assert.equal(off.ok, false)
  if (!off.ok) assert.equal(off.status, 403)
  assert.deepEqual(resolveEventPaymentMode('ONLINE', true, true), { ok: true, mode: 'ONLINE' })
})
test('[D1] priced + no mode: PAY_AT_ENTRY when OFF, ONLINE when ON (today)', () => {
  assert.deepEqual(resolveEventPaymentMode(undefined, true, false), { ok: true, mode: 'PAY_AT_ENTRY' })
  assert.deepEqual(resolveEventPaymentMode(undefined, true, true), { ok: true, mode: 'ONLINE' })
})
test('[D1] not priced -> FREE; paid mode without a price -> 400; junk -> 400', () => {
  assert.deepEqual(resolveEventPaymentMode(undefined, false, false), { ok: true, mode: 'FREE' })
  assert.deepEqual(resolveEventPaymentMode('FREE', false, true), { ok: true, mode: 'FREE' })
  const r = resolveEventPaymentMode('PAY_AT_ENTRY', false, false)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.status, 400)
  const j = resolveEventPaymentMode('CASH', true, true)
  assert.equal(j.ok, false)
  const f = resolveEventPaymentMode('FREE', true, true)
  assert.equal(f.ok, false)
})

// --- attendance timing ---
const ev = { date: new Date(2026, 10, 20), startTime: '19:00', endTime: '21:00' }
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m, 0, 0)
const reserved = { status: 'CONFIRMED', attendance: 'RESERVED', checkedInAt: null }

test('[D1] event end past midnight rolls to next day', () => {
  const late = { date: new Date(2026, 10, 20), startTime: '22:00', endTime: '01:00' }
  assert.equal(eventEndAt(late).getTime(), at(21, 1).getTime())
})
test('[D1] auto no-show only from 24 h after the end', () => {
  assert.equal(shouldAutoNoShow(reserved, ev, at(21, 20, 59)), false)
  assert.equal(shouldAutoNoShow(reserved, ev, at(21, 21, 0)), true)
})
test('[D1] auto no-show skips checked-in, attended, cancelled', () => {
  const later = at(25, 0)
  assert.equal(shouldAutoNoShow({ ...reserved, checkedInAt: at(20, 19) }, ev, later), false)
  assert.equal(shouldAutoNoShow({ ...reserved, attendance: 'ATTENDED' }, ev, later), false)
  assert.equal(shouldAutoNoShow({ ...reserved, status: 'CANCELLED' }, ev, later), false)
})
test('[D1] effective attendance: checked-in wins, lazy no-show on read', () => {
  assert.equal(effectiveAttendance({ ...reserved, checkedInAt: at(20, 19) }, ev, at(25, 0)), 'ATTENDED')
  assert.equal(effectiveAttendance(reserved, ev, at(25, 0)), 'NO_SHOW')
  assert.equal(effectiveAttendance(reserved, ev, at(20, 20)), 'RESERVED')
})
test('[D1] mark no-show window: event start until 48 h after end', () => {
  assert.equal(canMarkNoShow(ev, at(20, 18, 59)), false)
  assert.equal(canMarkNoShow(ev, at(20, 19, 0)), true)
  assert.equal(canMarkNoShow(ev, at(22, 21, 0)), true)
  assert.equal(canMarkNoShow(ev, at(22, 21, 1)), false)
})

console.log(`\n${passed} passed`)
