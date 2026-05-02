import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Kanban from "./pages/Kanban";
import Calendar from "./pages/Calendar";
import Questions from "./pages/Questions";
import TaskDetail from "./pages/TaskDetail";
import NewTask from "./pages/NewTask";

export default function App() {
  const loc = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={loc} key={loc.pathname}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/new" element={<NewTask />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/qa" element={<Questions />} />
      </Routes>
    </AnimatePresence>
  );
}
