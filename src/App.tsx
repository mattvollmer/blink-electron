import React, { useEffect } from "react";
import { ProjectSidebar } from "./components/ProjectSidebar";
import { ChatInterface } from "./components/ChatInterface";
import { useProjectStore } from "./store/projectStore";
import { Toaster, toast } from "sonner";

export const App: React.FC = () => {
  const { projects, currentProjectId } = useProjectStore();
  const currentProject = projects.find((p) => p.id === currentProjectId);

  // Handle app-level refresh (Cmd/Ctrl+R) to clear chat
  useEffect(() => {
    const unsubscribe = window.electronAPI.onRefreshChat(() => {
      const state = useProjectStore.getState();
      const id = state.currentProjectId;
      if (id) {
        // Clear messages
        state.setProjectMessages(id, []);

        // Rebuild the project
        window.electronAPI.rebuildProject(id).then((result) => {
          if (result.success && result.editPort !== undefined) {
            // Update editPort in store after rebuild
            state.updateProject(id, { editPort: result.editPort });
            console.log(
              `[App] Updated editPort after rebuild: ${result.editPort}`,
            );
          }
          toast.success("Chat context cleared");
        });
      }
    });
    return unsubscribe;
  }, []);

  // Handle global Ctrl/Cmd+E to toggle mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        const state = useProjectStore.getState();
        const id = state.currentProjectId;
        if (id) {
          const project = state.projects.find((p) => p.id === id);
          if (project) {
            const newMode = project.mode === "edit" ? "run" : "edit";
            console.log(
              `[Global Mode Toggle] ProjectId: ${id}, Current: ${project.mode ?? "run"}, New: ${newMode}`,
            );
            state.updateProject(id, { mode: newMode });
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen bg-background">
      <Toaster position="top-right" />
      <ProjectSidebar />

      <div className="flex-1 flex flex-col">
        {currentProject ? (
          <ChatInterface project={currentProject} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-medium text-muted-foreground">
                No Agent Selected
              </h3>
              <p className="text-sm text-muted-foreground">
                Add an agent to get started
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
