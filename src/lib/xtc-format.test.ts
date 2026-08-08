import { describe, expect, test } from 'bun:test'
import { buildXtcFromXtgPages } from './xtc-format'
import { decodeSplitGeometry, readPageStartMap, type SplitGeometry } from './xtc-geometry'

const INDEX_ENTRY_SIZE = 16
const PAGE_HEADER_SIZE = 22

/** A minimal XTG page: the 22-byte header carries the dimensions builders read. */
function fakeXtgPage(width = 480, height = 800): ArrayBuffer {
  const rowBytes = Math.ceil(width / 8)
  const buffer = new ArrayBuffer(PAGE_HEADER_SIZE + rowBytes * height)
  const view = new DataView(buffer)
  const bytes = new Uint8Array(buffer)

  bytes[0] = 0x58 // X
  bytes[1] = 0x54 // T
  bytes[2] = 0x47 // G
  view.setUint16(4, width, true)
  view.setUint16(6, height, true)
  view.setUint32(10, rowBytes * height, true)
  return buffer
}

const GEOMETRY: SplitGeometry = {
  mode: 2,
  stripsPerPage: 3,
  overlapPerMille: 302,
  rotationQuarterTurns: 1,
  leadingStrips: 1,
}

describe('buildXtcFromXtgPages header', () => {
  test('writes split geometry at 0x28 where upstream wrote a zero', async () => {
    const pages = [fakeXtgPage(), fakeXtgPage(), fakeXtgPage()]
    const file = await buildXtcFromXtgPages(pages, { splitGeometry: GEOMETRY })
    const view = new DataView(file)

    // Read the qword the same way KomaOS does: little-endian, 0x28.
    const packed = view.getBigUint64(40, true)
    expect(packed).not.toBe(0n)
    expect(decodeSplitGeometry(packed)).toMatchObject(GEOMETRY)
  })

  test('leaves 0x28 zero when the geometry is unknown', async () => {
    const file = await buildXtcFromXtgPages([fakeXtgPage()], {})
    expect(new DataView(file).getBigUint64(40, true)).toBe(0n)
    expect(decodeSplitGeometry(new DataView(file).getBigUint64(40, true))).toBeUndefined()
  })

  test('keeps the container header otherwise intact', async () => {
    const pages = [fakeXtgPage(), fakeXtgPage()]
    const file = await buildXtcFromXtgPages(pages, { splitGeometry: GEOMETRY })
    const view = new DataView(file)
    const bytes = new Uint8Array(file)

    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2])).toBe('XTC')
    expect(view.getUint16(4, true)).toBe(1) // version stays 1.0
    expect(view.getUint16(6, true)).toBe(2) // page count
    // Without metadata the page table follows the 48-byte base header.
    expect(Number(view.getBigUint64(24, true))).toBe(48)
  })
})

describe('page-start map', () => {
  test('sits after the page table, before the first payload', async () => {
    // Cover, two split pages, a spread, another split page.
    const stripsPerSourcePage = [1, 3, 3, 1, 3]
    const totalStrips = 11
    const pages = Array.from({ length: totalStrips }, () => fakeXtgPage())

    const file = await buildXtcFromXtgPages(pages, {
      splitGeometry: GEOMETRY,
      stripsPerSourcePage,
    })
    const view = new DataView(file)

    const pageTableOffset = Number(view.getBigUint64(24, true))
    const dataOffset = Number(view.getBigUint64(32, true))
    const mapOffset = pageTableOffset + totalStrips * INDEX_ENTRY_SIZE
    const mapBytes = Math.ceil(totalStrips / 8)

    // The map occupies exactly the gap the builder opened for it.
    expect(dataOffset).toBe(mapOffset + mapBytes)

    const map = new Uint8Array(file, mapOffset, mapBytes)
    expect(readPageStartMap(map, totalStrips)).toEqual([0, 1, 4, 7, 8])
  })

  test('is announced by the flag bit, and only when present', async () => {
    const pages = Array.from({ length: 4 }, () => fakeXtgPage())

    const withMap = await buildXtcFromXtgPages(pages, {
      splitGeometry: GEOMETRY,
      stripsPerSourcePage: [1, 3],
    })
    const without = await buildXtcFromXtgPages(pages, { splitGeometry: GEOMETRY })

    expect(decodeSplitGeometry(new DataView(withMap).getBigUint64(40, true))!.hasPageStartMap).toBe(true)
    expect(decodeSplitGeometry(new DataView(without).getBigUint64(40, true))!.hasPageStartMap).toBe(false)
  })

  test('page payloads stay reachable through the page table', async () => {
    // The whole design rests on payloads being found via each entry's own
    // absolute offset, so inserting the map must not disturb them.
    const stripsPerSourcePage = [1, 3]
    const pages = [fakeXtgPage(), fakeXtgPage(), fakeXtgPage(), fakeXtgPage()]
    const file = await buildXtcFromXtgPages(pages, {
      splitGeometry: GEOMETRY,
      stripsPerSourcePage,
    })
    const view = new DataView(file)
    const pageTableOffset = Number(view.getBigUint64(24, true))

    let expectedOffset = Number(view.getBigUint64(32, true))
    for (let i = 0; i < pages.length; i++) {
      const entry = pageTableOffset + i * INDEX_ENTRY_SIZE
      const offset = Number(view.getBigUint64(entry, true))
      const length = view.getUint32(entry + 8, true)

      expect(offset).toBe(expectedOffset)
      expect(length).toBe(pages[i].byteLength)
      // Each entry points at a real XTG header, not into the map.
      expect(new Uint8Array(file)[offset]).toBe(0x58)
      expect(view.getUint16(entry + 12, true)).toBe(480)
      expect(view.getUint16(entry + 14, true)).toBe(800)

      expectedOffset += length
    }
    expect(expectedOffset).toBe(file.byteLength)
  })

  test('no map is written when strip counts are unknown', async () => {
    const pages = [fakeXtgPage(), fakeXtgPage()]
    const file = await buildXtcFromXtgPages(pages, { splitGeometry: GEOMETRY })
    const view = new DataView(file)

    // dataOffset follows the page table immediately, as it always has.
    expect(Number(view.getBigUint64(32, true))).toBe(
      Number(view.getBigUint64(24, true)) + pages.length * INDEX_ENTRY_SIZE,
    )
  })
})

describe('page-start map consistency', () => {
  test('a tally that does not cover every page suppresses the map', async () => {
    // A page that fails to convert is dropped from the payload list, so a
    // stale tally would misalign every bit against the page table.
    const pages = Array.from({ length: 4 }, () => fakeXtgPage())
    const file = await buildXtcFromXtgPages(pages, {
      splitGeometry: GEOMETRY,
      stripsPerSourcePage: [1, 3, 3],
    })
    const view = new DataView(file)

    expect(decodeSplitGeometry(view.getBigUint64(40, true))!.hasPageStartMap).toBe(false)
    expect(Number(view.getBigUint64(32, true))).toBe(
      Number(view.getBigUint64(24, true)) + pages.length * INDEX_ENTRY_SIZE,
    )
  })
})
