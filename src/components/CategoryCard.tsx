import type { CategoryStatus, Signup } from "@/lib/types";

export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded-full bg-sage-soft px-2 py-0.5 text-[11px] font-medium text-sage">
          {t}
        </span>
      ))}
    </span>
  );
}

/** One category drawn like a line on a paper sign-up sheet: filled slots, then open ones. */
export function CategoryCard({
  category,
  signups,
  mine,
  onClaim,
  onEdit,
}: {
  category: CategoryStatus;
  signups: Signup[];
  mine: Record<string, string>;
  onClaim: (categoryId: string) => void;
  onEdit: (s: Signup) => void;
}) {
  const full = category.left === 0;
  return (
    <section className="flex flex-col rounded-3xl border border-line bg-card p-5 shadow-[0_1px_0_rgba(42,26,18,0.04)]">
      <header className="flex items-start gap-3">
        <span className="text-3xl leading-none" aria-hidden>
          {category.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-tight">{category.label}</h3>
          <p className="mt-0.5 text-sm text-muted">{category.hint}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            full ? "bg-line/70 text-muted" : "bg-sage-soft text-sage"
          }`}
        >
          {full ? "Full" : `${category.left} of ${category.cap} open`}
        </span>
      </header>

      <ul className="mt-4 flex-1 divide-y divide-dashed divide-line border-t border-dashed border-line">
        {signups.map((s) => {
          const isMine = !!mine[s.id];
          return (
            <li key={s.id} className="flex items-start gap-3 py-2.5 animate-rise">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug">
                  <span className="font-semibold">{s.dish}</span>
                  <span className="text-muted"> · {s.name}</span>
                </p>
                <Tags tags={s.tags} />
              </div>
              {isMine && (
                <button
                  type="button"
                  onClick={() => onEdit(s)}
                  className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-cranberry hover:bg-cranberry/10"
                >
                  Edit
                </button>
              )}
            </li>
          );
        })}
        {Array.from({ length: category.left }, (_, i) => (
          <li key={`open-${i}`} className="py-1.5">
            <button
              type="button"
              onClick={() => onClaim(category.id)}
              className="group flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm text-muted transition hover:bg-squash/10 hover:text-ink"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-muted/60 text-xs group-hover:border-squash group-hover:text-squash">
                +
              </span>
              Open spot
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
