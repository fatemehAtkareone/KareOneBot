import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import { call, ApiTaskDetail } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic, tg } from "../lib/tg";

const STATUS_OPTS = [
  { v: "open",        label: "📂 Open" },
  { v: "in_progress", label: "🔧 In progress" },
  { v: "blocked",     label: "🛑 Blocked" },
  { v: "in_review",   label: "👀 In review" },
  { v: "done",        label: "✅ Done" },
];
const PR_OPTS = [
  { v: "p0", label: "🔴 P0" },
  { v: "p1", label: "🟠 P1" },
  { v: "p2", label: "🟡 P2" },
  { v: "p3", label: "🟢 P3" },
];

export default function TaskDetail() {
  const { id } = useParams();
  const taskId = Number(id);
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => call<ApiTaskDetail>("task", { id: taskId }),
    enabled: Number.isFinite(taskId),
  });
  const update = useMutation({
    mutationFn: (vars: Record<string, unknown>) => call("task.update", { id: taskId, ...vars }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["kanban"] }); haptic("success"); },
  });
  const watch = useMutation({
    mutationFn: (on: boolean) => call("task.watch", { id: taskId, on }),
    onSuccess: () => { refetch(); haptic("selection"); },
  });
  const comment = useMutation({
    mutationFn: (body: string) => call("task.comment", { id: taskId, body }),
    onSuccess: () => { refetch(); haptic("success"); setBody(""); },
  });
  const [body, setBody] = useState("");

  useEffect(() => {
    const w = tg();
    if (!w) return;
    const cb = () => nav(-1);
    w.BackButton.show();
    w.BackButton.onClick(cb);
    return () => { w.BackButton.hide(); w.BackButton.offClick(cb); };
  }, [nav]);

  if (isLoading) return <Layout title={`#${id}`}><CardSkeleton /><div className="mt-3"><CardSkeleton /></div></Layout>;
  if (!data) return <Layout title={`#${id}`}><div className="card text-sm text-tg-hint">{t("error")}</div></Layout>;

  const tk = data.task;
  const overdue = tk.dueAt && new Date(tk.dueAt) < new Date() && tk.status !== "done";

  return (
    <Layout title={`#${tk.id}`}>
      <motion.div className="card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-lg font-bold leading-snug">{tk.title}</h2>
        {tk.description && <p className="mt-2 whitespace-pre-wrap text-sm text-tg-hint">{tk.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {data.project && <span className="chip">🗂️ {data.project.name}</span>}
          <span className="chip">📅 {tk.dueAt ? new Date(tk.dueAt).toLocaleString() : t("t_no_due")}</span>
          {overdue && <span className="chip" style={{ background: "rgba(244,63,94,0.15)", color: "#f43f5e" }}>{t("t_overdue_label")}</span>}
          <span className="chip">👤 {data.assignees.length === 0 ? t("t_unassigned") : data.assignees.map((a) => a.name).join(", ")}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div>
            <div className="mb-1 text-xs text-tg-hint">{t("t_status")}</div>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTS.map((s) => (
                <button key={s.v} onClick={() => update.mutate({ status: s.v })} className={`chip ${tk.status === s.v ? "chip-active" : ""}`}>{s.label}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-tg-hint">{t("t_priority")}</div>
            <div className="flex flex-wrap gap-1">
              {PR_OPTS.map((p) => (
                <button key={p.v} onClick={() => update.mutate({ priority: p.v })} className={`chip ${tk.priority === p.v ? "chip-active" : ""}`}>{p.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button className="btn-ghost flex-1" onClick={() => watch.mutate(!data.watching)}>
            {data.watching ? `🌟 ${t("t_unstar")}` : `⭐ ${t("t_star")}`}
          </button>
        </div>
      </motion.div>

      {data.subtasks.length > 0 && (
        <motion.div className="card mt-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <h3 className="mb-2 text-sm font-semibold">{t("t_subtasks")} · {data.subtasks.length}</h3>
          <ul className="space-y-1.5">
            {data.subtasks.map((s) => (
              <li key={s.id} onClick={() => nav(`/tasks/${s.id}`)} className="flex items-center gap-2 cursor-pointer">
                <span>{s.status === "done" ? "✅" : "⬜"}</span>
                <span className="text-sm">#{s.id} {s.title}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.div className="card mt-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <h3 className="mb-2 text-sm font-semibold">{t("t_comments")} · {data.comments.length}</h3>
        <AnimatePresence initial={false}>
          {data.comments.map((c) => (
            <motion.div key={c.id} className="mb-2 rounded-xl bg-tg-secondaryBg p-3" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="flex items-center justify-between text-[11px] text-tg-hint">
                <span className="font-medium text-tg-text">{c.author}</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </motion.div>
          ))}
        </AnimatePresence>
        <div className="mt-2 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("t_add_comment")}
            className="flex-1 rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none placeholder:text-tg-hint"
          />
          <button
            disabled={!body.trim() || comment.isPending}
            onClick={() => comment.mutate(body.trim())}
            className="btn !px-3"
          >{t("t_post")}</button>
        </div>
      </motion.div>
    </Layout>
  );
}
