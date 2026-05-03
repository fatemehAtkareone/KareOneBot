import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { t } from "../lib/i18n";
import { tg } from "../lib/tg";

const BOT_URL = "https://t.me/KareOnebot";

interface Props {
  reason?: string;
  detail?: string;
  onRetry?: () => void;
}

export default function AuthError({ reason, detail, onRetry }: Props) {
  const [tgUserId, setTgUserId] = useState<number | null>(null);
  useEffect(() => {
    const u = tg()?.initDataUnsafe?.user;
    if (u?.id) setTgUserId(u.id);
  }, []);

  const titleKey =
    reason === "no_membership" ? "ae_no_membership_title"
    : reason === "inactive_membership" ? "ae_inactive_title"
    : reason === "expired" ? "ae_expired_title"
    : reason === "bad_hmac" ? "ae_bad_hmac_title"
    : "not_member_title";

  const bodyKey =
    reason === "no_membership" ? "ae_no_membership_body"
    : reason === "inactive_membership" ? "ae_inactive_body"
    : reason === "expired" ? "ae_expired_body"
    : reason === "bad_hmac" ? "ae_bad_hmac_body"
    : "not_member";

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <motion.div
        className="w-full max-w-sm rounded-3xl bg-tg-card p-8 text-center shadow-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="mb-4 text-5xl">🔒</div>
        <h1 className="mb-2 text-xl font-bold">{t(titleKey)}</h1>
        <p className="mb-6 text-sm text-tg-hint whitespace-pre-line">{t(bodyKey)}</p>
        <a href={BOT_URL} className="btn block">{t("open_bot")}</a>
        {onRetry && (
          <button onClick={onRetry} className="btn-ghost mt-2 block w-full">{t("retry")}</button>
        )}
        {(tgUserId || detail) && (
          <details className="mt-4 text-left text-xs text-tg-hint">
            <summary className="cursor-pointer">{t("ae_details")}</summary>
            <div className="mt-2 break-all rounded-lg bg-tg-secondaryBg p-2 font-mono text-[10px]">
              {tgUserId && <div>tg_user_id: {tgUserId}</div>}
              {reason && <div>reason: {reason}</div>}
              {detail && <div>detail: {detail}</div>}
            </div>
          </details>
        )}
      </motion.div>
    </div>
  );
}
