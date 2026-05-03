import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiApprovalIncoming, ApiApprovalOutgoing } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  cancelled: "bg-tg-secondaryBg text-tg-hint",
};

export default function Approvals() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"incoming" | "outgoing">("incoming");
  const { data, isLoading, error } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => call<{ incoming: ApiApprovalIncoming[]; outgoing: ApiApprovalOutgoing[] }>("approvals"),
  });
  const decide = useMutation({
    mutationFn: (vars: { stepId: number; decision: "approved" | "rejected"; reason?: string }) => call("approval.decide", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["approvals"] }); haptic("success"); setRejecting(null); setReason(""); },
  });
  const [rejecting, setRejecting] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  if (error instanceof ApiError && error.status === 401) return <AuthError reason={error.reason} />;

  return (
    <Layout title={t("ap_title")}>
      <div className="mb-3 flex gap-2">
        <button onClick={() => { setTab("incoming"); haptic("selection"); }} className={`chip ${tab === "incoming" ? "chip-active" : ""}`}>📥 {t("ap_incoming")}</button>
        <button onClick={() => { setTab("outgoing"); haptic("selection"); }} className={`chip ${tab === "outgoing" ? "chip-active" : ""}`}>📤 {t("ap_outgoing")}</button>
      </div>

      {isLoading ? (
        <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
      ) : tab === "incoming" ? (
        (data?.incoming ?? []).length === 0 ? (
          <div className="card text-center text-sm text-tg-hint">{t("ap_none")}</div>
        ) : (
          <ul className="space-y-2">
            {data!.incoming.map((a, i) => (
              <motion.li key={`${a.approvalId}-${a.stepId}`} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="card">
                <div className="flex items-center justify-between">
                  <Link to={`/tasks/${a.taskId}`} onClick={() => haptic("light")} className="text-xs font-bold text-tg-accent">#{a.taskId}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[a.status]}`}>
                    {t(`ap_status_${a.status === "cancelled" ? "rejected" : a.status}`)}
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-semibold">{a.title}</h3>
                <div className="mt-1 text-xs text-tg-hint">
                  {t("ap_progress", { approved: a.approvedCount, required: a.requiredCount, rejected: a.rejectedCount })}
                </div>

                {a.decision === "pending" && a.status === "pending" ? (
                  <AnimatePresence>
                    {rejecting === a.stepId ? (
                      <motion.div key="rej" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-2">
                        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("ap_reason")} className="w-full rounded-xl bg-tg-secondaryBg px-3 py-2 text-sm outline-none" />
                        <div className="flex gap-2">
                          <button className="btn-ghost flex-1" onClick={() => setRejecting(null)}>{t("cancel")}</button>
                          <button className="btn flex-1" onClick={() => decide.mutate({ stepId: a.stepId, decision: "rejected", reason: reason.trim() || undefined })}>❌ {t("ap_reject")}</button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="mt-2 flex gap-2">
                        <button className="btn flex-1" onClick={() => decide.mutate({ stepId: a.stepId, decision: "approved" })}>✅ {t("ap_approve")}</button>
                        <button className="btn-ghost flex-1" onClick={() => setRejecting(a.stepId)}>❌ {t("ap_reject")}</button>
                      </div>
                    )}
                  </AnimatePresence>
                ) : (
                  <div className="mt-2 text-xs text-tg-hint">{t("ap_decided", { decision: a.decision })}</div>
                )}
              </motion.li>
            ))}
          </ul>
        )
      ) : (
        (data?.outgoing ?? []).length === 0 ? (
          <div className="card text-center text-sm text-tg-hint">{t("ap_none")}</div>
        ) : (
          <ul className="space-y-2">
            {data!.outgoing.map((a, i) => (
              <motion.li key={a.approvalId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="card">
                <div className="flex items-center justify-between">
                  <Link to={`/tasks/${a.taskId}`} className="text-xs font-bold text-tg-accent">#{a.taskId}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_TONE[a.status]}`}>
                    {t(`ap_status_${a.status === "cancelled" ? "rejected" : a.status}`)}
                  </span>
                </div>
                <h3 className="mt-1 text-sm font-semibold">{a.title}</h3>
                <div className="mt-1 text-xs text-tg-hint">
                  {t("ap_progress", { approved: a.approvedCount, required: a.requiredCount, rejected: a.rejectedCount })}
                </div>
              </motion.li>
            ))}
          </ul>
        )
      )}
    </Layout>
  );
}
