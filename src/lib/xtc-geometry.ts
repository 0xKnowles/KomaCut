/**
 * Split geometry and the page-start map: what a reader needs to put a source
 * page back together from the strips this file stores.
 *
 * Both live in the container header qword at 0x28, which upstream xtcjs wrote
 * as a zeroed "reserved" field. KomaOS reads it as packed geometry
 * (`XtcSplitGeometry` / `decodeSplitGeometry` in lib/Xtc/Xtc/XtcTypes.h), and
 * FlipNzb writes it (`encodeSplitGeometry` in server/src/core/convert/xtc.ts).
 * The bit layout here is byte-compatible with both.
 *
 *   bits  0-7   mode (index into SPLIT_GEOMETRY_MODES; 0 = not recorded)
 *   bits  8-15  stripsPerPage
 *   bits 16-31  overlapPerMille
 *   bits 32-33  rotationQuarterTurns
 *   bit  34     page-start map present     <- KomaCut extension
 *   bits 35-39  unused
 *   bits 40-47  leadingStrips
 *   bits 48-63  unused
 *
 * A reader that ignores the qword is unaffected: it sees the zeroes every file
 * written before this did.
 */

/**
 * Split modes indexed by SplitGeometry.mode, so the index IS the stored value.
 *
 * Slot 0 is 'unknown' rather than a real mode: zero is what a legacy file's
 * reserved qword reads as, and it has to stay distinguishable from a genuine
 * layout. Append only — these values go into files.
 */
export const SPLIT_GEOMETRY_MODES = ['unknown', 'nosplit', 'overlap', 'split', 'fourway'] as const

export type SplitGeometryMode = 0 | 1 | 2 | 3 | 4

export interface SplitGeometry {
  /** Index into SPLIT_GEOMETRY_MODES. Never 0 for a file that records geometry. */
  mode: SplitGeometryMode
  /** Strips per source page. 1 for nosplit. */
  stripsPerPage: number
  /**
   * Overlap between consecutive strips, in per-mille of one strip.
   *
   * Per-mille rather than percent because the value is a ratio of two pixel
   * counts and lands anywhere in 250-330 on ordinary manga aspects; rounding to
   * a whole percent moves a seam by a couple of pixels.
   */
  overlapPerMille: number
  /** Quarter turns clockwise applied to each strip when it was stored. */
  rotationQuarterTurns: 0 | 1 | 2 | 3
  /**
   * Strips emitted before the split run starts.
   *
   * The cover is forced to nosplit, so it contributes a single strip and every
   * page group after it is offset by one. Without this a reader grouping strips
   * three at a time splices the cover onto the next page's first two strips.
   */
  leadingStrips: number
  /**
   * A page-start map follows the page table.
   *
   * Set when {@link buildPageStartMap} output is appended, which is the only
   * thing that makes the map findable — see that function for why the position
   * is implied rather than stored.
   */
  hasPageStartMap?: boolean
}

const MODE_MASK = 0xffn
const STRIPS_MASK = 0xffn
const OVERLAP_MASK = 0xffffn
const ROTATION_MASK = 0x03n
const LEADING_MASK = 0xffn

/** Bit 34: unread by KomaOS's decodeSplitGeometry and written 0 by FlipNzb. */
const PAGE_START_MAP_BIT = 34n

/**
 * Clamps an overlap to what the 16-bit field can carry.
 *
 * The segment formula can produce a *negative* overlap: past roughly 6:1 the
 * strip count hits its cap of 10 and the shift outgrows the strip, so the
 * strips leave gaps instead of overlapping. Masking that into a uint16 is what
 * upstream would do, and it turns -46 into 65490, which KomaOS renders as a
 * 6549% overlap. Zero is the honest answer: these strips do not overlap.
 */
function clampOverlap(perMille: number): number {
  if (!Number.isFinite(perMille) || perMille < 0) return 0
  if (perMille > 1000) return 1000
  return Math.round(perMille)
}

/** Packs split geometry into the container's qword at 0x28. */
export function encodeSplitGeometry(geometry: SplitGeometry | undefined): bigint {
  if (!geometry) return 0n

  // Byte 0 carries a nonzero mode for every real layout, which is what marks
  // the field as present — a legacy file's zeroes decode to "unknown".
  let packed =
    (BigInt(geometry.mode) & MODE_MASK) |
    ((BigInt(geometry.stripsPerPage) & STRIPS_MASK) << 8n) |
    ((BigInt(clampOverlap(geometry.overlapPerMille)) & OVERLAP_MASK) << 16n) |
    ((BigInt(geometry.rotationQuarterTurns) & ROTATION_MASK) << 32n) |
    ((BigInt(geometry.leadingStrips) & LEADING_MASK) << 40n)

  if (geometry.hasPageStartMap) packed |= 1n << PAGE_START_MAP_BIT

  return packed
}

/** Reads back what {@link encodeSplitGeometry} wrote; undefined when absent. */
export function decodeSplitGeometry(packed: bigint): SplitGeometry | undefined {
  const mode = Number(packed & MODE_MASK)
  if (mode === 0) return undefined

  return {
    mode: mode as SplitGeometryMode,
    stripsPerPage: Number((packed >> 8n) & STRIPS_MASK),
    overlapPerMille: Number((packed >> 16n) & OVERLAP_MASK),
    rotationQuarterTurns: Number((packed >> 32n) & ROTATION_MASK) as SplitGeometry['rotationQuarterTurns'],
    leadingStrips: Number((packed >> 40n) & LEADING_MASK),
    hasPageStartMap: ((packed >> PAGE_START_MAP_BIT) & 1n) === 1n,
  }
}

/** A strip's placement on the source page, as the converter cut it. */
export interface GeometryRegion {
  y: number
  h: number
}

/**
 * Records what a page's regions imply, for the reader to reassemble them.
 *
 * The overlap is measured off the regions themselves rather than recomputed:
 * the segment formula floors its shift, so deriving it a second time from the
 * page dimensions can land a pixel out, and a pixel is a visible seam.
 */
export function geometryFor(
  regions: GeometryRegion[],
  mode: SplitGeometryMode,
  leadingStrips: number,
  rotationQuarterTurns: SplitGeometry['rotationQuarterTurns'],
): SplitGeometry | undefined {
  // A single-region page has no shift to measure, so the answer is no geometry
  // rather than a zeroed one.
  const first = regions[0]
  const second = regions[1]
  if (!first || !second) return undefined

  const stripHeight = first.h
  if (stripHeight <= 0) return undefined
  const shift = second.y - first.y

  return {
    mode,
    stripsPerPage: regions.length,
    overlapPerMille: clampOverlap(((stripHeight - shift) * 1000) / stripHeight),
    rotationQuarterTurns,
    leadingStrips,
  }
}

/**
 * Converts a canvas rotation in degrees to quarter turns clockwise.
 *
 * The converter rotates by +90 or -90 depending on `landscapeFlipClockwise`,
 * and the stored pixels carry no clue which way it went. A reader that assumes
 * one direction renders half the library upside down, so the actual value is
 * recorded rather than hardcoded the way FlipNzb can afford to (it only ever
 * rotates one way).
 *
 * Canvas `ctx.rotate` takes positive angles clockwise, since its y-axis points
 * down — so +90 is one quarter turn clockwise and -90 is three.
 */
export function rotationToQuarterTurns(degrees: number): SplitGeometry['rotationQuarterTurns'] {
  const turns = Math.round(degrees / 90) % 4
  return ((turns + 4) % 4) as SplitGeometry['rotationQuarterTurns']
}

/**
 * Builds the page-start map: one bit per output strip, set where a source page
 * begins.
 *
 * Needed because strips-per-page is not constant across a volume. A mid-book
 * double-page spread is landscape, so it is never split and emits a single
 * strip; from that point on a reader grouping strips three at a time is out of
 * phase with the real page boundaries for the rest of the book.
 * `leadingStrips` cannot express this — it describes only the front matter.
 *
 * The map is stored immediately after the page table, at
 * `pageTableOffset + pageCount * 16`, and is `ceil(pageCount / 8)` bytes. That
 * position is derived rather than stored because there is no free qword left to
 * store it in: 0x28 is this geometry field and 0x30 holds the TOC offset, which
 * FlipNzb writes as one 8-byte qword spanning 0x30-0x37 while KomaOS reads the
 * same span as two uint32s. They agree only because the high half is always
 * zero, so 0x34 is not spare padding.
 *
 * Bit i of byte i>>3, MSB first, matches the packing used everywhere else in
 * this format.
 */
export function buildPageStartMap(stripsPerSourcePage: number[]): Uint8Array {
  const totalStrips = stripsPerSourcePage.reduce((sum, n) => sum + n, 0)
  const map = new Uint8Array(Math.ceil(totalStrips / 8))

  let strip = 0
  for (const strips of stripsPerSourcePage) {
    map[strip >> 3] |= 0x80 >> (strip & 7)
    strip += strips
  }

  return map
}

/** Reads back what {@link buildPageStartMap} wrote, as strip indices. */
export function readPageStartMap(map: Uint8Array, totalStrips: number): number[] {
  const starts: number[] = []
  for (let strip = 0; strip < totalStrips; strip++) {
    if ((map[strip >> 3] >> (7 - (strip & 7))) & 1) starts.push(strip)
  }
  return starts
}

/** Bytes {@link buildPageStartMap} needs for a given strip count. */
export function pageStartMapBytes(totalStrips: number): number {
  return Math.ceil(totalStrips / 8)
}
