import { cp } from 'node:fs/promises'

export async function copyPdfJsWasmAssets(sourceDir: string, outputDir: string): Promise<void> {
  await cp(sourceDir, outputDir, { recursive: true })
}
