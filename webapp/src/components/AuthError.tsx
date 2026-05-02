import { motion } from "framer-motion";
import { t } from "../lib/i18n";

const BOT_URL = "https://t.me/KareOnebot";

/** Shown when initData is present but the user has no workspace membership. */
export default function AuthError() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <motion.div
        className="w-full max-w-sm rounded-3xl bg-tg-card p-8 text-center shadow-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <div className="mb-4 text-5xl">🔒</div>
        <h1 className="mb-2 text-xl font-bold">{t("not_member_title")}</h1>
        <p className="mb-6 text-sm text-tg-hint">{t("not_member")}</p>
        <a href={BOT_URL} className="btn block">{t("open_bot")}</a>
      </motion.div>
    </div>
  );
}
