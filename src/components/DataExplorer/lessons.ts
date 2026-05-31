/**
 * Data Explorer lesson catalog (manifest).
 *
 * Each entry corresponds to a static quarto-live page rendered from
 * `data-explorer/<slug>.qmd` into `public/data-explorer/lessons/<slug>.html` and served
 * by Vercel. The catalog (DataExplorer.tsx) renders one card per entry; available
 * lessons link out to the full-page lesson, placeholders render a disabled card.
 *
 * Titles/descriptions live in the `dataExplorer` i18n namespace under
 * `lessons.<slug>.title` / `lessons.<slug>.description`; category labels under
 * `categories.<category>`.
 *
 * Lessons are placeholders for now — add real entries here as `.qmd` lessons are
 * authored and rendered.
 */

/** Path under which rendered lesson HTML is served (static, outside React Router). */
export const LESSON_BASE_PATH = '/data-explorer/lessons';

export interface ExplorerLesson {
  /** URL slug; rendered page served at `${LESSON_BASE_PATH}/<slug>.html`. */
  slug: string;
  /** Category tag keys (resolved via i18n `categories.<key>`). */
  categories: string[];
  /** Whether the rendered lesson exists yet. Placeholders render as "coming soon". */
  available: boolean;
}

export const lessons: ExplorerLesson[] = [
  { slug: 'intro', categories: ['gettingStarted'], available: true },
  { slug: 'dataset', categories: ['gettingStarted'], available: true },
  // Placeholders — the practical "consult your data" sequence Lesson 1 points to. Content to be added.
  { slug: 'filter', categories: ['exploring'], available: false },
  { slug: 'select', categories: ['exploring'], available: false },
  { slug: 'summarise', categories: ['exploring'], available: false }
];
