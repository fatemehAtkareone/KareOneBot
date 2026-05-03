import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiTask, ApiError } from "../lib/api";
import { PRIORITY_DOT, STATUS_KEYS } from "../lib/labels";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

type Filter = "all" | "mine" | "watching" | "done" | "overdue";

export default function Tasks() {
  const [filter, setFilter] = useState<Filter>("mine");
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const nav = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ["tasks", filter, submitted],
    queryFn: () => call<{ rows: ApiTask[] }>("tasks", { filter, search: submitted, limit: 100 }),
  });

  if (error instanceof ApiError && error.status === 401) return <AuthError />;

  return (
    <Layout
      title={t("nav_tasks")}
      right={
        <Link to="/tasks/new" className="btn !px-3 !py-1.5 text-xs" onClick={() => haptic("light")}>
          ➕ {t("t_new")}
        </Link>
      }
    >
      <div className="sticky top-14 z-10 -mx-4 mb-3 bg-tg-bg/80 px-4 pt-1 pb-3 backdrop-blur-md">
        <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); haptic("light"); }} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onBlur={() => setSubmitted(q.trim())}
            placeholder={t("t_search")}
            className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm text-tg-text outline-none placeholder:text-tg-hint"
          />
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {(["mine", "all", "watching", "overdue", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); haptic("selection"); }}
              className={`chip ${filter === f ? "chip-active" : ""}`}
            >
              {t(`t_${f}`)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      ) : (data?.rows ?? []).length === 0 ? (
        <div className="card text-center text-sm text-tg-hint">{t("t_empty")}</div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {data!.rows.map((r, i) => {
              const overdue = r.dueAt && new Date(r.dueAt) < new Date() && r.status !== "done";
              return (
                <motion.li
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 30 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { haptic("light"); nav(`/tasks/${r.id}`); }}
                  className="card flex items-start gap-3 cursor-pointer"
                >
                  <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${PRIORITY_DOT[r.priority] ?? "bg-zinc-400"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">#{r.id} · {r.title}</h3>
                      <span className="shrink-0 text-[10px] text-tg-hint">{t(STATUS_KEYS[r.status] ?? "status_open")}</span>
                    </div>
                    {r.description && <p className="mt-0.5 line-clamp-2 text-xs text-tg-hint">{r.description}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-tg-hint">
                      {r.dueAt ? (
                        <span className={overdue ? "font-semibold text-rose-500" : ""}>
                          {overdue ? "🚨 " : "📅 "}{new Date(r.dueAt).toLocaleString()}
                        </span>
                      ) : (
                        <span>📅 {t("t_no_due")}</span>
                      )}
                      {r.assignees && r.assignees.length > 0 ? (
                        <span>👤 {r.assignees.map((a) => a.name).join(", ")}</span>
                      ) : (
                        <span>👤 {t("t_unassigned")}</span>
                      )}
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </Layout>
  );
}
