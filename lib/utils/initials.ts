// First letter of the first two words of `name`, uppercased. Falls back to
// the first letter of `email`, then to "?" when both are empty.
//
// Shared between the header avatar (components/ui/ProfileMenu.tsx) and the
// Settings > Profile avatar so both render identical initials. The
// conversation components (ConversationView, EditContactPanel) use a
// name-only variant and are intentionally left untouched.
export function computeInitials(name: string, email: string): string {
  const trimmed = name.trim()
  if (trimmed) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('')
  }
  if (email) {
    return email.charAt(0).toUpperCase()
  }
  return '?'
}
