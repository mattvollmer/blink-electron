import React, { useState, useEffect, useRef } from "react";
import { useProjectStore } from "../store/projectStore";
import { Button } from "./ui/button";
import { FolderPlus, Play, Square, Trash2 } from "lucide-react";
import { InitProjectDialog } from "./InitProjectDialog";
import { AuthRequiredDialog } from "./AuthRequiredDialog";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { MissingDirectoryDialog } from "./MissingDirectoryDialog";
import { ThemeToggle } from "./ThemeToggle";
import { toast } from "sonner";

export const ProjectSidebar: React.FC = () => {
  const {
    projects,
    currentProjectId,
    addProject,
    removeProject,
    updateProject,
    setCurrentProject,
  } = useProjectStore();
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMissingDirDialog, setShowMissingDirDialog] = useState(false);
  const [pendingProjectPath, setPendingProjectPath] = useState<string>("");
  const [authProjectPath, setAuthProjectPath] = useState<string>("");
  const [authProjectId, setAuthProjectId] = useState<string>("");
  const [deleteProjectId, setDeleteProjectId] = useState<string>("");
  const [missingDirProjectId, setMissingDirProjectId] = useState<string>("");
  const [sidebarWidth, setSidebarWidth] = useState(256); // 16rem = 256px
  const [isResizing, setIsResizing] = useState(false);
  const startupTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Sync project status on mount - check which projects are actually running
  useEffect(() => {
    const syncProjectStatuses = async () => {
      for (const project of projects) {
        const isRunning = await window.electronAPI.isProjectRunning(project.id);
        if (isRunning && project.status !== "running") {
          updateProject(project.id, { status: "running" });
        } else if (!isRunning && project.status === "running") {
          updateProject(project.id, { status: "stopped" });
        }
      }
    };
    syncProjectStatuses();
  }, []); // Only run once on mount

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      for (const timeout of startupTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
    };
  }, []);

  // Handle sidebar resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const newWidth = e.clientX;
      // Constrain between 200px and 500px
      if (newWidth >= 200 && newWidth <= 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = () => {
    setIsResizing(true);
  };

  // Listen for authentication errors from Blink processes
  useEffect(() => {
    const unsubscribe = window.electronAPI.onBlinkLog((data) => {
      if (
        data.message.includes("You must be authenticated") ||
        data.message.includes("blink login")
      ) {
        const project = projects.find((p) => p.id === data.projectId);
        if (project) {
          setAuthProjectPath(project.path);
          setAuthProjectId(project.id);
          setShowAuthDialog(true);
          updateProject(data.projectId, { status: "error" });
        }
      }
    });
    return unsubscribe;
  }, [projects, updateProject]);

  const handleAddProject = async () => {
    const projectPath = await window.electronAPI.selectDirectory();
    if (!projectPath) return;

    const check = await window.electronAPI.checkBlinkProject(projectPath);
    if (!check.success) {
      toast.error("Failed to check project");
      return;
    }

    if (!check.isBlinkProject) {
      // Show dialog and store the path
      setPendingProjectPath(projectPath);
      setShowInitDialog(true);
    } else {
      // Already a Blink project, add it directly
      addProjectToList(projectPath);
    }
  };

  const handleInitConfirm = async () => {
    if (!pendingProjectPath) return;

    // Run blink init
    const initResult =
      await window.electronAPI.initBlinkProject(pendingProjectPath);

    if (!initResult.success) {
      toast.error(`Failed to initialize Blink project:\n${initResult.error}`);
      return;
    }

    // Add to project list
    addProjectToList(pendingProjectPath);
    setPendingProjectPath("");
  };

  const addProjectToList = (projectPath: string) => {
    const port = 3000 + projects.length;
    const name = projectPath.split("/").pop() || "Unnamed Project";
    addProject({ name, path: projectPath, port, messages: [] });
  };

  const handleStartProject = async (
    projectId: string,
    projectPath: string,
    port: number,
  ) => {
    // Check if directory exists first
    const dirCheck = await window.electronAPI.checkDirectoryExists(projectPath);
    if (!dirCheck.exists) {
      setMissingDirProjectId(projectId);
      setShowMissingDirDialog(true);
      return;
    }

    updateProject(projectId, { status: "starting" });

    // Set timeout to mark as error if startup takes too long
    const timeoutId = setTimeout(() => {
      const project = projects.find((p) => p.id === projectId);
      if (project?.status === "starting") {
        updateProject(projectId, { status: "error" });
        toast.error(`Project startup timed out after 15 seconds`);
      }
      startupTimeoutsRef.current.delete(projectId);
    }, 15000);
    startupTimeoutsRef.current.set(projectId, timeoutId);

    const result = await window.electronAPI.startBlinkProject(
      projectId,
      projectPath,
      port,
    );

    // Clear timeout if we got a result
    const existingTimeout = startupTimeoutsRef.current.get(projectId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      startupTimeoutsRef.current.delete(projectId);
    }

    if (result.success) {
      updateProject(projectId, { status: "running" });
    } else {
      updateProject(projectId, { status: "error" });
      toast.error(`Failed to start project: ${result.error}`);
    }
  };

  const handleStopProject = async (projectId: string) => {
    // Clear any pending timeout
    const existingTimeout = startupTimeoutsRef.current.get(projectId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      startupTimeoutsRef.current.delete(projectId);
    }

    await window.electronAPI.stopBlinkProject(projectId);
    updateProject(projectId, { status: "stopped" });
  };

  const handleDeleteProject = (projectId: string) => {
    setDeleteProjectId(projectId);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    if (deleteProjectId) {
      removeProject(deleteProjectId);
      setDeleteProjectId("");
    }
  };

  const handleRelocateProject = async () => {
    const newPath = await window.electronAPI.selectDirectory();
    if (!newPath || !missingDirProjectId) return;

    const project = projects.find((p) => p.id === missingDirProjectId);
    if (!project) return;

    // Update project with new path and name
    const newName = newPath.split("/").pop() || project.name;
    updateProject(missingDirProjectId, { path: newPath, name: newName });

    setShowMissingDirDialog(false);
    setMissingDirProjectId("");
    toast.success(`Project relocated to: ${newPath}`);
  };

  const handleRemoveMissingProject = () => {
    if (missingDirProjectId) {
      removeProject(missingDirProjectId);
      setMissingDirProjectId("");
    }
    setShowMissingDirDialog(false);
  };

  const handleAuthDialogClose = async (saved: boolean) => {
    console.log(
      "[handleAuthDialogClose] Called with saved:",
      saved,
      "projectId:",
      authProjectId,
    );
    setShowAuthDialog(false);

    if (saved && authProjectId) {
      // Rebuild and restart the project
      const toastId = toast.loading("Rebuilding project...");
      console.log("[handleAuthDialogClose] Starting rebuild...");

      try {
        const result = await window.electronAPI.rebuildProject(authProjectId);
        console.log("[handleAuthDialogClose] Rebuild result:", result);
        toast.dismiss(toastId);

        if (result.success) {
          console.log(
            "[handleAuthDialogClose] Rebuild successful, updating project status",
          );
          toast.success("Project rebuilt and restarted!");
          // Update project status to running
          updateProject(authProjectId, { status: "running" });
        } else {
          console.error(
            "[handleAuthDialogClose] Rebuild failed:",
            result.error,
          );
          toast.error(`Failed to rebuild: ${result.error}`);
          updateProject(authProjectId, { status: "error" });
        }
      } catch (error) {
        console.error(
          "[handleAuthDialogClose] Exception during rebuild:",
          error,
        );
        toast.dismiss(toastId);
        toast.error(`Error: ${error}`);
        updateProject(authProjectId, { status: "error" });
      }
    }
  };

  return (
    <div
      className="border-r border-border bg-card flex flex-col relative"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">Blink Desktop</h1>
        <ThemeToggle />
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projects.map((project) => (
          <div
            key={project.id}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              currentProjectId === project.id
                ? "bg-accent"
                : "hover:bg-accent/50"
            }`}
            onClick={() => setCurrentProject(project.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{project.name}</h3>
                <p
                  className="text-xs text-muted-foreground truncate"
                  style={{ direction: "rtl", textAlign: "left" }}
                >
                  {project.path}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.id);
                }}
                className="text-foreground/60 hover:text-destructive dark:hover:text-red-400 ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs">
                {project.status === "running" && (
                  <span className="text-green-600 dark:text-green-400">
                    ● Running
                  </span>
                )}
                {project.status === "stopped" && (
                  <span className="text-muted-foreground">○ Stopped</span>
                )}
                {project.status === "starting" && (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    ● Starting...
                  </span>
                )}
                {project.status === "error" && (
                  <span className="text-destructive">● Error</span>
                )}
              </span>

              {project.status === "stopped" || project.status === "error" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartProject(project.id, project.path, project.port);
                  }}
                  className="text-green-600 hover:text-green-500 dark:text-green-400 dark:hover:text-green-300"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : project.status === "running" ||
                project.status === "starting" ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStopProject(project.id);
                  }}
                  className="text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4">
        <Button onClick={handleAddProject} className="w-full">
          <FolderPlus className="w-4 h-4 mr-2" />
          Add Agent
        </Button>
      </div>

      <InitProjectDialog
        open={showInitDialog}
        onOpenChange={setShowInitDialog}
        onConfirm={handleInitConfirm}
        projectPath={pendingProjectPath}
      />

      <AuthRequiredDialog
        open={showAuthDialog}
        onOpenChange={setShowAuthDialog}
        projectPath={authProjectPath}
        projectId={authProjectId}
        onClose={handleAuthDialogClose}
      />

      <DeleteProjectDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        projectName={projects.find((p) => p.id === deleteProjectId)?.name || ""}
        onConfirm={handleConfirmDelete}
      />

      <MissingDirectoryDialog
        open={showMissingDirDialog}
        onOpenChange={setShowMissingDirDialog}
        projectName={
          projects.find((p) => p.id === missingDirProjectId)?.name || ""
        }
        projectPath={
          projects.find((p) => p.id === missingDirProjectId)?.path || ""
        }
        onRelocate={handleRelocateProject}
        onRemove={handleRemoveMissingProject}
      />

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-accent transition-colors"
        onMouseDown={handleResizeStart}
        style={{
          userSelect: "none",
        }}
      />
    </div>
  );
};
