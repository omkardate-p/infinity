/**
 * Turns a title into a URL slug: lowercase, words joined by single hyphens,
 * with anything that is not a letter or digit dropped.
 */
export function slugify(title: string): string {
  let slug = title.toLowerCase();
  slug = slug.replace(/'/g, "");
  slug = slug.replace(/[^a-z0-9]+/g, "-");
  slug = slug.replace(/^-+|-+$/g, "");
  return slug;
}
