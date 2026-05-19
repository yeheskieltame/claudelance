/**
 * Render a Unix timestamp (seconds or ms) as a human-readable countdown.
 * Returns "Deadline reached" once past, "1 day left" / "N days left" otherwise.
 */
export function formatDeadline(deadline: string | number | undefined | null): string {
  if (deadline == null || deadline === "") return "No deadline";
  const numeric = Number(deadline);
  const date = Number.isFinite(numeric)
    ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
    : new Date(String(deadline));
  if (Number.isNaN(date.getTime())) return "No deadline";

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.ceil(diffMs / 86_400_000);
  if (diffDays <= 0) return "Deadline reached";
  if (diffDays === 1) return "1 day left";
  return `${diffDays} days left`;
}
