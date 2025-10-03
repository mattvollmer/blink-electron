import React from 'react';
import { ProjectSidebar } from './components/ProjectSidebar';
import { ChatInterface } from './components/ChatInterface';
import { useProjectStore } from './store/projectStore';
import { Toaster } from 'sonner';

export const App: React.FC = () => {
  const { projects, currentProjectId } = useProjectStore();
  const currentProject = projects.find(p => p.id === currentProjectId);

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
              <h3 className="text-lg font-medium text-muted-foreground">No Project Selected</h3>
              <p className="text-sm text-muted-foreground">Add a project to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
