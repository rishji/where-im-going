import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthedApp } from "./pages/AuthedApp";
import { PublicDirectory } from "./pages/PublicDirectory";
import { PublicProfile } from "./pages/PublicProfile";

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/going" element={<PublicDirectory />} />
        <Route path="/going/:slug" element={<PublicProfile />} />
        <Route path="*" element={<AuthedApp />} />
      </Routes>
    </BrowserRouter>
  );
}
