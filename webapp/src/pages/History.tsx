import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiHistoryRow } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

const ACTION_EMOJI: Record<string, string> = {
  create: "➕", update: "✏️", delete: "🗑️", assign: "👤", status_change: "🔄",
  comment: "💬", login: "🔐", invite: "🔗",
};

export default function History() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["history-workspace"],
    queryFn: () => call<{ rows: ApiHistoryRow[] }>("history.workspace"),
  });

  if (error instanceof ApiError && error.status === 401) return <AuthError reason={error.reason} />;

  return (
    <Layout title={t("hist_workspace")}>
      {isLoading ? (
        <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
      ) : (data?.rows ?? []).length === 0 ? (
        <div className="card text-sm text-tg-hint">{t("hist_empty")}</div>
      ) : (
        <ul className="space-y-1.5">
          {data!.rows.map((r, i) => {
            const summary = r.diff ? compactDiff(r.diff) : "";
            const inner = (
              <motion.div
                className="card flex items-start gap-3"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.2) }}
              >
                <span className="text-xl">{ACTION_EMOJI[r.action] ?? "•"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 text-xs text-tg-hint">
                    <span className="font-semibold text-tg-text">{r.who}</span>
                    <span>· {r.action}</span>
                    {r.entity && <span>· {r.entity}{r.entityId ? ` #${r.entityId}` : ""}</span>}
                  </div>
                  {summary && <div className="mt-0.5 truncate text-[11px] text-tg-hint font-mono">{summary}</div>}
                  <div className="mt-0.5 text-[10px] text-tg-hint">{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              </motion.div>
            );
            return r.entity === "task" && r.entityId ? (
              <Link key={r.id} to={`/tasks/${r.entityId}`} onClick={() => haptic("light")}>{inner}</Link>
            ) : (
              <div key={r.id}>{inner}</div>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}

function compactDiff(diff: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(diff)) {
    if (v === null || v === undefined) continue;
    const s = typeof v === "string" ? v : JSON.stringify(v);
    parts.push(`${k}=${s.length > 30 ? s.slice(0, 27) + "…" : s}`);
  }
  return parts.join(" · ");
}
