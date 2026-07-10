type Status = "pending" | "crawling" | "done" | "error";

// APIから想定外の値が来ても落ちないように string も許容
export default function StatusBadge({ status }: { status?: Status | string | null }) {
  const map: Record<Status, { label: string; className: string }> = {
    pending: {
      label: "準備中",
      className: "bg-amber-50 text-amber-700 border border-amber-200",
    },
    crawling: {
      label: "クロール中",
      className: "bg-sky-50 text-sky-700 border border-sky-200 animate-pulse",
    },
    done: {
      label: "完了",
      className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    },
    error: {
      label: "エラー",
      className: "bg-red-50 text-red-700 border border-red-200",
    },
  };

  const key = (status ?? "pending").toString() as Status;
  const s = map[key];

  // ✅ 想定外のstatusでも必ず表示できるフォールバック
  const fallback = {
    label: status ? `不明: ${status}` : "不明",
    className: "bg-muted text-muted-foreground border border-border",
  };

  const view = s ?? fallback;

  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${view.className}`}>
      {view.label}
    </span>
  );
}
