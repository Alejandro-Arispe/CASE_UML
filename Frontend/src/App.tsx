import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { EditorPage } from './pages/EditorPage';
import { RequireAuth } from './components/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/projects" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/projects"
          element={
            <RequireAuth>
              <ProjectsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/projects/:projectId/editor"
          element={
            <RequireAuth>
              <EditorPage />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
