import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AdminPanel } from "./components/admin-panel";
import { FlohmarktApp } from "./components/flohmarkt-app";
import "./style.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");

const isAdmin = window.location.hash === "#admin";

createRoot(root).render(<StrictMode>{isAdmin ? <AdminPanel /> : <FlohmarktApp />}</StrictMode>);
