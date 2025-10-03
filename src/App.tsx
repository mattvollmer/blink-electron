import React, { useEffect, useState } from 'react';
import { useProjectStore } from './store/projectStore';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ChatInterface } from './components/ChatInterface';
import { Button } from './components/ui/button';
import { FolderPlus } from 'lucide-react';

export const App: React.FC = () => {
  const { projects, currentProjectId, addProject, setCurrentProject } = useProjectStore();
  const currentProject = projects.find(p => p.id === currentProjectId);

  const handleAddProject = async () => {
    const projectPath = await window.electronAPI.selectDirectory();
    if (!projectPath) return;

    // Check if it's already a blink project
    const check = await window.electronAPI.checkBlinkProject(projectPath);
    if (!check.success) {
      alert('Failed to check project');
      return;
    }

    if (!check.isBlinkProject) {
      alert('This directory does not contain a Blink project. Please run "blink init" first.');
      return;
    }

    // Find an available port
    const port = 3000 + projects.length;
    const name = projectPath.split('/').pop() || 'Unnamed Project';

    addProject({ name, path: projectPath, port });
  };

  return (
    <div className="flex h-screen bg-background">
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
    </div>
  );
};
