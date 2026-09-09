export default function KindBadge({ kind }: { kind: string }) {
  return (
    <span className="rail inline-flex items-center gap-1.5 rounded-(--radius-chip) border border-line px-1.5 py-px">
      <span className="size-1.5 rounded-full bg-secondary" aria-hidden="true" />
      {kind.replace(/-/g, ' ')}
    </span>
  );
}
