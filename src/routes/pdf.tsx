import { createFileRoute } from '@tanstack/react-router'
import { ConverterPage } from '../components/ConverterPage'

export const Route = createFileRoute('/pdf')({
  component: PdfPage,
})

function PdfPage() {
  return (
    <ConverterPage
      fileType="pdf"
      notice="PDF conversion uses the same processing as CBZ, and the defaults assume scanned manga. For a text document, switch dithering to Atkinson and drop contrast to 0."
    />
  )
}
