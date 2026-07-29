export function getDefaultContrast(fileType: string): number {
  return fileType === 'pdf' ? 0 : 4
}
