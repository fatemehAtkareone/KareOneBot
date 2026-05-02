import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor,
  useDroppable, useDraggable, useSensor, useSensors,
} from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "../components/Layout";
import { CardSkeleton } from "../components/Skeleton";
import { call } from "../lib/api";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

interface KTask { id: number; title: string; status: string; priority: "p0"|"p1"|"p2"|"p3"; dueAt: string | null }

const COLUMNS: { key: string; labelKey: string; tone: string }[] = [
  { key: "open",        labelKey: "k_open",        tone: "from-sky-500/15 to-sky-500/0" },
  { key: "assigned",    labelKey: "k_assigned",    tone: "from-indigo-500/15 to-indigo-500/0" },
  { key: "in_progress", labelKey: "k_in_progress", tone: "from-emerald-500/15 to-emerald-500/0" },
  { key: "blocked",     labelKey: "k_blocked",     tone: "from-rose-500/15 to-rose-500/0" },
  { key: "in_review",   labelKey: "k_in_review",   tone: "from-amber-500/15 to-amber-500/0" },
  { key: "done",        labelKey: "k_done",        tone: "from-emerald-600/15 to-emerald-600/0" },
];

const PR_DOT: Record<string, string> = { p0: "priority-p0", p1: "priority-p1", p2: "priority-p2", p3: "priority-p3" };

export default function Kanban() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["kanban"],
    queryFn: () => call<{ rows: KTask[] }>("kanban"),
  });
  const update = useMutation({
    mutationFn: (vars: { id: number; status: string }) => call("task.update", vars),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["kanban"] }); qc.invalidateQueries({ queryKey: ["stats"] }); },
  });

  const [active, setActive] = useState<KTask | null>(null);
  const [optimistic, setOptimistic] = useState<KTask[]>([]);
  useEffect(() => { if (data?.rows) setOptimistic(data.rows); }, [data?.rows]);

  const grouped = useMemo(() => {
    const g: Record<string, KTask[]> = Object.fromEntries(COLUMNS.map((c) => [c.key, [] as KTask[]]));
    for (const r of optimistic) (g[r.status] ?? (g[r.status] = [])).push(r);
    return g;
  }, [optimistic]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function onStart(e: DragStartEvent) {
    const id = Number(String(e.active.id).replace("task-", ""));
    const found = optimistic.find((r) => r.id === id) ?? null;
    setActive(found);
    haptic("light");
  }
  function onEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const id = Number(String(e.active.id).replace("task-", ""));
    const target = String(e.over.id).replace("col-", "");
    const tk = optimistic.find((r) => r.id === id);
    if (!tk || tk.status === target) return;
    setOptimistic((cur) => cur.map((r) => (r.id === id ? { ...r, status: target } : r)));
    update.mutate({ id, status: target });
    haptic("success");
  }

  return (
    <Layout title={t("nav_kanban")}>
      {isLoading ? (
        <div className="space-y-2"><CardSkeleton /><CardSkeleton /></div>
      ) : (
        <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd}>
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory">
            {COLUMNS.map((col) => (
              <Column key={col.key} id={`col-${col.key}`} label={t(col.labelKey)} count={grouped[col.key]?.length ?? 0} tone={col.tone}>
                <AnimatePresence>
                  {(grouped[col.key] ?? []).map((tk) => (
                    <DragCard key={tk.id} task={tk} onOpen={() => nav(`/tasks/${tk.id}`)} />
                  ))}
                </AnimatePresence>
              </Column>
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 200 }}>
            {active ? <Card task={active} dragging /> : null}
          </DragOverlay>
        </DndContext>
      )}
    </Layout>
  );
}

function Column({ id, label, count, tone, children }: { id: string; label: string; count: number; tone: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div className="snap-start shrink-0 w-[78vw] max-w-[280px]">
      <div className={`relative overflow-hidden rounded-2xl bg-tg-card shadow-card`}>
        <div className={`absolute inset-0 bg-gradient-to-b ${tone}`} />
        <div className="relative flex items-center justify-between px-3 pt-3">
          <h3 className="text-sm font-semibold">{label}</h3>
          <span className="rounded-full bg-tg-secondaryBg px-2 py-0.5 text-[11px] font-medium">{count}</span>
        </div>
        <div
          ref={setNodeRef}
          className={`relative min-h-[60vh] space-y-2 p-3 transition ${isOver ? "ring-2 ring-tg-accent/60" : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function DragCard({ task, onOpen }: { task: KTask; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `task-${task.id}` });
  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
    >
      <div {...listeners} {...attributes} onClick={onOpen}>
        <Card task={task} />
      </div>
    </motion.div>
  );
}

function Card({ task, dragging = false }: { task: KTask; dragging?: boolean }) {
  const overdue = task.dueAt && new Date(task.dueAt) < new Date() && task.status !== "done";
  return (
    <div className={`rounded-xl border border-tg-secondaryBg/70 bg-tg-bg p-2.5 ${dragging ? "shadow-lg" : ""}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${PR_DOT[task.priority] ?? "bg-zinc-400"}`} />
        <span className="text-[11px] text-tg-hint">#{task.id}</span>
      </div>
      <div className="mt-1 line-clamp-2 text-sm font-medium">{task.title}</div>
      {task.dueAt && (
        <div className={`mt-1 text-[11px] ${overdue ? "font-semibold text-rose-500" : "text-tg-hint"}`}>
          {overdue ? "🚨 " : "📅 "}{new Date(task.dueAt).toLocaleDateString()}
        </div>
      )}
    </div>
  );
}
