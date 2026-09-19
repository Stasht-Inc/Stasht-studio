// Strips the protocol for display only — the stored value (and the href
// built from it) keeps "https://" so the link still works. Profile Settings
// stores the website exactly as typed (placeholder even suggests
// "https://yourwebsite.com"), so every place that echoes it back needs this.
export function displayWebsite(website: string): string {
  return website.replace(/^https?:\/\//i, '');
}
