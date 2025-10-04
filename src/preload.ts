import { contextBridge, ipcRenderer } from "electron";

const api = {
  selectDirectory: () => ipcRenderer.invoke("select-directory"),

  startBlinkProject: (projectId: string, projectPath: string, port: number) =>
    ipcRenderer
      .invoke("start-blink-project", projectId, projectPath, port)
      .then((response) => {
        return { editPort: response.editPort, ...response };
      }),

  stopBlinkProject: (projectId: string) =>
    ipcRenderer.invoke("stop-blink-project", projectId),

  readFile: (filePath: string) => ipcRenderer.invoke("read-file", filePath),

  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("write-file", filePath, content),

  checkBlinkProject: (projectPath: string) =>
    ipcRenderer.invoke("check-blink-project", projectPath),

  checkDirectoryExists: (directoryPath: string) =>
    ipcRenderer.invoke("check-directory-exists", directoryPath),

  initBlinkProject: (projectPath: string) =>
    ipcRenderer.invoke("init-blink-project", projectPath),

  runBlinkLogin: () => ipcRenderer.invoke("run-blink-login"),

  updateAgentApiKey: (projectPath: string, apiKey: string, provider: string) =>
    ipcRenderer.invoke("update-agent-api-key", projectPath, apiKey, provider),

  rebuildProject: (projectId: string) =>
    ipcRenderer.invoke("rebuild-project", projectId),

  isProjectRunning: (projectId: string) =>
    ipcRenderer.invoke("is-project-running", projectId),

  onBlinkLog: (
    callback: (data: {
      projectId: string;
      level: string;
      message: string;
    }) => void,
  ) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on("blink:log", subscription);
    return () => {
      ipcRenderer.removeListener("blink:log", subscription);
      // Ensuring the return type is void
    };
  },

  onProcessExit: (
    callback: (data: { projectId: string; code: number | null }) => void,
  ) => {
    const subscription = (_event: any, data: any) => callback(data);
    ipcRenderer.on("blink:process-exit", subscription);
    return () => {
      ipcRenderer.removeListener("blink:process-exit", subscription);
      // Ensuring the return type is void
    };
  },

  // New: app-level refresh/clear chat event triggered by Cmd/Ctrl+R
  onRefreshChat: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("app:refresh-chat", subscription);
    return () => {
      ipcRenderer.removeListener("app:refresh-chat", subscription);
      // Ensuring the return type is void
    };
  },

  // Signal to stop any active streams (fired before chat clear)
  onStopStreams: (callback: () => void) => {
    const subscription = () => callback();
    ipcRenderer.on("app:stop-streams", subscription);
    return () => {
      ipcRenderer.removeListener("app:stop-streams", subscription);
      // Ensuring the return type is void
    };
  },

  getProjectInfo: (projectId: string) => {
    return ipcRenderer.invoke("get-project-info", projectId);
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);

export type ElectronAPI = typeof api;
