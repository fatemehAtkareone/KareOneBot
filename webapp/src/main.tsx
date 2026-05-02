import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import OutsideTelegram from "./components/OutsideTelegram";
import { initTelegram, setRtl, tg } from "./lib/tg";
import { setLocale } from "./lib/i18n";
import "./styles/index.css";

initTelegram();
const lang = tg()?.initDataUnsafe?.user?.language_code ?? "fa";
setLocale(lang.startsWith("fa") ? "fa" : "en");
setRtl(lang);

const initData = tg()?.initData ?? "";
const insideTelegram = initData.length > 0;

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {insideTelegram ? (
      <QueryClientProvider client={qc}>
        <BrowserRouter basename="/webapp">
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    ) : (
      <OutsideTelegram />
    )}
  </React.StrictMode>,
);
