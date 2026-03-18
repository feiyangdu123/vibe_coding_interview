/**
 * Copy text to clipboard with fallback for non-secure contexts (HTTP + IP).
 * navigator.clipboard is only available in secure contexts (HTTPS or localhost).
 */
export function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text)
    return
  }
  // Fallback: use a hidden textarea + execCommand
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}
