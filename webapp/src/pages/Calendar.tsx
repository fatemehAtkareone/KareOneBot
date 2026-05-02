import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import { call, ApiTask } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

const PR_DOT: Record<string, string> = { p0: "priority-p0", p1: "priority-p1", p2: "priority-p2", p3: "priority-p3" };

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

export default function Calendar() {
  const nav = useNavigate();
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const [selected, setSelected] = useState<string>(ymd(new Date()));

  const { data, isLoading } = useQuery({
    queryKey: ["tasks-cal"],
    queryFn: () => call<{ rows: ApiTask[] }>("tasks", { filter: "all", limit: 200 }),
  });

  const tasksByDay = useMemo(() => {
    const m = new Map<string, ApiTask[]>();
    for (const r of data?.rows ?? []) {
      if (!r.dueAt) continue;
      const d = new Date(r.dueAt);
      const key = ymd(d);
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return m;
  }, [data]);

  const grid = useMemo(() => {
    const start = startOfMonth(cursor);
    const end = endOfMonth(cursor);
    const startDow = (start.getDay() + 6) % 7; // Mon=0 (use Sunday=0 if you prefer)
    const cells: { date: Date | null }[] = [];
    for (let i = 0; i < startDow; i++) cells.push({ date: null });
    for (let d = 1; d <= end.getDate(); d++) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d) });
    while (cells.length % 7) cells.push({ date: null });
    return cells;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedTasks = tasksByDay.get(selected) ?? [];

  return (
    <Layout
      title={t("c_title")}
      right={
        <div className="flex items-center gap-1">
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => { setCursor(addMonths(cursor, -1)); haptic("selection"); }}>‹</button>
          <span className="px-1 text-xs font-medium">{monthLabel}</span>
          <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => { setCursor(addMonths(cursor, 1)); haptic("selection"); }}>›</button>
        </div>
      }
    >
      {isLoading ? (
        <CardSkeleton />
      ) : (
        <motion.div className="card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-tg-hint">
            {["M","T","W","T","F","S","S"].map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {grid.map((c, i) => {
              if (!c.date) return <div key={i} />;
              const k = ymd(c.date);
              const items = tasksByDay.get(k) ?? [];
              const isSelected = k === selected;
              const isToday = k === ymd(new Date());
              return (
                <motion.button
                  key={i}
                  whileTap={{ scale: 0.94 }}
                  onClick={() => { setSelected(k); haptic("selection"); }}
                  className={`relative aspect-square rounded-lg text-xs ${
                    isSelected ? "bg-tg-accent text-white" : "bg-tg-secondaryBg/60 hover:bg-tg-secondaryBg"
                  } ${isToday && !isSelected ? "ring-1 ring-tg-accent" : ""}`}
                >
                  <span className={`block ${items.length ? "font-bold" : ""}`}>{c.date.getDate()}</span>
                  {items.length > 0 && (
                    <span className="absolute inset-x-0 bottom-1 flex justify-center gap-0.5">
                      {items.slice(0, 3).map((it, j) => (
                        <span key={j} className={`h-1 w-1 rounded-full ${PR_DOT[it.priority] ?? "bg-zinc-400"}`} />
                      ))}
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}

      <div className="mt-3 space-y-2">
        <AnimatePresence mode="popLayout">
          {selectedTasks.length === 0 ? (
            <motion.div key="empty" className="card text-sm text-tg-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {t("c_no_tasks_day")}
            </motion.div>
          ) : (
            selectedTasks.map((tk) => (
              <motion.div
                key={tk.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => nav(`/tasks/${tk.id}`)}
                className="card flex items-start gap-2"
              >
                <span className={`mt-1.5 h-2 w-2 rounded-full ${PR_DOT[tk.priority] ?? "bg-zinc-400"}`} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">#{tk.id} · {tk.title}</div>
                  <div className="mt-0.5 text-xs text-tg-hint">
                    {tk.dueAt ? new Date(tk.dueAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                    {" · "}{tk.status}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
