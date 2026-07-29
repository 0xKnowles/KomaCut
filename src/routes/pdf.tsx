import { createFileRoute } from '@tanstack/react-router'
import { ConverterPage } from '../components/ConverterPage'

export const Route = createFileRoute('/pdf')({
  component: PdfPage,
})

function PdfPage() {
  return (
    <ConverterPage
      fileType="pdf"
      notice="PDF conversion uses the same processing as CBZ. Start with Atkinson and no contrast; increase contrast only for faded documents."
    />
  )
}
