import { ReactNode } from "react";
import { motion } from "framer-motion";
import BottomNav from "./BottomNav";

interface Props { title?: string; children: ReactNode; right?: ReactNode }

export default function Layout({ title, children, right }: Props) {
  return (
    <div className="min-h-full pb-24">
      {title && (
        <header className="sticky top-0 z-20 border-b border-tg-secondaryBg/60 bg-tg-bg/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
            {right}
          </div>
        </header>
      )}
      <motion.main
        className="mx-auto max-w-3xl px-4 pt-4"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {children}
      </motion.main>
      <BottomNav />
    </div>
  );
}
