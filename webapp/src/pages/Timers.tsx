import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import AuthError from "../components/AuthError";
import { call, ApiError, ApiTimer } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

export default function Timers() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["timers"],
    queryFn: () => call<{ rows: ApiTimer[] }>("timers"),
    refetchInterval: 30_000,
  });
  const stop = useMutation({
    mutationFn: (taskId: number) => call("task.timer", { id: taskId, action: "stop" }),
    onSuccess: () => { refetch(); qc.invalidateQueries({ queryKey: ["tasks"] }); haptic("success"); },
  });

  if (error instanceof ApiError && error.status === 401) return <AuthError />;

  return (
    <Layout title={t("more_timers")}>
      {isLoading ? (
        <CardSkeleton />
      ) : (data?.rows ?? []).length === 0 ? (
        <div className="card text-sm text-tg-hint">—</div>
      ) : (
        <ul className="space-y-2">
          {data!.rows.map((tk, i) => (
            <motion.li key={tk.taskId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="card flex items-center justify-between gap-3">
              <Link to={`/tasks/${tk.taskId}`} onClick={() => haptic("light")} className="min-w-0 flex-1">
                <div className="text-xs font-bold text-tg-accent">#{tk.taskId}</div>
                <div className="truncate font-semibold text-sm">{tk.title}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-tg-hint">
                  <motion.span
                    className="inline-block h-2 w-2 rounded-full bg-emerald-500"
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  ⏱️ {tk.minutes} min
                </div>
              </Link>
              <button onClick={() => stop.mutate(tk.taskId)} className="btn !px-3 !py-2">⏹️</button>
            </motion.li>
          ))}
        </ul>
      )}
    </Layout>
  );
}
