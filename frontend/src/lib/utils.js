/** Merge class names (shadcn-style utility). */
export function cn(...inputs) {
  return inputs.filter(Boolean).join(' ');
}
