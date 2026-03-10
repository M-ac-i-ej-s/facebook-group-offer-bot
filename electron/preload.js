const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electron', {
  // Configuration management
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadConfig: () => ipcRenderer.invoke('load-config'),

  // Bot control
  startBot: (config) => ipcRenderer.invoke('start-bot', config),
  stopBot: () => ipcRenderer.invoke('stop-bot'),
  getBotStatus: () => ipcRenderer.invoke('get-bot-status'),

  // Testing
  testLogin: (credentials) => ipcRenderer.invoke('test-login', credentials),

  // Event listeners
  onBotStatus: (callback) => ipcRenderer.on('bot-status', (event, data) => callback(data)),
  onBotError: (callback) => ipcRenderer.on('bot-error', (event, data) => callback(data)),
  onBotCommentPosted: (callback) => ipcRenderer.on('bot-comment-posted', (event, data) => callback(data)),

  // Remove listeners
  removeBotStatusListener: () => ipcRenderer.removeAllListeners('bot-status'),
  removeBotErrorListener: () => ipcRenderer.removeAllListeners('bot-error'),
  removeCommentPostedListener: () => ipcRenderer.removeAllListeners('bot-comment-posted')
});
