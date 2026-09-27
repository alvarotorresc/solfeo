export const SITE_NAME = 'Solfeo';

const TITLE_SEPARATOR = ' · ';

/** Builds the document title: "Page · Solfeo", or just "Solfeo" for the home page. */
export function buildPageTitle(pageTitle?: string): string {
  const trimmed = pageTitle?.trim();
  return trimmed ? `${trimmed}${TITLE_SEPARATOR}${SITE_NAME}` : SITE_NAME;
}
