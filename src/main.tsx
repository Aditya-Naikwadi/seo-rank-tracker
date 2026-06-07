import "./index.css";
import App from "./App.tsx";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import { UserProvider } from "./context/UserContext.tsx";

createRoot(document.getElementById("root")!).render(
    <BrowserRouter>
        <UserProvider>
            <ThemeProvider>
                <App />
            </ThemeProvider>
        </UserProvider>
    </BrowserRouter>
);

