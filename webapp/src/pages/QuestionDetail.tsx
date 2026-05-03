import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiQuestionDetail } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic, tg } from "../lib/tg";

export default function QuestionDetail() {
  const { id } = useParams();
  const qid = Number(id);
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["question", qid],
    queryFn: () => call<ApiQuestionDetail>("question", { id: qid }),
    enabled: Number.isFinite(qid),
  });
  const answer = useMutation({
    mutationFn: (body: string) => call("answer.create", { questionId: qid, body }),
    onSuccess: () => { refetch(); setBody(""); haptic("success"); qc.invalidateQueries({ queryKey: ["questions"] }); },
  });
  const upvote = useMutation({
    mutationFn: (aid: number) => call("answer.upvote", { id: aid }),
    onSuccess: () => { refetch(); haptic("light"); },
  });
  const official = useMutation({
    mutationFn: (aid: number) => call("answer.official", { id: aid }),
    onSuccess: () => { refetch(); haptic("success"); qc.invalidateQueries({ queryKey: ["questions"] }); },
  });

  const [body, setBody] = useState("");

  useEffect(() => {
    const w = tg();
    if (!w) return;
    const cb = () => nav(-1);
    w.BackButton.show(); w.BackButton.onClick(cb);
    return () => { w.BackButton.hide(); w.BackButton.offClick(cb); };
  }, [nav]);

  if (error instanceof ApiError && error.status === 401) return <AuthError />;
  if (isLoading) return <Layout title={`Q#${id}`}><CardSkeleton /></Layout>;
  if (!data) return <Layout title={`Q#${id}`}><div className="card text-sm text-tg-hint">{t("error")}</div></Layout>;

  return (
    <Layout title={`Q#${data.question.id}`}>
      <motion.div className="card mb-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between text-xs text-tg-hint">
          <span>👤 {data.question.asker}</span>
          <span>{new Date(data.question.createdAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 whitespace-pre-wrap text-base">{data.question.body}</p>
        {data.question.resolvedAt && (
          <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-700 dark:text-amber-300">
            ⭐ {t("qa_resolved")}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {data.answers.map((a) => (
          <motion.div
            key={a.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`card mb-2 ${a.isOfficial ? "ring-2 ring-amber-500/60" : ""}`}
          >
            <div className="flex items-center justify-between text-xs text-tg-hint">
              <span>👤 {a.author}</span>
              <span>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button onClick={() => upvote.mutate(a.id)} className="chip">👍 {a.upvotes} · {t("qa_upvote")}</button>
              {a.isOfficial && <span className="chip" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>⭐ {t("qa_official_marked")}</span>}
              {!a.isOfficial && data.canMarkOfficial && (
                <button onClick={() => official.mutate(a.id)} className="chip">⭐ {t("qa_official")}</button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <motion.div className="card mt-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("qa_answer_body")} rows={3}
          className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none" />
        <button
          disabled={!body.trim() || answer.isPending}
          onClick={() => answer.mutate(body.trim())}
          className="btn mt-2 w-full disabled:opacity-50"
        >{t("qa_send_answer")}</button>
      </motion.div>
    </Layout>
  );
}
