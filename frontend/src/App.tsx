import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth";
import { Landing } from "./pages/Landing";
import { AuthPage } from "./pages/AuthPage";
import { Studio } from "./pages/Studio";
import { AvatarPage } from "./pages/AvatarPage";
import { InfluencersPage } from "./pages/InfluencersPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { CanvasPage } from "./pages/CanvasPage";
import { AgentPage } from "./pages/AgentPage";
import { McpPage } from "./pages/McpPage";
import { CoursesPage } from "./pages/CoursesPage";
import { LibraryPage } from "./pages/LibraryPage";
import { ModelsPage } from "./pages/ModelsPage";
import { LegalPage } from "./pages/LegalPage";
import { TopBar } from "./components/TopBar";
import { AgeGate } from "./components/AgeGate";
import { SpicyStudio } from "./pages/SpicyStudio";

export const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="boot">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/signin" element={<AuthPage mode="signin" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <div className="studio-shell">
      <TopBar />
      {!user.ageAttestedAt && <AgeGate />}
      <Routes>
        <Route path="/canvas" element={<CanvasPage />} />
        <Route path="/canvas/:id" element={<CanvasPage />} />
        <Route path="/templates" element={<TemplatesPage />} />
        <Route path="/avatar" element={<AvatarPage />} />
        <Route path="/characters" element={<InfluencersPage />} />
        <Route path="/studio" element={<Studio mode="image" />} />
        <Route path="/video" element={<Studio mode="video" />} />
        <Route path="/upscale" element={<Studio mode="upscale" />} />
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/mcp" element={<McpPage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/spicy" element={<SpicyStudio />} />
        <Route path="/terms" element={<LegalPage kind="terms" />} />
        <Route path="/privacy" element={<LegalPage kind="privacy" />} />
        <Route path="*" element={<Navigate to="/studio" replace />} />
      </Routes>
    </div>
  );
};
