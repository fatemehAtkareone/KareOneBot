import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { call, ApiError } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";
import AuthError from "../components/AuthError";

interface MeRes {
  membership: { workspaceId: number; userId: number; role: string };
  workspace: { name: string } | null;
  user: { firstName: string | null; lastName: string | null };
}

interface Section {
  to: string;
  icon: string;
  labelKey: string;
  adminOnly?: boolean;
}

const SECTIONS_WORKSPACE: Section[] = [
  { to: "/qa",        icon: "💬", labelKey: "nav_qa" },
  { to: "/members",   icon: "👥", labelKey: "more_members" },
  { to: "/projects",  icon: "🗂️", labelKey: "more_projects" },
  { to: "/kb",        icon: "📚", labelKey: "more_kb" },
  { to: "/approvals", icon: "🛂", labelKey: "more_approvals" },
  { to: "/timers",    icon: "⏱️", labelKey: "more_timers" },
];
const SECTIONS_ADMIN: Section[] = [
  { to: "/sla",       icon: "⏰", labelKey: "more_sla", adminOnly: true },
  { to: "/invite",    icon: "🔗", labelKey: "more_invite", adminOnly: true },
  { to: "/history",   icon: "📜", labelKey: "more_history" },
];
const SECTIONS_ME: Section[] = [
  { to: "/settings",  icon: "⚙️", labelKey: "more_settings" },
];

export default function More() {
  const { data, error } = useQuery({ queryKey: ["me"], queryFn: () => call<MeRes>("me") });
  if (error instanceof ApiError && error.status === 401) return <AuthError reason={error.reason} />;
  const isAdmin = data?.membership?.role === "admin" || data?.membership?.role === "super_admin";

  return (
    <Layout title={t("more_title")}>
      {data && (
        <motion.div className="card mb-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="text-xs text-tg-hint">{t("more_workspace")}</div>
          <div className="text-lg font-bold">{data.workspace?.name ?? "—"}</div>
          <div className="mt-1 text-xs text-tg-hint">
            {(data.user?.firstName ?? "")} {(data.user?.lastName ?? "")} · <span className="rounded-full bg-tg-secondaryBg px-2 py-0.5">{data.membership.role}</span>
          </div>
        </motion.div>
      )}

      <Section title={t("more_workspace")} sections={SECTIONS_WORKSPACE} />
      <Section title={t("more_admin")} sections={isAdmin ? SECTIONS_ADMIN : SECTIONS_ADMIN.filter((s) => !s.adminOnly)} />
      <Section title="" sections={SECTIONS_ME} />
    </Layout>
  );
}

function Section({ title, sections }: { title: string; sections: Section[] }) {
  return (
    <div className="mb-4">
      {title && <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-tg-hint">{title}</div>}
      <div className="grid grid-cols-2 gap-2">
        {sections.map((s, i) => (
          <motion.div key={s.to} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
            <Link to={s.to} onClick={() => haptic("light")} className="card flex items-center gap-3 active:scale-[0.98] transition">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-sm font-semibold">{t(s.labelKey)}</span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
