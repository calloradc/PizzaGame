import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/game.css";
import "./styles/polish.css";
import "./styles/casual.css";
import "./styles/ultra.css";
import "./styles/mobile.css";

createRoot(document.getElementById("root")).render(<App />);
