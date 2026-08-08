import type { ConversionOptions } from './types'
import type { SplitGeometry } from '../xtc-geometry'

export interface WorkerProcessedPage {
  name: string
  xtg: ArrayBuffer
  previewJpeg?: ArrayBuffer
}

/**
 * One source page's output: its strips, and how they were cut.
 *
 * The strip count varies from page to page — a landscape spread is never split
 * — so the caller needs it per page to build the page-start map, not just the
 * flattened list of strips.
 */
export interface WorkerPageBatch {
  pages: WorkerProcessedPage[]
  geometry?: SplitGeometry
}

interface WorkerResponse {
  jobId: number
  pages?: WorkerProcessedPage[]
  geometry?: SplitGeometry
  error?: string
}

interface QueueJob {
  id: number
  pageNum: number
  blob: Blob
  options: ConversionOptions
  includePreview: boolean
  resolve: (batch: WorkerPageBatch) => void
  reject: (error: Error) => void
}

interface WorkerSlot {
  worker: Worker
  busy: boolean
  currentJob?: QueueJob
}

export function isWorkerPipelineSupported(): boolean {
  return typeof Worker !== 'undefined' &&
    typeof OffscreenCanvas !== 'undefined' &&
    typeof createImageBitmap !== 'undefined'
}

export class ConvertWorkerPool {
  private readonly slots: WorkerSlot[] = []
  private readonly queue: QueueJob[] = []
  private nextJobId = 1
  private isDestroyed = false

  constructor(poolSize: number) {
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(new URL('../workers/convert-page.worker.ts', import.meta.url), { type: 'module' })
      const slot: WorkerSlot = { worker, busy: false }

      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const message = event.data
        const job = slot.currentJob
        if (!job || job.id !== message.jobId) {
          return
        }

        slot.busy = false
        slot.currentJob = undefined

        if (message.error) {
          job.reject(new Error(message.error))
        } else {
          job.resolve({ pages: message.pages || [], geometry: message.geometry })
        }

        this.pump()
      }

      worker.onerror = (event: ErrorEvent) => {
        const job = slot.currentJob
        slot.busy = false
        slot.currentJob = undefined

        if (job) {
          job.reject(new Error(event.message || 'Page worker crashed'))
        }
        this.pump()
      }

      this.slots.push(slot)
    }
  }

  processPage(
    pageNum: number,
    blob: Blob,
    options: ConversionOptions,
    includePreview: boolean
  ): Promise<WorkerPageBatch> {
    if (this.isDestroyed) {
      return Promise.reject(new Error('Worker pool is destroyed'))
    }

    return new Promise((resolve, reject) => {
      const job: QueueJob = {
        id: this.nextJobId++,
        pageNum,
        blob,
        options,
        includePreview,
        resolve,
        reject
      }
      this.queue.push(job)
      this.pump()
    })
  }

  destroy(): void {
    if (this.isDestroyed) return
    this.isDestroyed = true

    for (const slot of this.slots) {
      if (slot.currentJob) {
        slot.currentJob.reject(new Error('Worker pool destroyed'))
        slot.currentJob = undefined
      }
      slot.worker.terminate()
    }

    while (this.queue.length > 0) {
      const job = this.queue.shift()!
      job.reject(new Error('Worker pool destroyed'))
    }
  }

  private pump(): void {
    if (this.isDestroyed) return

    for (const slot of this.slots) {
      if (slot.busy) continue
      const job = this.queue.shift()
      if (!job) return

      slot.busy = true
      slot.currentJob = job
      slot.worker.postMessage({
        jobId: job.id,
        pageNum: job.pageNum,
        blob: job.blob,
        options: job.options,
        includePreview: job.includePreview
      })
    }
  }
}
