import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiQuestion, ApiMember, ApiError } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

export default function Questions() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"open" | "resolved">("open");
  const [asking, setAsking] = useState(false);
  const [body, setBody] = useState("");
  const [targetId, setTargetId] = useState<number | null>(null);
  const [anonymous, setAnonymous] = useState(false);

  const { data, isLoading, error } = useQuery({ queryKey: ["questions"], queryFn: () => call<{ rows: ApiQuestion[] }>("questions") });
  const members = useQuery({ queryKey: ["members"], queryFn: () => call<{ rows: ApiMember[] }>("members") });
  const create = useMutation({
    mutationFn: () => call<{ id: number }>("question.create", { body, targetUserId: targetId, anonymous }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["questions"] }); setAsking(false); setBody(""); setTargetId(null); setAnonymous(false); haptic("success"); },
  });

  const filtered = useMemo(() => (data?.rows ?? []).filter((r) => (tab === "open" ? !r.resolvedAt : !!r.resolvedAt)), [data, tab]);

  if (error instanceof ApiError && error.status === 401) return <AuthError reason={error.reason} />;

  return (
    <Layout
      title={t("qa_title")}
      right={
        <button onClick={() => { setAsking((v) => !v); haptic("light"); }} className="btn !px-3 !py-1.5 text-xs">❓ {t("qa_ask")}</button>
      }
    >
      <AnimatePresence>
        {asking && (
          <motion.div className="card mb-3 space-y-2" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("qa_question_body")} rows={3} className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 outline-none" />
            <div>
              <div className="text-xs text-tg-hint mb-1">{t("qa_to_user")}</div>
              <div className="flex flex-wrap gap-1.5">
                <button onClick={() => setTargetId(null)} className={`chip ${targetId === null ? "chip-active" : ""}`}>{t("qa_anyone")}</button>
                {members.data?.rows.map((u) => (
                  <button key={u.id} onClick={() => setTargetId(u.id)} className={`chip ${targetId === u.id ? "chip-active" : ""}`}>👤 {u.name}</button>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
              {t("qa_anonymous")}
            </label>
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setAsking(false)}>{t("cancel")}</button>
              <button disabled={!body.trim() || create.isPending} onClick={() => create.mutate()} className="btn flex-1 disabled:opacity-50">{t("qa_post")}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mb-3 flex gap-2">
        <button onClick={() => { setTab("open"); haptic("selection"); }} className={`chip ${tab === "open" ? "chip-active" : ""}`}>{t("qa_open")}</button>
        <button onClick={() => { setTab("resolved"); haptic("selection"); }} className={`chip ${tab === "resolved" ? "chip-active" : ""}`}>⭐ {t("qa_resolved")}</button>
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
              >
                <Link to={`/qa/${q.id}`} onClick={() => haptic("light")} className="card block">
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
                </Link>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </Layout>
  );
}
