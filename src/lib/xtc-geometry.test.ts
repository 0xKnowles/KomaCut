import { describe, expect, test } from 'bun:test'
import {
  buildPageStartMap,
  decodeSplitGeometry,
  encodeSplitGeometry,
  geometryFor,
  pageStartMapBytes,
  readPageStartMap,
  rotationToQuarterTurns,
  SPLIT_GEOMETRY_MODES,
  type SplitGeometry,
} from './xtc-geometry'
import { calculateOverlapSegments } from './processing/image'

const SAMPLE: SplitGeometry = {
  mode: 2,
  stripsPerPage: 3,
  overlapPerMille: 302,
  rotationQuarterTurns: 1,
  leadingStrips: 1,
}

describe('split geometry packing', () => {
  test('round-trips', () => {
    expect(decodeSplitGeometry(encodeSplitGeometry(SAMPLE))).toEqual({
      ...SAMPLE,
      hasPageStartMap: false,
    })
  })

  test('a zero qword is the legacy "not recorded" value', () => {
    expect(decodeSplitGeometry(0n)).toBeUndefined()
    expect(encodeSplitGeometry(undefined)).toBe(0n)
  })

  // The exact bit positions are a wire format shared with KomaOS's
  // decodeSplitGeometry (lib/Xtc/Xtc/XtcTypes.h) and FlipNzb's
  // encodeSplitGeometry, so they are pinned rather than merely round-tripped.
  test('fields land on the bits KomaOS reads', () => {
    const packed = encodeSplitGeometry(SAMPLE)
    expect(packed & 0xffn).toBe(2n) // mode
    expect((packed >> 8n) & 0xffn).toBe(3n) // stripsPerPage
    expect((packed >> 16n) & 0xffffn).toBe(302n) // overlapPerMille
    expect((packed >> 32n) & 0x03n).toBe(1n) // rotationQuarterTurns
    expect((packed >> 40n) & 0xffn).toBe(1n) // leadingStrips
  })

  test('the mode table is append-only and index-addressed', () => {
    // Slot 0 must stay "unknown": it is what a legacy zeroed qword decodes to.
    expect(SPLIT_GEOMETRY_MODES[0]).toBe('unknown')
    expect(SPLIT_GEOMETRY_MODES.indexOf('overlap')).toBe(2)
  })

  test('the page-start map flag uses a bit KomaOS ignores', () => {
    const packed = encodeSplitGeometry({ ...SAMPLE, hasPageStartMap: true })
    expect((packed >> 34n) & 1n).toBe(1n)
    // Every field KomaOS does read must be unchanged by the flag.
    expect(packed & 0xffff_ffffn).toBe(encodeSplitGeometry(SAMPLE) & 0xffff_ffffn)
    expect((packed >> 40n) & 0xffn).toBe(1n)
    expect(decodeSplitGeometry(packed)!.hasPageStartMap).toBe(true)
  })
})

describe('geometryFor', () => {
  test('measures overlap off the segments rather than recomputing it', () => {
    // 1114x1600 is an ordinary tankobon scan: 3 strips of 668 shifted by 466.
    const segments = calculateOverlapSegments(1114, 1600, 'X4')
    const geometry = geometryFor(segments, 2, 0, 1)!

    expect(geometry.stripsPerPage).toBe(3)
    expect(geometry.overlapPerMille).toBe(Math.round(((668 - 466) * 1000) / 668))
    expect(geometry.overlapPerMille).toBe(302)
  })

  test('a single region yields no geometry rather than a zeroed one', () => {
    expect(geometryFor([{ y: 0, h: 800 }], 1, 0, 1)).toBeUndefined()
    expect(geometryFor([], 1, 0, 1)).toBeUndefined()
  })

  test('clamps the negative overlap that extreme aspect ratios produce', () => {
    // Past roughly 6:1 the strip count hits its cap and the shift outgrows the
    // strip, so strips leave gaps. Masking that into a uint16 would turn -277
    // into 65259, which KomaOS reads as a 6526% overlap.
    const segments = calculateOverlapSegments(800, 6000, 'X4')
    const geometry = geometryFor(segments, 2, 0, 1)!

    expect(segments[1].y - segments[0].y).toBeGreaterThan(segments[0].h)
    expect(geometry.overlapPerMille).toBe(0)
    expect((encodeSplitGeometry(geometry) >> 16n) & 0xffffn).toBe(0n)
  })
})

describe('rotationToQuarterTurns', () => {
  // Canvas rotates clockwise for positive angles (its y-axis points down), and
  // the converter picks +90 or -90 from landscapeFlipClockwise. Recording the
  // wrong one renders half a library upside down.
  test('maps canvas degrees to quarter turns clockwise', () => {
    expect(rotationToQuarterTurns(90)).toBe(1)
    expect(rotationToQuarterTurns(-90)).toBe(3)
    expect(rotationToQuarterTurns(0)).toBe(0)
    expect(rotationToQuarterTurns(180)).toBe(2)
  })
})

describe('page-start map', () => {
  test('marks the strip each source page begins at', () => {
    // A cover (1 strip), two ordinary pages (3 each), a mid-book spread (1),
    // then another ordinary page: the case leadingStrips cannot express.
    const strips = [1, 3, 3, 1, 3]
    const map = buildPageStartMap(strips)

    expect(map.length).toBe(pageStartMapBytes(11))
    expect(readPageStartMap(map, 11)).toEqual([0, 1, 4, 7, 8])
  })

  test('a uniform volume still round-trips', () => {
    const strips = Array.from({ length: 60 }, () => 3)
    const map = buildPageStartMap(strips)

    expect(readPageStartMap(map, 180)).toEqual(strips.map((_s, i) => i * 3))
  })

  test('stays small enough to be worth storing', () => {
    // A 200-page volume at 3 strips a page is 600 strips, so 75 bytes.
    expect(pageStartMapBytes(600)).toBe(75)
  })
})
