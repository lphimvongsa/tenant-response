// Shared route-shape helpers so the pieces that need to agree on "is this a
// conversation detail route" (ConversationsSplitView, MobileTabBar) can't
// drift out of sync with each other.

const CONVERSATION_DETAIL_RE = /^\/dashboard\/conversations\/[^/]+/

export function isConversationDetailPath(pathname: string): boolean {
  return CONVERSATION_DETAIL_RE.test(pathname)
}
