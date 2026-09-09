export default function LinkPill({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className="rail inline-flex items-center gap-1 rounded-(--radius-chip) border border-line bg-surface px-2 py-1 transition-colors hover:border-accent hover:text-accent"
    >
      {label}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
