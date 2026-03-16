import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AdminPanel } from "./components/admin-panel";
import { FlohmarktApp } from "./components/flohmarkt-app";
import "./style.css";

function App() {
  const [isAdmin, setIsAdmin] = useState(window.location.hash === "#admin");

  useEffect(() => {
    const onHash = () => setIsAdmin(window.location.hash === "#admin");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return isAdmin ? <AdminPanel /> : <FlohmarktApp />;
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
