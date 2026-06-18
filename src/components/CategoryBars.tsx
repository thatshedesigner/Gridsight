type CategoryBarsProps = {
  items: {
    label: string;
    count: number;
  }[];
};

export default function CategoryBars({ items }: CategoryBarsProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-500">
        No category data is available for this station.
      </div>
    );
  }

  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div className="min-w-0" key={item.label}>
          <div className="mb-1 grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-3 text-sm">
            <span className="min-w-0 break-words font-medium text-slate-700">
              {item.label}
            </span>
            <span className="text-right tabular-nums text-slate-500">
              {item.count.toLocaleString("en-IN")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-800"
              style={{ width: `${(item.count / maxCount) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
