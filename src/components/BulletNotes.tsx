export function BulletNotes({ text, empty = "No notes yet." }: { text: string; empty?: string }) {
  const lines = (text ?? "")
    .split(/\r?\n/)
    .map(l => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
  if (lines.length === 0) return <div className="text-sm text-muted-foreground">{empty}</div>;
  return (
    <ul className="list-disc pl-5 text-sm space-y-1">
      {lines.map((l, i) => <li key={i}>{l}</li>)}
    </ul>
  );
}

export function notesToBullets(text: string | null | undefined): string[] {
  return (text ?? "")
    .split(/\r?\n/)
    .map(l => l.replace(/^[\s•\-*]+/, "").trim())
    .filter(Boolean);
}