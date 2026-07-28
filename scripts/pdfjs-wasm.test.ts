import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { copyPdfJsWasmAssets } from './pdfjs-wasm'

test('copies PDF.js decoder assets into the build output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xtcjs-pdfjs-wasm-'))
  const sourceDir = join(root, 'source')
  const outputDir = join(root, 'dist', 'pdfjs', 'wasm')

  await Bun.write(join(sourceDir, 'openjpeg.wasm'), 'decoder')
  await writeFile(join(sourceDir, 'LICENSE_OPENJPEG'), 'license')

  await copyPdfJsWasmAssets(sourceDir, outputDir)

  expect(await readFile(join(outputDir, 'openjpeg.wasm'), 'utf8')).toBe('decoder')
  expect(await readFile(join(outputDir, 'LICENSE_OPENJPEG'), 'utf8')).toBe('license')
})
