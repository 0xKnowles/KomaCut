import { expect, test } from 'bun:test'
import { getPdfJsWasmUrl, PDFJS_WASM_URL } from './pdfjs'

test('loads PDF.js image decoders from the bundled asset directory', () => {
  expect(PDFJS_WASM_URL).toBe('/pdfjs/wasm/')
})

test('loads PDF.js image decoders from dependencies during development', () => {
  expect(getPdfJsWasmUrl(true, '/')).toBe('/node_modules/pdfjs-dist/wasm/')
  expect(getPdfJsWasmUrl(false, '/')).toBe('/pdfjs/wasm/')
})

test('keeps production decoder assets under the configured app base', () => {
  expect(getPdfJsWasmUrl(false, '/xtcjs/')).toBe('/xtcjs/pdfjs/wasm/')
})
