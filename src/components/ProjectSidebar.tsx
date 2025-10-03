import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/projectStore';
import { Button } from './ui/button';
import { FolderPlus, Play, Square, Trash2 } from 'lucide-react';
import { InitProjectDialog } from './InitProjectDialog';
import { AuthRequiredDialog } from './AuthRequiredDialog';
import { toast } from 'sonner';

export const ProjectSidebar: React.FC = () => {
  const { projects, currentProjectId, setCurrentProject, addProject, removeProject, updateProject } = useProjectStore();
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [pendingProjectPath, setPendingProjectPath] = useState<string>('');
  const [authProjectPath, setAuthProjectPath] = useState<string>('');

  // Listen for authentication errors from Blink processes
  useEffect(() => {
    const unsubscribe = window.electronAPI.onBlinkLog((data) => {
      if (data.message.includes('You must be authenticated') || data.message.includes('blink login')) {
        const project = projects.find(p => p.id === data.projectId);
        if (project) {
          setAuthProjectPath(project.path);
          setShowAuthDialog(true);
          updateProject(data.projectId, { status: 'error' });
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
      toast.error('Failed to check project');
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
    const initResult = await window.electronAPI.initBlinkProject(pendingProjectPath);
    
    if (!initResult.success) {
      toast.error(`Failed to initialize Blink project:\n${initResult.error}`);
      return;
    }

    // Add to project list
    addProjectToList(pendingProjectPath);
    setPendingProjectPath('');
  };

  const addProjectToList = (projectPath: string) => {
    const port = 3000 + projects.length;
    const name = projectPath.split('/').pop() || 'Unnamed Project';
    addProject({ name, path: projectPath, port });
  };

  const handleStartProject = async (projectId: string, projectPath: string, port: number) => {
    updateProject(projectId, { status: 'starting' });
    
    const result = await window.electronAPI.startBlinkProject(projectId, projectPath, port);
    
    if (result.success) {
      updateProject(projectId, { status: 'running' });
    } else {
      updateProject(projectId, { status: 'error' });
      toast.error(`Failed to start project: ${result.error}`);
    }
  };

  const handleStopProject = async (projectId: string) => {
    await window.electronAPI.stopBlinkProject(projectId);
    updateProject(projectId, { status: 'stopped' });
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to remove this project?')) {
      removeProject(projectId);
    }
  };

  return (
    <div className="w-64 border-r border-border bg-card flex flex-col">
      <div className="p-4 border-b border-border">
        <h1 className="text-xl font-bold">Blink Desktop</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {projects.map((project) => (
          <div
            key={project.id}
            className={`p-3 rounded-lg cursor-pointer transition-colors ${
              currentProjectId === project.id
                ? 'bg-accent'
                : 'hover:bg-accent/50'
            }`}
            onClick={() => setCurrentProject(project.id)}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{project.path}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProject(project.id);
                }}
                className="text-muted-foreground hover:text-destructive ml-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-xs">
                {project.status === 'running' && (
                  <span className="text-green-600 dark:text-green-400">● Running</span>
                )}
                {project.status === 'stopped' && (
                  <span className="text-muted-foreground">○ Stopped</span>
                )}
                {project.status === 'starting' && (
                  <span className="text-yellow-600 dark:text-yellow-400">● Starting...</span>
                )}
                {project.status === 'error' && (
                  <span className="text-destructive">● Error</span>
                )}
              </span>
              
              {project.status === 'stopped' || project.status === 'error' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartProject(project.id, project.path, project.port);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Play className="w-4 h-4" />
                </button>
              ) : project.status === 'running' ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStopProject(project.id);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Square className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <Button onClick={handleAddProject} className="w-full">
          <FolderPlus className="w-4 h-4 mr-2" />
          Add Project
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
      />
    </div>
  );
};
