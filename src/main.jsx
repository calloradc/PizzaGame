import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles/game.css";
import "./styles/mobile.css";
import "./styles/release.css";
import "./styles/game-menu.css";

createRoot(document.getElementById("root")).render(<App />);
