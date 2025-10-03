import { contextBridge, ipcRenderer } from 'electron';

const api = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  startBlinkProject: (projectId: string, projectPath: string, port: number) =>
    ipcRenderer.invoke('start-blink-project', projectId, projectPath, port),
  
  stopBlinkProject: (projectId: string) =>
    ipcRenderer.invoke('stop-blink-project', projectId),
  
  readFile: (filePath: string) =>
    ipcRenderer.invoke('read-file', filePath),
  
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke('write-file', filePath, content),
  
  checkBlinkProject: (projectPath: string) =>
    ipcRenderer.invoke('check-blink-project', projectPath),
  
  initBlinkProject: (projectPath: string) =>
    ipcRenderer.invoke('init-blink-project', projectPath),
  
  onBlinkLog: (callback: (data: { projectId: string; level: string; message: string }) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('blink:log', subscription);
    return () => ipcRenderer.removeListener('blink:log', subscription);
  },
  
  onProcessExit: (callback: (data: { projectId: string; code: number | null }) => void) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on('blink:process-exit', subscription);
    return () => ipcRenderer.removeListener('blink:process-exit', subscription);
  },
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;
