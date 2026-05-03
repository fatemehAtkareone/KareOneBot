import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiTaskDetail, ApiMember, ApiHistoryRow } from "../lib/api";
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
  { v: "p0", label: "🔴 P0" }, { v: "p1", label: "🟠 P1" }, { v: "p2", label: "🟡 P2" }, { v: "p3", label: "🟢 P3" },
];

type Panel = null | "snooze" | "reschedule" | "assignees" | "subtask" | "approval" | "history";

export default function TaskDetail() {
  const { id } = useParams();
  const taskId = Number(id);
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => call<ApiTaskDetail>("task", { id: taskId }),
    enabled: Number.isFinite(taskId),
  });
  const members = useQuery({ queryKey: ["members"], queryFn: () => call<{ rows: ApiMember[] }>("members") });

  const update = useMutation({
    mutationFn: (vars: Record<string, unknown>) => call("task.update", { id: taskId, ...vars }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["tasks"] }); qc.invalidateQueries({ queryKey: ["kanban"] }); haptic("success"); },
  });
  const watch = useMutation({
    mutationFn: (on: boolean) => call("task.watch", { id: taskId, on }),
    onSuccess: () => { refetch(); haptic("selection"); },
  });
  const comment = useMutation({
    mutationFn: (b: string) => call("task.comment", { id: taskId, body: b }),
    onSuccess: () => { refetch(); haptic("success"); setBody(""); },
  });
  const snooze = useMutation({
    mutationFn: (preset: string) => call("task.snooze", { id: taskId, preset }),
    onSuccess: () => { refetch(); haptic("success"); setPanel(null); },
  });
  const reschedule = useMutation({
    mutationFn: (dueAt: string | null) => call("task.reschedule", { id: taskId, dueAt }),
    onSuccess: () => { refetch(); haptic("success"); setPanel(null); },
  });
  const assigneeOp = useMutation({
    mutationFn: (vars: { userId: number; op: "add" | "remove" | "set" }) => call("task.assignee", { id: taskId, ...vars }),
    onSuccess: () => { refetch(); haptic("light"); },
  });
  const subtask = useMutation({
    mutationFn: (title: string) => call<{ id: number }>("task.subtask", { parentId: taskId, title }),
    onSuccess: () => { refetch(); haptic("success"); setSubTitle(""); setPanel(null); },
  });
  const timer = useMutation({
    mutationFn: (action: "start" | "stop") => call("task.timer", { id: taskId, action }),
    onSuccess: () => { refetch(); haptic("success"); },
  });
  const approval = useMutation({
    mutationFn: (vars: { approverIds: number[]; all: boolean }) => call("approval.create", { taskId, ...vars }),
    onSuccess: () => { refetch(); haptic("success"); setPanel(null); setApproverIds([]); setApprovalAll(false); qc.invalidateQueries({ queryKey: ["approvals"] }); },
  });

  const [body, setBody] = useState("");
  const [subTitle, setSubTitle] = useState("");
  const [panel, setPanel] = useState<Panel>(null);
  const [customDate, setCustomDate] = useState("");
  const [approverIds, setApproverIds] = useState<number[]>([]);
  const [approvalAll, setApprovalAll] = useState(false);

  useEffect(() => {
    const w = tg();
    if (!w) return;
    const cb = () => nav(-1);
    w.BackButton.show(); w.BackButton.onClick(cb);
    return () => { w.BackButton.hide(); w.BackButton.offClick(cb); };
  }, [nav]);

  if (error instanceof ApiError && error.status === 401) return <AuthError />;
  if (isLoading) return <Layout title={`#${id}`}><CardSkeleton /><div className="mt-3"><CardSkeleton /></div></Layout>;
  if (!data) return <Layout title={`#${id}`}><div className="card text-sm text-tg-hint">{t("error")}</div></Layout>;

  const tk = data.task;
  const overdue = tk.dueAt && new Date(tk.dueAt) < new Date() && tk.status !== "done";
  const assigneeIds = new Set(data.assignees.map((a) => a.userId));
  const timerRunning = data.timerStartedAt != null;
  const timerMin = data.timerStartedAt ? Math.floor((Date.now() - data.timerStartedAt) / 60000) : 0;

  return (
    <Layout title={`#${tk.id}`}>
      {/* Header card */}
      <motion.div className="card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-lg font-bold leading-snug">{tk.title}</h2>
        {tk.description && <p className="mt-2 whitespace-pre-wrap text-sm text-tg-hint">{tk.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {data.project && <span className="chip">🗂️ {data.project.name}</span>}
          <span className="chip">📅 {tk.dueAt ? new Date(tk.dueAt).toLocaleString() : t("t_no_due")}</span>
          {overdue && <span className="chip" style={{ background: "rgba(244,63,94,0.15)", color: "#f43f5e" }}>{t("t_overdue_label")}</span>}
          {timerRunning && (
            <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="chip" style={{ background: "rgba(16,185,129,0.15)", color: "#10b981" }}>
              ⏱️ {t("t_timer_running", { min: timerMin })}
            </motion.span>
          )}
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

        {/* Action grid */}
        <div className="mt-4 grid grid-cols-3 gap-1.5 text-xs">
          <ActionBtn icon="⏰" label={t("t_snooze")} onClick={() => setPanel(panel === "snooze" ? null : "snooze")} />
          <ActionBtn icon="📅" label={t("t_reschedule")} onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")} />
          <ActionBtn icon="👥" label={t("t_assignees")} onClick={() => setPanel(panel === "assignees" ? null : "assignees")} />
          <ActionBtn icon={data.watching ? "🌟" : "⭐"} label={data.watching ? t("t_unstar") : t("t_star")} onClick={() => watch.mutate(!data.watching)} />
          <ActionBtn icon="➕" label={t("t_subtask_add")} onClick={() => setPanel(panel === "subtask" ? null : "subtask")} />
          <ActionBtn icon="🛂" label={t("t_request_approval")} onClick={() => setPanel(panel === "approval" ? null : "approval")} />
          <ActionBtn icon={timerRunning ? "⏹️" : "⏱️"} label={timerRunning ? t("t_timer_stop") : t("t_timer_start")} onClick={() => timer.mutate(timerRunning ? "stop" : "start")} />
          <ActionBtn icon="📜" label={t("t_history")} onClick={() => setPanel(panel === "history" ? null : "history")} />
          <Link to="/tasks" onClick={() => haptic("light")} className="btn-ghost flex flex-col gap-0.5 !px-1 !py-2 text-[10px]">
            <span className="text-base">⬅️</span><span>{t("t_back_to_list")}</span>
          </Link>
        </div>
      </motion.div>

      {/* Panels */}
      <AnimatePresence>
        {panel === "snooze" && (
          <Panel key="snooze">
            <div className="grid grid-cols-2 gap-2">
              {[{ v: "1h", l: t("t_in_1h") }, { v: "3h", l: t("t_in_3h") }, { v: "tom9", l: t("t_tom_9") }, { v: "mon9", l: t("t_mon_9") }].map((s) => (
                <button key={s.v} onClick={() => snooze.mutate(s.v)} className="chip">⏰ {s.l}</button>
              ))}
            </div>
          </Panel>
        )}

        {panel === "reschedule" && (
          <Panel key="reschedule">
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: 0, l: t("t_due_today") }, { v: 1, l: t("t_due_tomorrow") },
                { v: 3, l: t("t_due_in_3d") }, { v: 7, l: t("t_due_next_mon") },
              ].map((d) => (
                <button
                  key={d.v}
                  onClick={() => {
                    const dt = new Date();
                    dt.setDate(dt.getDate() + d.v);
                    dt.setHours(17, 0, 0, 0);
                    reschedule.mutate(dt.toISOString());
                  }}
                  className="chip"
                >📅 {d.l}</button>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="datetime-local"
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
                className="flex-1 rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none"
              />
              <button onClick={() => customDate && reschedule.mutate(new Date(customDate).toISOString())} className="btn !px-3">{t("save")}</button>
            </div>
            <button onClick={() => reschedule.mutate(null)} className="btn-ghost mt-2 w-full">{t("t_clear_due")}</button>
          </Panel>
        )}

        {panel === "assignees" && (
          <Panel key="assignees">
            <div className="space-y-1.5">
              {(members.data?.rows ?? []).map((u) => {
                const on = assigneeIds.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => assigneeOp.mutate({ userId: u.id, op: on ? "remove" : "add" })}
                    className={`flex w-full items-center justify-between rounded-xl bg-tg-secondaryBg p-2.5 text-sm ${on ? "ring-2 ring-tg-accent" : ""}`}
                  >
                    <span>👤 {u.name}</span>
                    <span>{on ? "✅" : "+"}</span>
                  </button>
                );
              })}
            </div>
          </Panel>
        )}

        {panel === "subtask" && (
          <Panel key="subtask">
            <div className="flex gap-2">
              <input
                value={subTitle}
                onChange={(e) => setSubTitle(e.target.value)}
                placeholder={t("t_subtask_add")}
                className="flex-1 rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none"
              />
              <button disabled={!subTitle.trim() || subtask.isPending} onClick={() => subtask.mutate(subTitle.trim())} className="btn !px-4 disabled:opacity-50">{t("add")}</button>
            </div>
          </Panel>
        )}

        {panel === "approval" && (
          <Panel key="approval">
            <div className="text-xs text-tg-hint mb-2">{t("ap_pick_approvers")}</div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {(members.data?.rows ?? []).map((u) => {
                const on = approverIds.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => setApproverIds((cur) => on ? cur.filter((x) => x !== u.id) : [...cur, u.id])}
                    className={`chip ${on ? "chip-active" : ""}`}
                  >👤 {u.name}</button>
                );
              })}
            </div>
            <div className="flex gap-2 mb-2">
              <button onClick={() => setApprovalAll(false)} className={`chip ${!approvalAll ? "chip-active" : ""}`}>{t("ap_mode_any")}</button>
              <button onClick={() => setApprovalAll(true)} className={`chip ${approvalAll ? "chip-active" : ""}`}>{t("ap_mode_all")}</button>
            </div>
            <button
              disabled={approverIds.length === 0 || approval.isPending}
              onClick={() => approval.mutate({ approverIds, all: approvalAll })}
              className="btn w-full disabled:opacity-50"
            >🛂 {t("ap_send")}</button>
          </Panel>
        )}

        {panel === "history" && <HistoryPanel taskId={taskId} />}
      </AnimatePresence>

      {/* Subtasks */}
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

      {/* Comments */}
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
          <button disabled={!body.trim() || comment.isPending} onClick={() => comment.mutate(body.trim())} className="btn !px-3">{t("t_post")}</button>
        </div>
      </motion.div>
    </Layout>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={() => { onClick(); haptic("light"); }} className="btn-ghost flex flex-col gap-0.5 !px-1 !py-2 text-[10px]">
      <span className="text-base">{icon}</span>
      <span className="line-clamp-1">{label}</span>
    </button>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div className="card mt-3" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} style={{ overflow: "hidden" }}>
      {children}
    </motion.div>
  );
}

function HistoryPanel({ taskId }: { taskId: number }) {
  const { data, isLoading } = useQuery({
    queryKey: ["task-history", taskId],
    queryFn: () => call<{ rows: ApiHistoryRow[] }>("history", { id: taskId }),
  });
  return (
    <Panel>
      {isLoading ? (
        <div className="text-sm text-tg-hint">{t("loading")}</div>
      ) : (data?.rows ?? []).length === 0 ? (
        <div className="text-sm text-tg-hint">{t("hist_empty")}</div>
      ) : (
        <ul className="space-y-1.5">
          {data!.rows.map((r) => (
            <li key={r.id} className="text-xs">
              <span className="font-mono text-tg-hint">{new Date(r.createdAt).toLocaleString()}</span>
              <span className="mx-1">·</span>
              <span className="font-semibold">{r.who}</span>
              <span className="mx-1">·</span>
              <span>{r.action}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
