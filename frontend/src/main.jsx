import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { DocTypesProvider } from "./context/DocTypesContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <DocTypesProvider>
          <App />
        </DocTypesProvider>
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>
);
