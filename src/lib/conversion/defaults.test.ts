import { expect, test } from 'bun:test'
import { getDefaultContrast } from './defaults'

test('treats manga PDFs like the identical scans inside a CBZ', () => {
  // PDFs used to start at 0 for text documents, which under-processed every
  // manga PDF -- the case this tool exists for.
  expect(getDefaultContrast('pdf')).toBe(getDefaultContrast('cbz'))
})

test('keeps the existing contrast default for other converters', () => {
  expect(getDefaultContrast('cbz')).toBe(4)
  expect(getDefaultContrast('image')).toBe(4)
})
