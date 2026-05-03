import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiInvite } from "../lib/api";
import { ROLE_BADGE } from "../lib/labels";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

interface CreateRes { token: string; link: string; expiresAt: string; role: string }
type Role = "member" | "manager" | "admin" | "guest";

export default function Invite() {
  const qc = useQueryClient();
  const [role, setRole] = useState<Role>("member");
  const [justCreated, setJustCreated] = useState<CreateRes | null>(null);
  const [copied, setCopied] = useState(false);

  const list = useQuery({ queryKey: ["invites"], queryFn: () => call<{ rows: ApiInvite[] }>("invites") });
  const create = useMutation({
    mutationFn: () => call<CreateRes>("invite.create", { role }),
    onSuccess: (r) => { setJustCreated(r); qc.invalidateQueries({ queryKey: ["invites"] }); haptic("success"); setCopied(false); },
  });

  if (list.error instanceof ApiError && list.error.status === 401) return <AuthError reason={list.error.reason} />;
  if (list.error instanceof ApiError && list.error.status === 500 && /admin/.test(list.error.body)) {
    return (
      <Layout title={t("more_invite")}>
        <div className="card text-sm text-tg-hint">{t("sla_admin_only")}</div>
      </Layout>
    );
  }

  return (
    <Layout title={t("more_invite")}>
      <motion.div className="card mb-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="text-sm font-semibold mb-2">{t("inv_create")}</div>
        <div className="text-xs text-tg-hint mb-2">{t("inv_role")}</div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(["member", "manager", "admin", "guest"] as Role[]).map((r) => (
            <button key={r} onClick={() => { setRole(r); haptic("selection"); }} className={`chip ${role === r ? "chip-active" : ""}`}>{r}</button>
          ))}
        </div>
        <button onClick={() => create.mutate()} disabled={create.isPending} className="btn w-full">
          🔗 {t("inv_create")}
        </button>

        {justCreated && (
          <motion.div className="mt-3 rounded-xl bg-tg-secondaryBg p-3 text-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="text-xs text-tg-hint mb-1">{t("inv_link")}</div>
            <div className="break-all font-mono text-xs">{justCreated.link}</div>
            <button
              onClick={async () => {
                try { await navigator.clipboard.writeText(justCreated.link); setCopied(true); haptic("success"); } catch { /* noop */ }
              }}
              className="btn-ghost mt-2 w-full !py-1.5 text-xs"
            >
              {copied ? `✅ ${t("inv_copied")}` : `📋 ${t("inv_copy")}`}
            </button>
          </motion.div>
        )}
      </motion.div>

      <div className="px-1 mb-2 text-xs font-semibold uppercase tracking-wide text-tg-hint">{t("inv_existing")}</div>
      {list.isLoading ? (
        <CardSkeleton />
      ) : list.data?.rows.length === 0 ? (
        <div className="card text-sm text-tg-hint">—</div>
      ) : (
        <ul className="space-y-2">
          {list.data?.rows.map((r) => {
            const expired = r.expiresAt && new Date(r.expiresAt) < new Date();
            const status = r.usedBy ? t("inv_used") : expired ? t("inv_expired") : t("inv_unused");
            const tone = r.usedBy ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : expired ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              : "bg-sky-500/15 text-sky-700 dark:text-sky-300";
            const badge = ROLE_BADGE[r.role] ?? ROLE_BADGE.member;
            return (
              <motion.li key={r.token} className="card flex items-center justify-between" layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{status}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.tone}`}>{badge.label}</span>
                  </div>
                  <div className="mt-1 truncate font-mono text-[11px] text-tg-hint">…{r.token.slice(-12)}</div>
                  <div className="text-[10px] text-tg-hint">{new Date(r.createdAt).toLocaleString()}</div>
                </div>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}
