import "./index.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const root = document.getElementById("root");

if (root) {
  createRoot(root).render(React.createElement(App));
} else {
  console.error("Root element not found");
}
