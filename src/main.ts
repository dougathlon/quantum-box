import { QuantumBoxApp } from "./app/QuantumBoxApp";
import "./styles.css";
import "./display/brownBox.css";

const root = document.querySelector<HTMLElement>("#app");
if (!root) throw new Error("Quantum Box requires an #app root element.");

const app = new QuantumBoxApp(root);
window.addEventListener("beforeunload", () => app.destroy(), { once: true });
