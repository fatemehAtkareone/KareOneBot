import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Dashboard from "./pages/Dashboard";
import Tasks from "./pages/Tasks";
import Kanban from "./pages/Kanban";
import Calendar from "./pages/Calendar";
import Questions from "./pages/Questions";
import QuestionDetail from "./pages/QuestionDetail";
import TaskDetail from "./pages/TaskDetail";
import NewTask from "./pages/NewTask";
import More from "./pages/More";
import Members from "./pages/Members";
import Invite from "./pages/Invite";
import Projects from "./pages/Projects";
import KbSearch from "./pages/KbSearch";
import Approvals from "./pages/Approvals";
import Sla from "./pages/Sla";
import Settings from "./pages/Settings";
import History from "./pages/History";
import Timers from "./pages/Timers";

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
        <Route path="/qa/:id" element={<QuestionDetail />} />
        <Route path="/more" element={<More />} />
        <Route path="/members" element={<Members />} />
        <Route path="/invite" element={<Invite />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/kb" element={<KbSearch />} />
        <Route path="/approvals" element={<Approvals />} />
        <Route path="/sla" element={<Sla />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/history" element={<History />} />
        <Route path="/timers" element={<Timers />} />
      </Routes>
    </AnimatePresence>
  );
}
