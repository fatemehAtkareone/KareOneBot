import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import { call, ApiQuestion } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

export default function Questions() {
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const { data, isLoading } = useQuery({
    queryKey: ["questions"],
    queryFn: () => call<{ rows: ApiQuestion[] }>("questions"),
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    return rows.filter((r) => (tab === "open" ? !r.resolvedAt : !!r.resolvedAt));
  }, [data, tab]);

  return (
    <Layout title={t("qa_title")}>
      <div className="mb-3 flex gap-2">
        <button onClick={() => { setTab("open"); haptic("selection"); }} className={`chip ${tab === "open" ? "chip-active" : ""}`}>
          {t("qa_open")}
        </button>
        <button onClick={() => { setTab("resolved"); haptic("selection"); }} className={`chip ${tab === "resolved" ? "chip-active" : ""}`}>
          ⭐ {t("qa_resolved")}
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
      ) : filtered.length === 0 ? (
        <div className="card text-center text-sm text-tg-hint">{t("qa_no_qs")}</div>
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {filtered.map((q, i) => (
              <motion.li
                key={q.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="card"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-xs font-bold text-tg-accent">Q#{q.id}</span>
                  <span className="text-[10px] text-tg-hint">{new Date(q.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 line-clamp-3 text-sm">{q.body}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-tg-hint">
                  <span>👤 {q.asker}</span>
                  <span className="inline-flex items-center gap-1">
                    {q.resolvedAt && <span className="text-amber-500">⭐</span>}
                    💬 {q.answerCount} {t("qa_answers")}
                  </span>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Layout>
  );
}
