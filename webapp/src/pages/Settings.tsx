import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiSettings } from "../lib/api";
import { setRtl, haptic } from "../lib/tg";
import { setLocale as setI18nLocale, t } from "../lib/i18n";

const QUIET_PRESETS = [
  { label: "—", start: null, end: null },
  { label: "22 → 08", start: "22:00", end: "08:00" },
  { label: "23 → 07", start: "23:00", end: "07:00" },
  { label: "21 → 09", start: "21:00", end: "09:00" },
];

export default function Settings() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ["settings"], queryFn: () => call<ApiSettings>("settings.get") });
  const update = useMutation({
    mutationFn: (vars: Partial<ApiSettings>) => call("settings.update", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["settings"] }); haptic("success"); },
  });

  const [lang, setLang] = useState<"fa" | "en">("fa");
  const [digest, setDigest] = useState(true);
  const [quiet, setQuiet] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });

  useEffect(() => {
    if (data) {
      setLang(data.language === "en" ? "en" : "fa");
      setDigest(data.digestEnabled);
      setQuiet({ start: data.quietStart, end: data.quietEnd });
    }
  }, [data]);

  // Re-import setLocale/setRtl from tg to avoid name clash with i18n.setLocale
  function pickLang(l: "fa" | "en") {
    setLang(l);
    setI18nLocale(l);
    setRtl(l);
    haptic("selection");
    update.mutate({ language: l });
  }

  if (error instanceof ApiError && error.status === 401) return <AuthError />;

  return (
    <Layout title={t("set_title")}>
      {isLoading || !data ? (
        <CardSkeleton />
      ) : (
        <>
          <motion.div className="card mb-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-sm font-semibold mb-2">🌐 {t("set_lang")}</div>
            <div className="flex gap-2">
              <button onClick={() => pickLang("fa")} className={`chip ${lang === "fa" ? "chip-active" : ""}`}>🇮🇷 {t("set_lang_fa")}</button>
              <button onClick={() => pickLang("en")} className={`chip ${lang === "en" ? "chip-active" : ""}`}>🇬🇧 {t("set_lang_en")}</button>
            </div>
          </motion.div>

          <motion.div className="card mb-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <div className="text-sm font-semibold mb-2">🔔 {t("set_notifications")}</div>
            <label className="flex items-center justify-between gap-2">
              <span className="text-sm">{t("set_digest")}</span>
              <input
                type="checkbox"
                checked={digest}
                onChange={(e) => { setDigest(e.target.checked); update.mutate({ digestEnabled: e.target.checked }); }}
                className="h-5 w-5"
              />
            </label>
          </motion.div>

          <motion.div className="card mb-3" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="text-sm font-semibold mb-2">🌙 {t("set_quiet")}</div>
            <div className="flex flex-wrap gap-2">
              {QUIET_PRESETS.map((p, i) => {
                const active = (quiet.start === p.start) && (quiet.end === p.end);
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setQuiet({ start: p.start, end: p.end });
                      update.mutate({ quietStart: p.start, quietEnd: p.end });
                    }}
                    className={`chip ${active ? "chip-active" : ""}`}
                  >
                    {p.start ? `🌙 ${p.label}` : `☀️ ${t("set_quiet_off")}`}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </Layout>
  );
}
