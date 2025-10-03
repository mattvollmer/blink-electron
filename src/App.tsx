import React, { useEffect, useState } from 'react';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ChatInterface } from './components/ChatInterface';
import { useProjectStore } from './store/projectStore';
import { Toaster } from 'sonner';

export const App: React.FC = () => {
  const { projects, currentProjectId, addProject } = useProjectStore();
  const currentProject = projects.find(p => p.id === currentProjectId);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [pendingProjectPath, setPendingProjectPath] = useState<string>('');

  const handleAddProject = async () => {
    const projectPath = await window.electronAPI.selectDirectory();
    if (!projectPath) return;

    const check = await window.electronAPI.checkBlinkProject(projectPath);
    if (!check.success) {
      alert('Failed to check project');
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
      alert(`Failed to initialize Blink project:\n${initResult.error}`);
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

  return (
    <div className="flex h-screen bg-background">
      <Toaster position="top-right" />
      <ProjectSidebar />
      
      <div className="flex-1 flex flex-col">
        {currentProject ? (
          <ChatInterface project={currentProject} />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold">No Project Selected</h2>
              <p className="text-muted-foreground">Add a Blink project to get started</p>
              <Button onClick={handleAddProject}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add Project
              </Button>
            </div>
          </div>
        )}
      </div>

      <InitProjectDialog
        open={showInitDialog}
        onOpenChange={setShowInitDialog}
        onConfirm={handleInitConfirm}
        projectPath={pendingProjectPath}
      />
    </div>
  );
};
