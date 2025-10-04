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
        state.setProjectMessages(id, []);
        toast.success("Chat context cleared");
      }
    });
    return unsubscribe;
  }, []);

  // Add useEffect to handle 'app:stop-streams'
  useEffect(() => {
    const unsubscribe = window.electronAPI.onStopStreams(async () => {
      const state = useProjectStore.getState();
      const id = state.currentProjectId;
      if (id) {
        try {
          await window.electronAPI.rebuildProject(id);
        } catch (e) {
          // ignore
        }
      }
    });
    return unsubscribe;
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
                No Project Selected
              </h3>
              <p className="text-sm text-muted-foreground">
                Add a project to get started
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
