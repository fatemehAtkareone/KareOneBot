import { motion } from "framer-motion";

export default function StatTile({
  label, value, accent = "from-sky-500/15 to-sky-500/0", icon,
}: {
  label: string; value: string | number; accent?: string; icon?: string;
}) {
  return (
    <motion.div
      className={`relative overflow-hidden card`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent}`} />
      <div className="relative">
        <div className="flex items-center gap-2 text-sm text-tg-hint">
          {icon && <span>{icon}</span>}
          <span>{label}</span>
        </div>
        <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
      </div>
    </motion.div>
  );
}
