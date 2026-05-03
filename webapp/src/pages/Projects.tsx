import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiProject } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

export default function Projects() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["projects"], queryFn: () => call<{ rows: ApiProject[] }>("projects") });
  const create = useMutation({
    mutationFn: (vars: { name: string; description?: string }) => call<{ id: number }>("project.create", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); setCreating(false); setName(""); setDesc(""); haptic("success"); },
  });
  const archive = useMutation({
    mutationFn: (vars: { id: number; archived: boolean }) => call("project.archive", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["projects"] }); haptic("light"); },
  });

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  if (error instanceof ApiError && error.status === 401) return <AuthError />;

  return (
    <Layout
      title={t("proj_title")}
      right={
        <button onClick={() => { setCreating((v) => !v); haptic("light"); }} className="btn !px-3 !py-1.5 text-xs">
          ➕ {t("proj_new")}
        </button>
      }
    >
      <AnimatePresence>
        {creating && (
          <motion.div className="card mb-3 space-y-2" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("proj_name")} className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 outline-none" />
            <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t("proj_desc")} rows={2} className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none" />
            <div className="flex gap-2">
              <button className="btn-ghost flex-1" onClick={() => setCreating(false)}>{t("cancel")}</button>
              <button
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate({ name: name.trim(), description: desc.trim() || undefined })}
                className="btn flex-1 disabled:opacity-50"
              >{t("proj_create")}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
      ) : (data?.rows ?? []).length === 0 ? (
        <div className="card text-center text-sm text-tg-hint">{t("proj_none")}</div>
      ) : (
        <ul className="space-y-2">
          {data!.rows.map((p, i) => {
            const pct = p.total === 0 ? 0 : Math.round((p.done / p.total) * 100);
            return (
              <motion.li key={p.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className={`card ${p.archived ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🗂️</span>
                      <h3 className="font-semibold">{p.name}</h3>
                      {p.archived && <span className="rounded-full bg-tg-secondaryBg px-2 py-0.5 text-[10px]">{t("proj_archived")}</span>}
                    </div>
                    {p.description && <p className="mt-1 text-xs text-tg-hint">{p.description}</p>}
                  </div>
                  <button
                    onClick={() => archive.mutate({ id: p.id, archived: !p.archived })}
                    className="chip"
                  >
                    {p.archived ? t("proj_unarchive") : t("proj_archive")}
                  </button>
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-tg-hint">
                    <span>{t("proj_total", { n: p.total })}</span>
                    <span>{t("proj_progress", { done: p.done, total: p.total })} ({pct}%)</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tg-secondaryBg">
                    <motion.div
                      className="h-full bg-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}
