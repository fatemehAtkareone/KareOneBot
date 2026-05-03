import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiMember, ApiError } from "../lib/api";
import { ROLE_BADGE } from "../lib/labels";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

interface MeRes { membership: { role: string } }

export default function Members() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => call<MeRes>("me") });
  const { data, isLoading, error } = useQuery({ queryKey: ["members"], queryFn: () => call<{ rows: ApiMember[] }>("members") });
  const updateMember = useMutation({
    mutationFn: (vars: Record<string, unknown>) => call("member.update", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["members"] }); haptic("success"); setEditing(null); },
  });
  const [editing, setEditing] = useState<{ membershipId: number; role: string } | null>(null);

  if (error instanceof ApiError && error.status === 401) return <AuthError />;
  const isAdmin = me.data?.membership?.role === "admin" || me.data?.membership?.role === "super_admin";

  return (
    <Layout
      title={t("mem_title")}
      right={
        isAdmin && (
          <Link to="/invite" onClick={() => haptic("light")} className="btn !px-3 !py-1.5 text-xs">
            🔗 {t("mem_invite")}
          </Link>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <ul className="space-y-2">
          {data?.rows.map((m, i) => {
            const badge = ROLE_BADGE[m.role] ?? ROLE_BADGE.member;
            return (
              <motion.li
                key={m.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
                className="card"
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">👤</span>
                      <div>
                        <div className={`font-semibold ${m.active ? "" : "line-through text-tg-hint"}`}>{m.name}</div>
                        {m.username && <div className="text-xs text-tg-hint">@{m.username}</div>}
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.tone}`}>{badge.label}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-tg-hint">
                  <span>📥 {t("mem_open_count", { n: m.openCount })}</span>
                  <span>✅ {t("mem_done30", { n: m.done30 })}</span>
                  <span>· {m.active ? t("mem_active") : t("mem_deactivated")}</span>
                </div>
                {isAdmin && (
                  <div className="mt-3 border-t border-tg-secondaryBg/60 pt-2">
                    {editing?.membershipId === m.membershipId ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(["super_admin", "admin", "manager", "member", "guest"] as const).map((r) => (
                          <button
                            key={r}
                            onClick={() => updateMember.mutate({ membershipId: m.membershipId, role: r })}
                            className={`chip ${editing.role === r ? "chip-active" : ""}`}
                          >{r}</button>
                        ))}
                        <button onClick={() => setEditing(null)} className="chip">{t("cancel")}</button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <button onClick={() => { setEditing({ membershipId: m.membershipId, role: m.role }); haptic("light"); }} className="chip">
                          ✏️ {t("mem_set_role")}
                        </button>
                        <button
                          onClick={() => updateMember.mutate({ membershipId: m.membershipId, active: !m.active })}
                          className="chip"
                        >
                          {m.active ? `🚫 ${t("mem_deactivate")}` : `✅ ${t("mem_activate")}`}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </motion.li>
            );
          })}
        </ul>
      )}
    </Layout>
  );
}
