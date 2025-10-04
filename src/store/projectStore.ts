import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BlinkProject {
  id: string;
  name: string;
  path: string;
  port: number;
  status: "stopped" | "starting" | "running" | "error";
  pid?: number;
  messages?: Array<{
    id: string;
    role: "user" | "assistant";
    content: string;
    createdAt: Date;
  }>;
}

interface ProjectStore {
  projects: BlinkProject[];
  currentProjectId: string | null;

  // Actions
  addProject: (project: Omit<BlinkProject, "id" | "status">) => void;
  removeProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<BlinkProject>) => void;
  setCurrentProject: (id: string | null) => void;
  getCurrentProject: () => BlinkProject | undefined;
  setProjectMessages: (
    projectId: string,
    messages: BlinkProject["messages"],
  ) => void;
  addProjectMessage: (
    projectId: string,
    message: BlinkProject["messages"][0],
  ) => void;
}

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      projects: [],
      currentProjectId: null,

      addProject: (project) => {
        const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newProject: BlinkProject = {
          ...project,
          id,
          status: "stopped",
        };
        set((state) => ({
          projects: [...state.projects, newProject],
          currentProjectId: state.currentProjectId ?? id,
        }));
      },

      removeProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
        }));
      },

      updateProject: (id, updates) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates } : p,
          ),
        }));
      },

      setCurrentProject: (id) => {
        set({ currentProjectId: id });
      },

      getCurrentProject: () => {
        const { projects, currentProjectId } = get();
        return projects.find((p) => p.id === currentProjectId);
      },

      setProjectMessages: (projectId, messages) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId ? { ...p, messages } : p,
          ),
        }));
      },

      addProjectMessage: (projectId, message) => {
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === projectId
              ? { ...p, messages: [...(p.messages || []), message] }
              : p,
          ),
        }));
      },
    }),
    {
      name: "blink-project-store",
      getStorage: () => localStorage,
    },
  ),
);
