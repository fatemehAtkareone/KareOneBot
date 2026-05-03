import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  AreaChart, Area, CartesianGrid,
} from "recharts";
import Layout from "../components/Layout";
import StatTile from "../components/StatTile";
import { CardSkeleton } from "../components/Skeleton";
import { call, ApiStats, ApiLeaderboardRow, ApiTrendRow, ApiError } from "../lib/api";
import { t } from "../lib/i18n";
import AuthError from "../components/AuthError";

const STATUS_COLORS: Record<string, string> = {
  open: "#60a5fa", assigned: "#818cf8", in_progress: "#34d399",
  blocked: "#f87171", in_review: "#fbbf24", done: "#10b981",
  cancelled: "#9ca3af", rejected: "#f43f5e", archived: "#6b7280", draft: "#a3a3a3",
};
const PRIORITY_COLORS: Record<string, string> = {
  p0: "#f43f5e", p1: "#f97316", p2: "#fbbf24", p3: "#10b981",
};

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${m}m`;
}

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["stats"],
    queryFn: () => call<ApiStats>("stats"),
  });
  const lb = useQuery({ queryKey: ["leaderboard"], queryFn: () => call<{ rows: ApiLeaderboardRow[] }>("leaderboard") });
  const tr = useQuery({ queryKey: ["trend"], queryFn: () => call<{ rows: ApiTrendRow[] }>("trend") });

  if (isLoading) {
    return (
      <Layout title={t("nav_dashboard")}>
        <div className="grid grid-cols-2 gap-3">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="mt-3 space-y-3">
          <CardSkeleton /><CardSkeleton />
        </div>
      </Layout>
    );
  }
  if (error instanceof ApiError && error.status === 401) {
    return <AuthError reason={error.reason} />;
  }
  if (error || !data) {
    return (
      <Layout title={t("nav_dashboard")}>
        <div className="card text-center">
          <p className="text-sm text-tg-hint">{t("error")}</p>
          <p className="mt-1 text-xs text-tg-hint break-words">{error instanceof Error ? error.message : ""}</p>
          <button className="btn mt-3" onClick={() => refetch()}>{t("retry")}</button>
        </div>
      </Layout>
    );
  }

  const statusData = data.byStatus.map((r) => ({ name: r.status, value: r.n, color: STATUS_COLORS[r.status] ?? "#94a3b8" }));
  const priorityData = data.byPriority.map((r) => ({ name: r.priority.toUpperCase(), value: r.n, color: PRIORITY_COLORS[r.priority] ?? "#94a3b8" }));

  return (
    <Layout title={t("nav_dashboard")}>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="📥" label={t("d_open")} value={data.me.open} accent="from-sky-500/20 to-sky-500/0" />
        <StatTile icon="✅" label={t("d_done_week")} value={data.me.doneThisWeek} accent="from-emerald-500/20 to-emerald-500/0" />
        <StatTile icon="🚨" label={t("d_overdue")} value={data.me.overdue} accent="from-rose-500/20 to-rose-500/0" />
        <StatTile icon="⏱️" label={t("d_logged")} value={fmtH(data.me.loggedMinutes)} accent="from-indigo-500/20 to-indigo-500/0" />
      </div>

      <motion.div className="card mt-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="mb-2 text-sm font-semibold">{t("d_by_status")}</div>
        {statusData.length === 0 ? (
          <p className="text-sm text-tg-hint">{t("d_no_data")}</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={80} paddingAngle={3} animationDuration={700}>
                  {statusData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--tg-card)", border: "none", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-tg-hint">
              {statusData.map((d) => (
                <span key={d.name} className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                  {d.name} · <b className="text-tg-text">{d.value}</b>
                </span>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      <motion.div className="card mt-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <div className="mb-2 text-sm font-semibold">{t("d_by_priority")}</div>
        {priorityData.length === 0 ? (
          <p className="text-sm text-tg-hint">{t("d_no_data")}</p>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--tg-secondary-bg)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--tg-hint)", fontSize: 12 }} />
                <YAxis tick={{ fill: "var(--tg-hint)", fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--tg-card)", border: "none", borderRadius: 12, fontSize: 12 }} cursor={{ fill: "var(--tg-secondary-bg)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} animationDuration={700}>
                  {priorityData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      <motion.div className="card mt-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="mb-2 text-sm font-semibold">{t("d_trend_14d")}</div>
        {!tr.data?.rows?.length ? (
          <p className="text-sm text-tg-hint">{t("d_no_data")}</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tr.data.rows.slice(-14)} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gOpen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--tg-secondary-bg)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: "var(--tg-hint)", fontSize: 10 }} tickLine={false} axisLine={false} hide />
                <YAxis tick={{ fill: "var(--tg-hint)", fontSize: 12 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "var(--tg-card)", border: "none", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="open_count" stroke="#60a5fa" strokeWidth={2} fill="url(#gOpen)" animationDuration={700} />
                <Area type="monotone" dataKey="done" stroke="#10b981" strokeWidth={2} fill="url(#gDone)" animationDuration={700} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </motion.div>

      <motion.div className="card mt-3" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="mb-2 text-sm font-semibold">{t("d_leaderboard")}</div>
        {!lb.data?.rows?.length ? (
          <p className="text-sm text-tg-hint">{t("d_no_data")}</p>
        ) : (
          <ul className="divide-y divide-tg-secondaryBg/60">
            {lb.data.rows.map((r, i) => (
              <motion.li key={r.user_id} className="flex items-center justify-between py-2" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                <div className="flex items-center gap-2">
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${i === 0 ? "bg-amber-400 text-white" : i === 1 ? "bg-zinc-400 text-white" : i === 2 ? "bg-orange-700/70 text-white" : "bg-tg-secondaryBg text-tg-text"}`}>{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{r.name?.trim() || (r.username ? `@${r.username}` : `user#${r.user_id}`)}</div>
                    <div className="text-xs text-tg-hint">open: {r.open_count}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-emerald-500">{r.done14}</div>
                  <div className="text-[10px] text-tg-hint">done · 14d</div>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.div>
    </Layout>
  );
}
