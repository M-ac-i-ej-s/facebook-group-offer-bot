const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const fs = require('fs');
const FacebookGroupBot = require('../bot-module');

let mainWindow;
let botInstance = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png')
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../src/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (botInstance) {
      botInstance.close();
    }
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC Handlers for Frontend Communication

/**
 * Save configuration to .env file
 */
ipcMain.handle('save-config', async (event, config) => {
  try {
    const envPath = path.join(__dirname, '../.env');
    const envContent = `# Facebook credentials
FB_EMAIL=${config.email}
FB_PASSWORD=${config.password}

# Facebook group URLs
${config.groups
  .filter(g => g.trim())
  .map((g, i) => `FB_GROUP_URL_${i + 1}=${g}`)
  .join('\n')}

# Keywords to search for (comma-separated, case-insensitive)
FB_KEYWORDS=${config.keywords.join(',')}

# Comment to post when keywords are found
FB_COMMENT=${config.comment}

# Check interval in milliseconds
CHECK_INTERVAL=${config.checkInterval}
`;

    fs.writeFileSync(envPath, envContent);
    return { success: true, message: '.env file saved successfully' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Load configuration from .env file
 */
ipcMain.handle('load-config', async (event) => {
  try {
    require('dotenv').config();
    
    const groups = [];
    let i = 1;
    while (process.env[`FB_GROUP_URL_${i}`]) {
      groups.push(process.env[`FB_GROUP_URL_${i}`]);
      i++;
    }

    const keywords = (process.env.FB_KEYWORDS || '').split(',').map(k => k.trim());

    return {
      success: true,
      config: {
        email: process.env.FB_EMAIL || '',
        password: process.env.FB_PASSWORD || '',
        groups: groups,
        keywords: keywords,
        comment: process.env.FB_COMMENT || '',
        checkInterval: parseInt(process.env.CHECK_INTERVAL || '300000')
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Start the bot
 */
ipcMain.handle('start-bot', async (event, config) => {
  try {
    if (botInstance) {
      return { success: false, error: 'Bot is already running' };
    }

    botInstance = new FacebookGroupBot({
      email: config.email,
      password: config.password,
      groupUrls: config.groups.filter(g => g.trim()),
      keywords: config.keywords,
      comment: config.comment,
      checkInterval: config.checkInterval
    });

    // Send status updates to frontend
    botInstance.on('status', (status) => {
      mainWindow?.webContents.send('bot-status', status);
    });

    botInstance.on('bot-error', (error) => {
      mainWindow?.webContents.send('bot-error', error);
    });

    botInstance.on('comment-posted', (data) => {
      mainWindow?.webContents.send('bot-comment-posted', data);
    });

    // Start monitoring first group
    if (config.groups.length > 0) {
      botInstance.start().catch(error => {
        mainWindow?.webContents.send('bot-error', error.message);
      });
    }

    return { success: true, message: 'Bot started' };
  } catch (error) {
    botInstance = null;
    return { success: false, error: error.message };
  }
});

/**
 * Stop the bot
 */
ipcMain.handle('stop-bot', async (event) => {
  try {
    if (botInstance) {
      await botInstance.close();
      botInstance = null;
      return { success: true, message: 'Bot stopped' };
    }
    return { success: false, error: 'Bot is not running' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

/**
 * Get bot status
 */
ipcMain.handle('get-bot-status', async (event) => {
  return {
    isRunning: botInstance !== null,
    status: botInstance ? 'running' : 'stopped'
  };
});

/**
 * Test login
 */
ipcMain.handle('test-login', async (event, credentials) => {
  try {
    const tempBot = new FacebookGroupBot({
      email: credentials.email,
      password: credentials.password,
      groupUrls: [],
      keywords: [],
      comment: ''
    });

    await tempBot.initialize();
    await tempBot.login();
    await tempBot.close();

    return { success: true, message: 'Login successful!' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
