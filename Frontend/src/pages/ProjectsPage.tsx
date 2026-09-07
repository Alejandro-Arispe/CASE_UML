import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { createProject, joinProjectByInviteCode, listMyProjects } from '../services/projectApi';
import type { Project } from '../types/auth';
import { useAuthStore } from '../store/authStore';

export function ProjectsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newProjectName, setNewProjectName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      setProjects(await listMyProjects());
      setError(null);
    } catch {
      setError('No se pudieron cargar los proyectos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    try {
      await createProject(newProjectName.trim());
      setNewProjectName('');
      await refresh();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(message ?? 'No se pudo crear el proyecto');
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    try {
      await joinProjectByInviteCode(inviteCode.trim());
      setInviteCode('');
      await refresh();
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error : null;
      setError(message ?? 'No se pudo unir al proyecto');
    }
  }

  return (
    <div>
      <header>
        <h1>Mis proyectos</h1>
        {user && <span>{user.name}</span>}
        <button type="button" onClick={logout}>
          Cerrar sesion
        </button>
      </header>

      <form onSubmit={handleCreate}>
        <input
          type="text"
          placeholder="Nombre del nuevo proyecto"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
        />
        <button type="submit">+ Nuevo proyecto</button>
      </form>

      <form onSubmit={handleJoin}>
        <input
          type="text"
          placeholder="Codigo de invitacion (ej. SIS-482)"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
        />
        <button type="submit">Unirme</button>
      </form>

      {error && <p role="alert">{error}</p>}
      {loading && <p>Cargando...</p>}

      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <button type="button" onClick={() => navigate(`/projects/${project.id}/editor`)}>
              {project.name}
            </button>
            <span> - codigo: {project.inviteCode}</span>
            <span> - ultima modificacion: {new Date(project.updatedAt).toLocaleString()}</span>
          </li>
        ))}
        {!loading && projects.length === 0 && <li>Todavia no tenes proyectos.</li>}
      </ul>
    </div>
  );
}
