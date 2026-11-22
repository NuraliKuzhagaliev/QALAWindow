import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./style.css";
import "@fontsource/manrope/latin-400.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "@fontsource/noto-sans/cyrillic-ext-400.css";
import "@fontsource/noto-sans/cyrillic-400.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
if (
  "serviceWorker" in navigator &&
  location.protocol !== "qala:" &&
  import.meta.env.PROD
)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
