// The horse-derby sample stores everything under a single namespace: the user's
// betting history. (The reading-tracker base app used books/articles/papers and a
// UI picker; a betting game has one coherent memory space, so we collapse to one.)
export const ALLOWED_NAMESPACES = ["betting-history"] as const;
export type Namespace = (typeof ALLOWED_NAMESPACES)[number];
export const DEFAULT_NAMESPACE: Namespace = "betting-history";
