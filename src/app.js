// DOM Elements
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const togglePasswordBtn = document.getElementById('toggle-password');
const testLoginBtn = document.getElementById('test-login-btn');
const testLoginStatus = document.getElementById('test-login-status');

const keywordsInput = document.getElementById('keywords');
const commentInput = document.getElementById('comment');
const checkIntervalInput = document.getElementById('check-interval');

const saveConfigBtn = document.getElementById('save-config-btn');
const loadConfigBtn = document.getElementById('load-config-btn');
const saveStatus = document.getElementById('save-status');

const addGroupBtn = document.getElementById('add-group-btn');
const groupsContainer = document.getElementById('groups-container');

const startBotBtn = document.getElementById('start-bot-btn');
const stopBotBtn = document.getElementById('stop-bot-btn');
const realTimeStatus = document.getElementById('real-time-status');
const clearStatusBtn = document.getElementById('clear-status-btn');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

const commentsPosted = document.getElementById('comments-posted');
const postsFound = document.getElementById('posts-found');
const uptime = document.getElementById('uptime');
const lastCheck = document.getElementById('last-check');

const logsContainer = document.getElementById('logs-container');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const autoScrollCheckbox = document.getElementById('auto-scroll');

const navButtons = document.querySelectorAll('.nav-button');

// State
let isBotRunning = false;
let groupCount = 1;
let botStartTime = null;
let stats = {
    commentsPosted: 0,
    postsFound: 0,
    lastCheck: null
};

// Tab Navigation
navButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Remove active class from all nav buttons
    navButtons.forEach(btn => {
        btn.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabName).classList.add('active');

    // Add active class to clicked button
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
}

// Password Toggle
togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    togglePasswordBtn.textContent = type === 'password' ? '👁️' : '😴';
});

// Configuration Management
saveConfigBtn.addEventListener('click', async () => {
    const config = getConfigFromForm();

    if (!validateConfig(config)) {
        showMessage(saveStatus, 'Please fill in all required fields', 'error');
        return;
    }

    try {
        const result = await window.electron.saveConfig(config);

        if (result.success) {
            showMessage(saveStatus, result.message, 'success');
            addLog('Configuration saved successfully', 'success');
        } else {
            showMessage(saveStatus, result.error, 'error');
            addLog(`Error saving configuration: ${result.error}`, 'error');
        }
    } catch (error) {
        showMessage(saveStatus, `Error: ${error.message}`, 'error');
        addLog(`Error saving configuration: ${error.message}`, 'error');
    }
});

loadConfigBtn.addEventListener('click', async () => {
    try {
        const result = await window.electron.loadConfig();

        if (result.success) {
            const config = result.config;
            
            emailInput.value = config.email;
            passwordInput.value = config.password;
            keywordsInput.value = config.keywords.join(', ');
            commentInput.value = config.comment;
            checkIntervalInput.value = config.checkInterval / 1000;

            // Load groups
            groupsContainer.innerHTML = '';
            groupCount = 0;
            config.groups.forEach((group, index) => {
                if (group) {
                    addGroupInput(group);
                }
            });

            showMessage(saveStatus, 'Configuration loaded', 'success');
            addLog('Configuration loaded successfully', 'success');
        } else {
            showMessage(saveStatus, result.error || 'No configuration file found', 'error');
            addLog(`Error loading configuration: ${result.error}`, 'error');
        }
    } catch (error) {
        showMessage(saveStatus, `Error: ${error.message}`, 'error');
        addLog(`Error loading configuration: ${error.message}`, 'error');
    }
});

// Test Login
testLoginBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        showMessage(testLoginStatus, 'Please enter email and password', 'error');
        return;
    }

    testLoginBtn.disabled = true;
    showMessage(testLoginStatus, 'Testing login...', 'info');

    try {
        const result = await window.electron.testLogin({ email, password });

        if (result.success) {
            showMessage(testLoginStatus, result.message, 'success');
            addLog('Login test successful', 'success');
        } else {
            showMessage(testLoginStatus, result.error, 'error');
            addLog(`Login test failed: ${result.error}`, 'error');
        }
    } catch (error) {
        showMessage(testLoginStatus, `Error: ${error.message}`, 'error');
        addLog(`Login test error: ${error.message}`, 'error');
    } finally {
        testLoginBtn.disabled = false;
    }
});

// Group Management
addGroupBtn.addEventListener('click', () => {
    addGroupInput('');
});

function addGroupInput(value = '') {
    groupCount++;
    const groupDiv = document.createElement('div');
    groupDiv.className = 'form-group';
    groupDiv.innerHTML = `
        <label for="group-${groupCount}">Group ${groupCount} URL</label>
        <div style="display: flex; gap: 10px;">
            <input type="url" class="group-url" id="group-${groupCount}" 
                   placeholder="https://www.facebook.com/groups/123456/" value="${value}">
            <button type="button" class="btn btn-danger btn-sm remove-group-btn">Remove</button>
        </div>
    `;

    const removeBtn = groupDiv.querySelector('.remove-group-btn');
    removeBtn.addEventListener('click', () => {
        groupDiv.remove();
    });

    groupsContainer.appendChild(groupDiv);
}

// Bot Control
startBotBtn.addEventListener('click', async () => {
    const config = getConfigFromForm();

    if (!validateConfig(config)) {
        switchTab('configuration');
        addLog('Please complete the configuration before starting the bot', 'error');
        return;
    }

    startBotBtn.disabled = true;
    addLog('Starting bot...', 'info');

    try {
        const result = await window.electron.startBot(config);

        if (result.success) {
            isBotRunning = true;
            updateBotStatus(true);
            addLog('Bot started successfully', 'success');
            startBotBtn.disabled = true;
            stopBotBtn.disabled = false;
            botStartTime = Date.now();
            startUptimeTimer();
            switchTab('monitoring');
        } else {
            addLog(`Failed to start bot: ${result.error}`, 'error');
            startBotBtn.disabled = false;
        }
    } catch (error) {
        addLog(`Error starting bot: ${error.message}`, 'error');
        startBotBtn.disabled = false;
    }
});

stopBotBtn.addEventListener('click', async () => {
    stopBotBtn.disabled = true;
    addLog('Stopping bot...', 'info');

    try {
        const result = await window.electron.stopBot();

        if (result.success) {
            isBotRunning = false;
            updateBotStatus(false);
            addLog('Bot stopped successfully', 'success');
            startBotBtn.disabled = false;
            stopBotBtn.disabled = true;
            botStartTime = null;
        } else {
            addLog(`Failed to stop bot: ${result.error}`, 'error');
            stopBotBtn.disabled = false;
        }
    } catch (error) {
        addLog(`Error stopping bot: ${error.message}`, 'error');
        stopBotBtn.disabled = false;
    }
});

clearStatusBtn.addEventListener('click', () => {
    realTimeStatus.innerHTML = '';
});

clearLogsBtn.addEventListener('click', () => {
    logsContainer.innerHTML = '';
    addLog('Logs cleared', 'info');
});

// Bot Status Updates
window.electron.onBotStatus((status) => {
    addStatus(status);
    addLog(status, 'info');

    // Update last check time
    if (status.includes('Checking group') || status.includes('Next check')) {
        stats.lastCheck = new Date().toLocaleTimeString();
        updateStats();
    }

    // Update found posts count
    if (status.includes('Found')) {
        const match = status.match(/Found (\d+) matching posts/);
        if (match) {
            stats.postsFound += parseInt(match[1]);
            updateStats();
        }
    }
});

window.electron.onBotError((error) => {
    addLog(`ERROR: ${error}`, 'error');
    addStatus(`❌ ${error}`);
});

window.electron.onBotCommentPosted((data) => {
    stats.commentsPosted++;
    updateStats();
    addLog(`Comment posted: ${data.comment.substring(0, 50)}...`, 'success');
});

// Helper Functions
function getConfigFromForm() {
    const groups = Array.from(document.querySelectorAll('.group-url'))
        .map(input => input.value.trim())
        .filter(url => url);

    const keywords = keywordsInput.value
        .split(',')
        .map(k => k.trim())
        .filter(k => k);

    return {
        email: emailInput.value.trim(),
        password: passwordInput.value.trim(),
        groups: groups,
        keywords: keywords,
        comment: commentInput.value.trim(),
        checkInterval: parseInt(checkIntervalInput.value) * 1000
    };
}

function validateConfig(config) {
    return config.email &&
        config.password &&
        config.groups.length > 0 &&
        config.keywords.length > 0 &&
        config.comment;
}

function updateBotStatus(isRunning) {
    if (isRunning) {
        statusDot.classList.add('running');
        statusDot.classList.remove('stopped');
        statusText.textContent = 'Running';
    } else {
        statusDot.classList.add('stopped');
        statusDot.classList.remove('running');
        statusText.textContent = 'Stopped';
    }
}

function addStatus(message) {
    const entry = document.createElement('p');
    entry.className = 'status-entry';
    entry.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
    realTimeStatus.appendChild(entry);

    if (autoScrollCheckbox.checked) {
        realTimeStatus.scrollTop = realTimeStatus.scrollHeight;
    }
}

function addLog(message, type = 'info') {
    const logClasses = [`log-entry`, `log-${type}`];
    const entry = document.createElement('p');
    entry.className = logClasses.join(' ');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logsContainer.appendChild(entry);

    if (autoScrollCheckbox.checked) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
}

function showMessage(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type}`;
    
    if (type !== 'error') {
        setTimeout(() => {
            element.textContent = '';
            element.className = 'status-message';
        }, 3000);
    }
}

function updateStats() {
    commentsPosted.textContent = stats.commentsPosted;
    postsFound.textContent = stats.postsFound;
    lastCheck.textContent = stats.lastCheck || '--:--:--';
}

function startUptimeTimer() {
    const uptimeInterval = setInterval(() => {
        if (isBotRunning && botStartTime) {
            const elapsed = Math.floor((Date.now() - botStartTime) / 1000);
            const hours = Math.floor(elapsed / 3600).toString().padStart(2, '0');
            const minutes = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0');
            const seconds = (elapsed % 60).toString().padStart(2, '0');
            uptime.textContent = `${hours}:${minutes}:${seconds}`;
        } else {
            clearInterval(uptimeInterval);
            uptime.textContent = '00:00:00';
        }
    }, 1000);
}

// Initialize
(async () => {
    addLog('Application started', 'success');
    
    // Check initial bot status
    const status = await window.electron.getBotStatus();
    updateBotStatus(status.isRunning);
    
    if (status.isRunning) {
        startBotBtn.disabled = true;
        stopBotBtn.disabled = false;
        botStartTime = Date.now();
        startUptimeTimer();
    }
})();
