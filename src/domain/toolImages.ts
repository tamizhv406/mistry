/**
 * Bundled tool photographs and their licences.
 *
 * Every file listed here is stored in `public/tool-images/` and was taken from Wikimedia
 * Commons under the licence shown. See `public/tool-images/CREDITS.md` for the same list
 * in readable form. A tool with no entry simply shows a neutral placeholder.
 */
export interface ToolImage {
  file: string;       // path relative to the app base
  author: string;
  license: string;
  source: string;     // Wikimedia Commons file page
}

export const TOOL_IMAGES: Record<string, ToolImage> = {};
