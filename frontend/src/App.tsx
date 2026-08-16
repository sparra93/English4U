import { MantineProvider } from "@mantine/core";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { theme } from "./theme/theme";
import { TutorProvider } from "./context/TutorContext";
import { AppShellLayout } from "./components/layout/AppShellLayout";
import { TutorSessionPage } from "./pages/TutorSessionPage";
import { ProgressPage } from "./pages/ProgressPage";

export default function App() {
  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <TutorProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppShellLayout />}>
              <Route path="/" element={<TutorSessionPage />} />
              <Route path="/progress" element={<ProgressPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TutorProvider>
    </MantineProvider>
  );
}
