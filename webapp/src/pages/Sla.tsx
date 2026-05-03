import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiSla } from "../lib/api";
import { PRIORITY_LABEL } from "../lib/labels";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

interface MeRes { membership: { role: string } }

export default function Sla() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => call<MeRes>("me") });
  const { data, isLoading, error } = useQuery({ queryKey: ["sla"], queryFn: () => call<ApiSla>("sla.list") });
  const setOne = useMutation({
    mutationFn: (vars: { priority: string; responseMinutes: number; resolutionMinutes: number }) => call("sla.set", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sla"] }); haptic("success"); },
  });

  const [edits, setEdits] = useState<Record<string, { resp: number; reso: number }>>({});
  useEffect(() => {
    if (data) {
      const init: Record<string, { resp: number; reso: number }> = {};
      data.targets.forEach((tg) => { init[tg.priority] = { resp: tg.target.responseMinutes, reso: tg.target.resolutionMinutes }; });
      setEdits(init);
    }
  }, [data]);

  if (error instanceof ApiError && error.status === 401) return <AuthError reason={error.reason} />;
  const isAdmin = me.data?.membership?.role === "admin" || me.data?.membership?.role === "super_admin";

  return (
    <Layout title={t("sla_title")}>
      {!isAdmin && <div className="card mb-3 text-sm text-tg-hint">{t("sla_admin_only")}</div>}
      <div className="card mb-3 text-xs text-tg-hint">{t("sla_default_hint")}</div>
      {isLoading ? (
        <CardSkeleton />
      ) : (
        <ul className="space-y-2">
          {data?.targets.map((tgt, i) => (
            <motion.li key={tgt.priority} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card">
              <div className="mb-2 text-base font-bold">{PRIORITY_LABEL[tgt.priority]}</div>
              <div className="space-y-2">
                <Field
                  label={t("sla_response")}
                  value={edits[tgt.priority]?.resp ?? tgt.target.responseMinutes}
                  onChange={(v) => setEdits((e) => ({ ...e, [tgt.priority]: { ...(e[tgt.priority] ?? { resp: 0, reso: 0 }), resp: v } }))}
                  disabled={!isAdmin}
                />
                <Field
                  label={t("sla_resolution")}
                  value={edits[tgt.priority]?.reso ?? tgt.target.resolutionMinutes}
                  onChange={(v) => setEdits((e) => ({ ...e, [tgt.priority]: { ...(e[tgt.priority] ?? { resp: 0, reso: 0 }), reso: v } }))}
                  disabled={!isAdmin}
                />
              </div>
              {isAdmin && (
                <button
                  className="btn mt-3 w-full"
                  onClick={() => {
                    const e = edits[tgt.priority];
                    if (!e) return;
                    setOne.mutate({ priority: tgt.priority, responseMinutes: e.resp, resolutionMinutes: e.reso });
                  }}
                >{t("sla_save")}</button>
              )}
            </motion.li>
          ))}
        </ul>
      )}
    </Layout>
  );
}

function Field({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-tg-hint">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-24 rounded-lg bg-tg-secondaryBg px-2 py-1 text-right outline-none disabled:opacity-50"
        />
        <span className="text-xs text-tg-hint">{t("sla_minutes")}</span>
      </div>
    </div>
  );
}
