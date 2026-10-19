/** Hostname without "www.", or the input unchanged if it isn't a URL. */
export function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}
