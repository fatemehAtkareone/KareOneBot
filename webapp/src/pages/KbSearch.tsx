import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiKbRow } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

export default function KbSearch() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["kb", submitted],
    queryFn: () => call<{ rows: ApiKbRow[] }>("kb", { q: submitted }),
    enabled: submitted.length > 0,
  });

  if (error instanceof ApiError && error.status === 401) return <AuthError reason={error.reason} />;

  return (
    <Layout title={t("kb_title")}>
      <div className="card mb-3">
        <form onSubmit={(e) => { e.preventDefault(); setSubmitted(q.trim()); haptic("light"); }} className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("kb_search_ph")}
            className="flex-1 rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none"
          />
          <button type="submit" className="btn !px-4">🔎</button>
        </form>
      </div>

      {submitted && isLoading ? (
        <CardSkeleton />
      ) : submitted && (data?.rows ?? []).length === 0 ? (
        <div className="card text-center text-sm text-tg-hint">{t("kb_no_results")}</div>
      ) : (
        <ul className="space-y-2">
          {(data?.rows ?? []).map((r, i) => (
            <motion.li key={`${r.qid}-${r.aid}`} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
              <Link to={`/qa/${r.qid}`} onClick={() => haptic("selection")} className="card block">
                <div className="flex items-center gap-2 text-xs text-tg-hint">
                  <span className="text-tg-accent font-semibold">Q#{r.qid}</span>
                  {r.isOfficial && <span className="text-amber-500">⭐</span>}
                  <span>· 👍 {r.upvotes}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold">{r.qbody}</div>
                <div className="mt-1 line-clamp-3 text-xs text-tg-hint">→ {r.abody}</div>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
