/**
 * Helper function to extract plain text from HTML content
 * @param html HTML string to convert to plain text
 * @returns Plain text content with all HTML tags removed
 */
export const getPlainText = (html: string): string => {
  if (typeof window === 'undefined') {
    // Server-side rendering safe version
    return html.replace(/<[^>]*>/g, '');
  }
  
  // Browser version for more accurate text extraction
  const tmp = document.createElement('div'); 
  tmp.innerHTML = html; 
  return tmp.textContent || tmp.innerText || '';
}; 