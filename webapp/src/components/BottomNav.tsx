import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { t } from "../lib/i18n";
import { haptic } from "../lib/tg";

const items = [
  { to: "/", icon: "📊", labelKey: "nav_dashboard" },
  { to: "/tasks", icon: "📋", labelKey: "nav_tasks" },
  { to: "/kanban", icon: "🗂️", labelKey: "nav_kanban" },
  { to: "/calendar", icon: "📅", labelKey: "nav_calendar" },
  { to: "/more", icon: "⋯", labelKey: "nav_more" },
];

export default function BottomNav() {
  const loc = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-tg-secondaryBg bg-tg-card/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-3xl items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((it) => {
          const active = it.to === "/" ? loc.pathname === "/" : loc.pathname.startsWith(it.to);
          return (
            <li key={it.to} className="flex-1">
              <NavLink
                to={it.to}
                onClick={() => haptic("selection")}
                className="relative flex flex-col items-center justify-center py-2 text-xs font-medium text-tg-hint"
              >
                {active && (
                  <motion.div
                    layoutId="navpill"
                    className="absolute -top-0.5 h-1 w-10 rounded-full bg-tg-accent"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <span className={`text-xl transition-transform ${active ? "scale-110" : ""}`}>{it.icon}</span>
                <span className={active ? "text-tg-text" : ""}>{t(it.labelKey)}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
