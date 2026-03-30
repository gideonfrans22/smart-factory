/**
 * Get translation for a given path and language
 * @param path - Dot-separated path to translation key (e.g., "productionKPI.title")
 * @param lang - Language code ("en" or "ko"), defaults to "en"
 * @returns Translated string value
 */
export function getTranslation(
  translations: any,
  path: string,
  lang: string = "en"
): string {
  const keys = path.split(".");
  let value: any = translations;

  for (const key of keys) {
    if (value && typeof value === "object" && key in value) {
      value = value[key];
    } else {
      console.warn(`Translation not found for path: ${path}`);
      return path;
    }
  }

  if (typeof value === "object" && value !== null && lang in value) {
    return value[lang];
  }

  console.warn(`Language "${lang}" not found for path: ${path}`);
  return path;
}
