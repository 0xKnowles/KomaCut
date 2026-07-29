import { expect, test } from 'bun:test'
import { getDefaultContrast } from './defaults'

test('does not clip contrast from already processed PDF scans', () => {
  expect(getDefaultContrast('pdf')).toBe(0)
})

test('keeps the existing contrast default for other converters', () => {
  expect(getDefaultContrast('cbz')).toBe(4)
})
