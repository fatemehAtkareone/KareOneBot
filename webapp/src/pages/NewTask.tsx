import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { call, ApiProject, ApiMember } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

const PR_OPTS: { v: "p0"|"p1"|"p2"|"p3"; label: string }[] = [
  { v: "p0", label: "🔴 P0" }, { v: "p1", label: "🟠 P1" }, { v: "p2", label: "🟡 P2" }, { v: "p3", label: "🟢 P3" },
];

export default function NewTask() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => call<{ rows: ApiProject[] }>("projects") });
  const members  = useQuery({ queryKey: ["members"],  queryFn: () => call<{ rows: ApiMember[]  }>("members")  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState<"p0"|"p1"|"p2"|"p3">("p2");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [dueAt, setDueAt] = useState<string>("");

  const create = useMutation({
    mutationFn: () => call<{ id: number }>("task.create", {
      title, description: desc || undefined, priority, projectId, assigneeId,
      dueAt: dueAt ? new Date(dueAt).toISOString() : null,
    }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["kanban"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      haptic("success");
      nav(`/tasks/${r.id}`, { replace: true });
    },
  });

  return (
    <Layout title={t("t_new")}>
      <motion.div className="card space-y-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-base outline-none" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" rows={3} className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none" />

        <div>
          <div className="mb-1 text-xs text-tg-hint">{t("t_priority")}</div>
          <div className="flex gap-1">
            {PR_OPTS.map((p) => (
              <button key={p.v} onClick={() => setPriority(p.v)} className={`chip ${priority === p.v ? "chip-active" : ""}`}>{p.label}</button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-xs text-tg-hint">{t("t_due")}</div>
          <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none" />
        </div>

        {(members.data?.rows ?? []).length > 0 && (
          <div>
            <div className="mb-1 text-xs text-tg-hint">{t("t_assignees")}</div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setAssigneeId(null)} className={`chip ${assigneeId === null ? "chip-active" : ""}`}>{t("t_unassigned")}</button>
              {members.data!.rows.map((u) => (
                <button key={u.id} onClick={() => setAssigneeId(u.id)} className={`chip ${assigneeId === u.id ? "chip-active" : ""}`}>👤 {u.name}</button>
              ))}
            </div>
          </div>
        )}

        {(projects.data?.rows ?? []).length > 0 && (
          <div>
            <div className="mb-1 text-xs text-tg-hint">{t("t_project")}</div>
            <div className="flex flex-wrap gap-1">
              <button onClick={() => setProjectId(null)} className={`chip ${projectId === null ? "chip-active" : ""}`}>—</button>
              {projects.data!.rows.map((p) => (
                <button key={p.id} onClick={() => setProjectId(p.id)} className={`chip ${projectId === p.id ? "chip-active" : ""}`}>🗂️ {p.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button className="btn-ghost flex-1" onClick={() => nav(-1)}>{t("cancel")}</button>
          <button
            className="btn flex-1 disabled:opacity-50"
            disabled={!title.trim() || create.isPending}
            onClick={() => create.mutate()}
          >{t("save")}</button>
        </div>
      </motion.div>
    </Layout>
  );
}
