const API_BASE = window.location.origin; // Dynamically use the current origin

// State
let authToken = localStorage.getItem("token");
let userRole = localStorage.getItem("role");
let currentUsername = localStorage.getItem("username");
let guestMessageCount = parseInt(localStorage.getItem("guestCount") || "0");
let currentGuestAgent = "auto";
let chatSessions = JSON.parse(localStorage.getItem("chat_sessions") || "[]");
let currentSessionId = null;
let currentAgent = "auto";
// Molecular Synthesis State
let molScene, molCamera, molRenderer, molAnimationId;
let atomMeshes = [], bondMeshes = [], isSynthesizing = false, synthesisStartTime = 0;
const cpkColors = {
    'H': 0xffffff, 'C': 0x333333, 'O': 0xff0000, 'N': 0x0000ff, 
    'S': 0xffff00, 'P': 0xff8000, 'CL': 0x00ff00, 'BR': 0x8b0000, 
    'F': 0x00ff00, 'I': 0x9400d3, 'HE': 0xffc0cb, 'NE': 0xb3e3da, 
    'FE': 0xffa500, 'MG': 0x00ff00, 'CA': 0x808080, 'NA': 0x0000ff,
    'K': 0xff00ff, 'AL': 0xcccccc, 'SI': 0xdaa520, 'AU': 0xffd700,
    'AG': 0xc0c0c0, 'CU': 0xcd7f32, 'ZN': 0x7d80b0, 'PB': 0x57595d
};

function isLoggedIn() {
    return !!authToken && authToken !== 'null' && authToken !== 'undefined' && !!userRole;
}


// DOM Elements
const views = {
    'main-scroll': document.getElementById('main-scroll-view'),
    'guest-chat': document.getElementById('guest-chat-view'),
    'login': document.getElementById('login-view'),
    'register': document.getElementById('register-view'),
    'reset': document.getElementById('reset-view'),
    'chat': document.getElementById('chat-view'),
    'admin': document.getElementById('admin-view'),
    'molecular': document.getElementById('molecular-explorer-view'),
    'profile': document.getElementById('profile-view')
};
const toastEl = document.getElementById('toast');

// App Initialization
function init() {
    // Restore or set default theme
    const savedTheme = localStorage.getItem("theme") || "dark";
    changeTheme(savedTheme, false);

    // Always show home page on startup regardless of login state
    showView('main-scroll');

    if (isLoggedIn()) {
        document.getElementById('current-role-badge').innerText = userRole.toUpperCase();

        // Restore Profile Details
        const profUsername = document.getElementById('profile-username');
        if (profUsername) profUsername.innerText = currentUsername;
        const prefTheme = document.getElementById('pref-theme');
        if (prefTheme) prefTheme.value = localStorage.getItem("theme") || "dark";
        const prefAgent = document.getElementById('pref-agent');
        if (prefAgent) prefAgent.value = localStorage.getItem("prefAgent") || "auto";
    }
    updateNavHeader();
    renderConversationList();
}

function scrollToSection(sectionId) {
    const mainView = document.getElementById('main-scroll-view');
    if (mainView.classList.contains('hidden')) {
        showView('main-scroll');
    }
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function updateNavHeader() {
    if (isLoggedIn() && currentUsername) {
        document.getElementById("nav-unauth").classList.add("hidden");
        document.getElementById("nav-auth").classList.remove("hidden");
        document.getElementById("nav-user-display").innerText = currentUsername;

        // Update Profile Circle & Dropdown Header
        const iconEl = document.getElementById("nav-user-icon");
        if (iconEl) iconEl.innerText = currentUsername.charAt(0).toUpperCase();

        const dropName = document.getElementById("dropdown-user-name");
        if (dropName) dropName.innerText = currentUsername;

        const dropRole = document.getElementById("dropdown-user-role");
        if (dropRole) dropRole.innerText = userRole || "User";

        // Update Detailed Profile View
        const profName = document.getElementById("profile-username-val");
        if (profName) profName.innerText = currentUsername;

        const profRole = document.getElementById("profile-role-val");
        if (profRole) profRole.innerText = (userRole || "User").toUpperCase();
        document.getElementById("current-role-badge")?.classList.remove('hidden');
    } else {
        document.getElementById("nav-unauth").classList.remove("hidden");
        document.getElementById("nav-auth").classList.add("hidden");
        document.getElementById("current-role-badge")?.classList.add('hidden');
    }
}

// PROFILE SECTION NAVIGATION
function showProfileSection(section) {
    showView('profile');
    const main = document.getElementById('profile-section-main');
    const settings = document.getElementById('profile-section-settings');
    const title = document.getElementById('profile-title');
    const saveBtn = document.getElementById('profile-save-btn');

    if (section === 'profile') {
        main.classList.remove('hidden');
        settings.classList.add('hidden');
        title.innerText = "My Profile";
        saveBtn.classList.add('hidden'); // No need to save in readonly profile view
    } else {
        main.classList.add('hidden');
        settings.classList.remove('hidden');
        title.innerText = "Account Settings";
        saveBtn.classList.remove('hidden');
    }

    // Auto-close dropdown
    document.getElementById('profile-dropdown').classList.remove('show');
}


// Theme handling
function changeTheme(themeName, save = true) {
    document.documentElement.setAttribute('data-theme', themeName);
    if (save) localStorage.setItem('theme', themeName);

    const sel = document.getElementById('global-theme-select');
    if (sel) sel.value = themeName;
}

// UI Helpers
function showView(viewName) {
    // Security Guard: Prevent guests from entering authenticated views
    if (viewName === 'chat' || viewName === 'admin' || viewName === 'profile') {
        if (!isLoggedIn()) {
            console.warn("Unauthorized access attempt to " + viewName);
            showView('main-scroll');
            return;
        }
    }

    // TOGGLE NAVBAR: Molecular Explorer, Scientific Assistant, and Agents should feel like separate pages
    const standaloneViews = ['chat', 'guest-chat', 'molecular'];
    const navbar = document.querySelector('.app-navbar');
    if (navbar) {
        if (standaloneViews.includes(viewName)) {
            navbar.classList.add('navbar-hidden');
        } else {
            navbar.classList.remove('navbar-hidden');
        }
    }

    const targetId = viewName + '-view';

    // 1. Hide ALL views instantly
    Object.values(views).forEach(v => {
        if (!v) return;
        v.classList.add('hidden');
        v.classList.remove('active-view');
        // If it's the authenticated chat, explicitly hide the internal sidebar too
        if (v.id === 'chat-view') {
            const sidebar = v.querySelector('.chat-sidebar');
            if (sidebar) sidebar.style.display = 'none';
        }
    });

    // 2. Show the target view
    const target = views[viewName];
    if (target) {
        target.classList.remove('hidden');
        // Force a reflow for animations if needed
        void target.offsetWidth;
        target.classList.add('active-view');

        // 3. Special Case: Only show the sidebar if we are in 'chat' and logged in
        if (viewName === 'chat' && isLoggedIn()) {
            const sidebar = target.querySelector('.chat-sidebar');
            if (sidebar) sidebar.style.display = 'flex';
        }
    }
}

function showToast(msg, isError = false) {
    toastEl.textContent = msg;
    toastEl.className = `toast show ${isError ? 'error' : ''}`;
    setTimeout(() => toastEl.classList.remove('show'), 3000);
}

// --- NAVIGATION & PLATFORM ACCESS ---
function handleAccessPlatform() {
    scrollToSection('agents-hub-section');
}

function selectAgent(agentId, agentName) {
    if (!isLoggedIn()) {
        // Force clear guest history before switching
        const container = document.getElementById('guest-chat-history');
        if (container) container.innerHTML = '';
        localStorage.removeItem("guest_history");
    }

    if (isLoggedIn()) {
        openAuthenticatedAgent(agentId, agentName);
    } else {
        openGuestAgent(agentId, agentName);
    }
}

function openAuthenticatedAgent(agentId, agentName) {
    currentAgent = agentId;
    // Update Title with Symbol at the end for specialized agents
    const symbolMap = { 'CRA': '🧪', 'DDRA': '⚗️', 'DPEA': '📋', 'PDRA': '🔬' };
    const symbol = symbolMap[agentId];

    document.getElementById('chat-agent-label').innerText = symbol ? `${agentName} ${symbol}` : agentName;

    // Hide/Show the generic star icon
    const iconEl = document.getElementById('chat-agent-icon');
    if (iconEl) {
        iconEl.style.display = symbol ? 'none' : 'block';
        iconEl.innerText = '✦'; // Keep default for Orchestrator
    }

    const container = document.getElementById('chat-history');
    container.innerHTML = ''; // Force clear for fresh start as requested

    showView('chat');

    const welcome = agentId === 'auto' ? "Hi! I am the Scientific AI Assistant. How can I assist with your research today?" : `Hi! I am the ${agentName}. How can I assist with your domain-specific inquiry today?`;
    appendMessageToContainer(welcome, 'system', container, null, false);

    // Start a fresh session tracking
    currentSessionId = 'sess_' + Date.now();
    renderConversationList();
}

function openGeneralChat() {
    if (isLoggedIn()) {
        openAuthenticatedAgent('auto', 'Scientific AI Assistant');
    } else {
        openGuestAgent('auto', 'Scientific AI Assistant');
    }
}

// --- SESSION & HISTORY MANAGEMENT ---
function startNewChat(archiveCurrent = true) {
    if (isLoggedIn()) {
        const container = document.getElementById('chat-history');

        // Archive currently active chat if it has content
        if (archiveCurrent && currentSessionId && container.children.length > 0) {
            saveCurrentSession();
        }

        // Clear UI
        container.innerHTML = '';
        currentSessionId = 'sess_' + Date.now();

        // Re-add specialized greeting
        const agentName = document.getElementById('chat-agent-label').innerText;
        const welcome = currentAgent === 'auto' ? "Hi! I am the Scientific AI Assistant. How can I assist with your research today?" : `Hi! I am the ${agentName}. How can I assist with your domain-specific inquiry today?`;
        appendMessageToContainer(welcome, 'system', container, null, false);

        renderConversationList();
    } else {
        // Guest Mode Logic
        const container = document.getElementById('guest-chat-history');
        if (container) {
            container.innerHTML = '';
            guestMessageCount = 0;
            localStorage.setItem("guestCount", "0");
            localStorage.removeItem("guest_history");

            const guestCountEl = document.getElementById("guest-count");
            if (guestCountEl) guestCountEl.innerText = "0";

            // Re-add specialized greeting
            const fullTitle = document.getElementById("guest-agent-title").innerText;
            const agentName = fullTitle.includes(' (') ? fullTitle.split(' (')[0] : fullTitle;
            const welcome = currentGuestAgent === 'auto' ? "Hi! I am the Scientific AI Assistant. How can I assist with your research today?" : `Hi! I am the ${agentName}. How can I assist with your domain-specific inquiry today?`;
            appendMessageToContainer(welcome, 'system', container, null, false);
        }
    }
}

function saveCurrentSession() {
    const historyContainer = document.getElementById('chat-history');
    if (historyContainer.children.length === 0) return;

    const firstMsg = historyContainer.querySelector('.msg-bubble')?.innerText || "New Exploration";
    const title = firstMsg.split(' ').slice(0, 5).join(' ') + '...';

    const session = {
        id: currentSessionId,
        title: title,
        agent: currentAgent,
        timestamp: new Date().toLocaleString(),
        html: historyContainer.innerHTML
    };

    // Remove if already exists (update)
    chatSessions = chatSessions.filter(s => s.id !== currentSessionId);
    chatSessions.unshift(session);

    if (chatSessions.length > 50) chatSessions.pop(); // Cap history
    localStorage.setItem("chat_sessions", JSON.stringify(chatSessions));
    renderConversationList();
}

function loadSession(id) {
    const session = chatSessions.find(s => s.id === id);
    if (!session) return;

    // Save current before switching
    saveCurrentSession();

    currentSessionId = session.id;
    currentAgent = session.agent;
    document.getElementById('chat-agent-label').innerText = session.agent;
    document.getElementById('chat-history').innerHTML = session.html;

    showView('chat');
    renderConversationList();
}

function renderConversationList() {
    const list = document.getElementById('conversation-list');
    if (!list) return;

    list.innerHTML = '';
    chatSessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
        item.innerHTML = `<i>📄</i> <span>${session.title}</span>`;
        item.onclick = () => loadSession(session.id);
        list.appendChild(item);
    });
}

// Global Nav Handlers
// Profile Dropdown Toggle
document.addEventListener('click', (e) => {
    const trigger = document.getElementById('profile-trigger');
    const dropdown = document.getElementById('profile-dropdown');

    if (trigger && trigger.contains(e.target)) {
        dropdown.classList.toggle('show');
    } else if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('show');
    }
});

document.getElementById('nav-logout-btn').addEventListener('click', logout);
function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("username");
    localStorage.removeItem("guest_history");
    authToken = null; userRole = null; currentUsername = null;
    guestMessageCount = 0;
    localStorage.setItem("guestCount", "0");
    changeTheme("dark");
    updateNavHeader();
    showView('main-scroll');
    showToast("Logout successful");
    loadGuestHistory();
}

function openGuestAgent(agentId, agentName) {
    currentGuestAgent = agentId;

    const symbolMap = { 'CRA': '🧪', 'DDRA': '⚗️', 'DPEA': '📋', 'PDRA': '🔬' };
    const symbol = symbolMap[agentId];
    const fullTitle = symbol ? `${agentName} (${agentId}) ${symbol}` : agentName;

    document.getElementById("guest-agent-title").innerText = fullTitle;

    const iconEl = document.getElementById('guest-agent-icon');
    if (iconEl) {
        iconEl.style.display = symbol ? 'none' : 'block';
        iconEl.innerText = '✦';
    }

    // Total isolation: Clear DOM and storage on every entry
    const container = document.getElementById('guest-chat-history');
    if (container) container.innerHTML = '';
    localStorage.removeItem("guest_history");
    localStorage.removeItem("guestCount");

    showView('guest-chat');
    const welcome = agentId === 'auto' ? "Hi! I am the Scientific AI Assistant. How can I assist with your research today?" : `Hi! I am the ${agentName}. How can I assist with your domain-specific inquiry today?`;
    appendMessageToContainer(welcome, 'system', container, null, false);
}


// --- LOGIN LOGIC ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    btn.innerHTML = `<span class="spinner"></span> Authenticating...`;

    const payload = {
        username: document.getElementById('login-username').value,
        password: document.getElementById('login-password').value,
        role: document.getElementById('login-role').value
    };

    try {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.detail || 'Login failed');

        authToken = data.access_token;
        userRole = data.role;
        currentUsername = payload.username;
        localStorage.setItem("token", authToken);
        localStorage.setItem("role", userRole);
        localStorage.setItem("username", currentUsername);
        localStorage.setItem("prefAgent", "auto"); // Default on first login

        // Auto-switch to role-specific theme
        changeTheme(userRole);
        updateNavHeader();

        // Center-aligned "Login successful" message
        const successDiv = document.createElement('div');
        successDiv.style.cssText = "position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; text-align: center; pointer-events: none;";
        successDiv.innerHTML = `<div class="glass" style="padding: 20px 40px; border: 2px solid var(--success); background: rgba(0,0,0,0.85); box-shadow: 0 0 25px rgba(0,230,118,0.3); animation: slideIn 0.4s easeOut;">
            <h1 style="color: var(--success); margin: 0; font-size: 1.5rem; font-weight: 700;">Login successful</h1>
        </div>`;
        document.body.appendChild(successDiv);
        setTimeout(() => {
            successDiv.style.opacity = '0';
            successDiv.style.transition = 'opacity 0.6s ease';
            setTimeout(() => successDiv.remove(), 600);
        }, 2000);

        document.getElementById('current-role-badge').innerText = userRole.toUpperCase();

        btn.innerHTML = `<span>Authenticate</span>`;
        showView('main-scroll');
        if (userRole === 'admin') fetchPendingApprovals();
        else loadChatHistory();
    } catch (err) {
        btn.innerHTML = `<span>Authenticate</span>`;
        showToast(err.message, true);
    }
});


// --- REGISTER LOGIC ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reg-btn');
    btn.innerHTML = `<span class="spinner"></span> Working...`;

    const payload = {
        username: document.getElementById('reg-username').value,
        password: document.getElementById('reg-password').value,
        role: document.getElementById('reg-role').value
    };

    try {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed');

        showToast("Registration successful! You may now log in.");
        setTimeout(() => {
            document.getElementById('login-username').value = payload.username;
            document.getElementById('login-role').value = payload.role;
            btn.innerHTML = `<span>Register</span>`;
            showView('login');
        }, 1500);
    } catch (err) {
        btn.innerHTML = `<span>Register</span>`;
        showToast(err.message, true);
    }
});

// --- RESET PASSWORD LOGIC ---
document.getElementById('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('res-btn');
    btn.innerHTML = `<span class="spinner"></span> Working...`;

    const payload = {
        username: document.getElementById('res-username').value,
        password: document.getElementById('res-password').value,
        role: document.getElementById('res-role').value
    };

    try {
        const res = await fetch(`${API_BASE}/auth/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Reset failed');

        showToast("Password updated successfully!");
        setTimeout(() => {
            btn.innerHTML = `<span>Reset Password</span>`;
            showView('login');
        }, 1500);
    } catch (err) {
        btn.innerHTML = `<span>Reset Password</span>`;
        showToast(err.message, true);
    }
});


// --- SHARED CHAT LOGIC ---

function appendMessageToContainer(text, sender, container, storageKey = null, save = true) {
    const id = `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const div = document.createElement('div');
    div.id = id;
    div.className = `message ${sender === 'user' ? 'user-msg' : 'system-msg'}`;

    // Determine Agent Name for Avatar
    let avatarLabel = 'AI';
    if (sender !== 'user') {
        const activeAgent = (container.id === 'guest-chat-history') ? currentGuestAgent : currentAgent;
        if (['CRA', 'DDRA', 'DPEA', 'PDRA'].includes(activeAgent)) {
            avatarLabel = activeAgent;
        }
    }

    div.innerHTML = `
        <div class="msg-avatar">${sender === 'user' ? 'U' : avatarLabel}</div>
        <div class="msg-bubble">${text}</div>
    `;
    container.appendChild(div);
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });

    if (save && storageKey) {
        const savedArr = JSON.parse(localStorage.getItem(storageKey) || "[]");
        savedArr.push({ text, sender });
        localStorage.setItem(storageKey, JSON.stringify(savedArr));
    }
    return id;
}


// --- GUEST QUERY LOGIC ---
document.getElementById('guest-query-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!authToken && guestMessageCount >= 10) {
        showToast("Guest limit of 10 messages reached! Please Login or Register to continue.", true);
        setTimeout(() => showView('login'), 2000);
        return;
    }

    const input = document.getElementById('guest-query-input');
    const query = input.value.trim();
    if (!query) return;

    if (!isLoggedIn()) {
        guestMessageCount++;
        localStorage.setItem("guestCount", guestMessageCount);
    }

    const container = document.getElementById("guest-chat-history");
    appendMessageToContainer(query, 'user', container, null, false);
    input.value = '';

    const loadId = appendMessageToContainer("Processing request via Agent...", 'system', container, null, false);

    try {
        const res = await fetch(`${API_BASE}/query/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: query, agent: currentGuestAgent })
        });
        const data = await res.json();
        document.getElementById(loadId).remove();

        if (!res.ok) {
            appendMessageToContainer(`❌ Error: ${data.detail || 'Query failed'}`, 'system', container, null, false);
            return;
        }

        let agent = data.agent_used || "orchestrator";
        let formatted = agent === 'orchestrator' ? '' : `<span class="agent-badge">${agent}</span><br/>`;
        formatted += formatAgentData(agent, data.result || {});
        appendMessageToContainer(formatted, 'system', container, null, false);

    } catch (err) {
        document.getElementById(loadId)?.remove();
        appendMessageToContainer(`❌ Error: ${err.message}`, 'system', container, null, false);
    }
});

function loadGuestHistory() {
    const container = document.getElementById('guest-chat-history');
    container.innerHTML = '';
    const saved = localStorage.getItem("guest_history");
    if (saved) {
        JSON.parse(saved).forEach(m => appendMessageToContainer(m.text, m.sender, container, null, false));
    }
}


// --- AUTHENTICATED/ROLE QUERY LOGIC ---
document.getElementById('query-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const container = document.getElementById("chat-history");
    const userMessages = Array.from(container.children).filter(msg => msg.classList.contains('user-msg')).length;

    if (userMessages >= 50) {
        showToast("Session limit of 50 messages reached! Please start a 'New Chat' in the sidebar to continue.", true);
        return;
    }

    const input = document.getElementById('query-input');
    const query = input.value.trim();
    if (!query) return;

    const historyKey = `history_${currentUsername}_${userRole}`;

    appendMessageToContainer(query, 'user', container, historyKey, true);
    input.value = '';

    const loadId = appendMessageToContainer("Orchestrating agents and analyzing...", 'system', container, null, false);

    try {
        const res = await fetch(`${API_BASE}/query/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ query: query, agent: currentAgent })
        });

        if (res.status === 401 || res.status === 403) throw new Error("Session expired. Please log in again.");

        const data = await res.json();
        document.getElementById(loadId).remove();

        if (!res.ok) {
            appendMessageToContainer(`❌ Error: ${data.detail || 'Query failed'}`, 'system', container, historyKey, true);
            return;
        }

        if (data.flagged_high_risk) {
            appendMessageToContainer(`⚠️ <b>High Risk Flagged</b><br/>${data.message}<br/><br/><i>Reason: ${data.result?.risk_reason || 'Unknown reason'}</i>`, 'system', container, historyKey, true);
        } else {
            let agent = data.agent_used || "orchestrator";
            let formatted = agent === 'orchestrator' ? '' : `<span class="agent-badge">${agent}</span><br/>`;
            formatted += formatAgentData(agent, data.result || {});
            appendMessageToContainer(formatted, 'system', container, historyKey, true);
        }
    } catch (err) {
        document.getElementById(loadId)?.remove();
        appendMessageToContainer(`❌ Error: ${err.message}`, 'system', container, null, false);
        if (err.message.includes("Session")) logout();
    }
});

function loadChatHistory() {
    const container = document.getElementById('chat-history');
    container.innerHTML = '';
    const historyKey = `history_${currentUsername}_${userRole}`;
    const saved = localStorage.getItem(historyKey);

    if (saved) {
        JSON.parse(saved).forEach(m => appendMessageToContainer(m.text, m.sender, container, null, false));
    } else {
        appendMessageToContainer("Assistant standing by. Please enter a research query or clinical topic.", "system", container, null, false);
    }
}

function scientificRender(text) {
    if (!text) return "";
    // 1. Strip LaTeX artifacts ($ and _ and {})
    let clean = text.replace(/\$/g, '').replace(/\_/g, '').replace(/\{/g, '').replace(/\}/g, '');

    // 2. Bold headers and bullet points (Markdown-ish support)
    clean = clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\n/g, "<br/>");

    // 3. APPLY SUBSCRIPTS: Find letters followed by numbers (Chemical Patterns)
    // We target common chemical symbols [A-Z][a-z]? followed by digits
    return clean.replace(/([A-Z][a-z]?)(\d+)/g, '$1<sub>$2</sub>');
}

function formatScientificFormula(formula) {
    return scientificRender(formula) || "---";
}

// FORMATTER FOR HUMAN-READABLE OUTPUTS
function formatAgentData(agent, result) {
    let html = `<div style="margin-top: 15px;">`;

    // Safety check for missing result
    if (!result) result = { summary: "Analysis complete, but no details were returned." };

    const summaryFormatted = scientificRender(result.summary || "No summary provided.");

    // Global Simple Rendering for Conversational/Out-of-Domain responses
    if (result.is_conversational || result.is_out_of_domain) {
        return html + `<div style="padding: 10px; line-height: 1.8; font-size: 1.4rem; color: var(--text-main);">${summaryFormatted}</div></div>`;
    }

    if (agent === "DPEA") {
        let decision = result.prescription_decision || "Refer to details";
        let uses = result.drug_indications?.indications?.map(i => i.indication).join(", ") || "General medical use";

        html += `
            <div style="background: var(--surface-bg); padding: 25px; border-radius: 12px; border-left: 4px solid var(--accent); margin-top: 15px;">
                <h3 style="margin-bottom: 15px; color: var(--secondary); font-size: 1.4rem;">🩺 Clinical Assessment: ${result.drug_name ? result.drug_name.toUpperCase() : 'Prescription Inquiry'}</h3>
                <p style="margin-bottom: 12px; font-size: 1.4rem;"><strong>Decision:</strong> <span style="color: var(--accent); font-weight: 700;">${decision}</span></p>
                <div style="line-height: 1.8; font-size: 1.4rem; color: var(--text-main);">${summaryFormatted}</div>
                
                <h4 style="margin-top: 20px; color: var(--text-muted); font-size: 1.4rem;">💊 Relevant Clinical Context</h4>
                <p style="font-size: 1.4rem; opacity: 0.9;"><strong>Indications:</strong> ${uses}</p>
                <ul style="margin-left: 20px; margin-top: 10px; font-size: 1.4rem; opacity: 0.9;">
                    ${result.drug_drug_interactions ? result.drug_drug_interactions.map(i => `<li>${i}</li>`).join('') : '<li>No major interactions noted in primary datasets.</li>'}
                </ul>
            </div>
        `;
    } else if (agent === "CRA") {
        html += `
            <div style="background: var(--surface-bg); padding: 25px; border-radius: 12px; border-left: 4px solid var(--secondary); margin-top: 15px;">
                <h3 style="margin-bottom: 15px; color: var(--accent); font-size: 1.4rem;">🧪 Chemical Research: ${result.compound_name || 'Target Compound'}</h3>
                <div style="line-height: 1.8; font-size: 1.4rem; color: var(--text-main);">${summaryFormatted}</div>
            </div>
        `;
    } else if (agent === "DDRA") {
        let score = result.feasibility_score ? Math.round(result.feasibility_score * 100) : "N/A";
        html += `
            <div style="background: var(--surface-bg); padding: 25px; border-radius: 12px; border-left: 4px solid #00e5ff; margin-top: 15px;">
                <h3 style="margin-bottom: 15px; color: var(--accent); font-size: 1.4rem;">⚗️ Drug Discovery: ${result.compound_name || 'Candidate'}</h3>
                <p style="margin-bottom: 10px; font-size: 1.4rem;"><strong>Feasibility Score:</strong> ${score}%</p>
                <div style="line-height: 1.8; font-size: 1.4rem; color: var(--text-main);">${summaryFormatted}</div>
            </div>
        `;
    } else if (agent === "orchestrator") {
        html += `
            <div style="background: var(--surface-bg); padding: 25px; border-radius: 12px; border-left: 4px solid var(--accent); margin-top: 15px;">
                <h3 style="margin-bottom: 15px; color: var(--secondary); font-size: 1.4rem;">🔬 Research Narrative: ${result.compound_name ? result.compound_name.toUpperCase() : 'Integrated Study'}</h3>
                <div style="line-height: 1.8; font-size: 1.4rem; color: var(--text-main);">${summaryFormatted}</div>
            </div>`;
    } else {
        html += `<pre class="obj-view" style="margin-top:15px; background: var(--surface-bg); color: var(--text-main); padding: 15px; border-radius: 8px;">${JSON.stringify(result, null, 2)}</pre>`;
    }

    html += `</div>`;
    return html;
}

// --- ADMIN LOGIC ---
async function fetchPendingApprovals() {
    const grid = document.getElementById('approvals-grid');
    grid.innerHTML = '<p>Loading pending reviews...</p>';
    try {
        const res = await fetch(`${API_BASE}/admin/approvals`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error('Unauthorized');
        const tasks = await res.json();

        if (tasks.length === 0) {
            grid.innerHTML = '<p style="color:var(--success);">✅ All systems clear. No pending safety violations.</p>';
            return;
        }

        grid.innerHTML = tasks.map(t => `
            <div class="approval-card glass" id="task-${t.approval_id}">
                <div class="risk-badge">HIGH RISK DETECTED</div>
                <div class="ap-query">Query: "${t.query}"</div>
                <div class="ap-reason">Reason: ${t.risk_reason}</div>
                <div class="ap-actions">
                    <button class="btn btn-approve" onclick="resolveTask('${t.approval_id}', true)">Approve Release</button>
                    <button class="btn btn-reject" onclick="resolveTask('${t.approval_id}', false)">Reject & Block</button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = `<p style="color:var(--danger)">Error: ${err.message}</p>`;
    }
}

async function resolveTask(id, approved) {
    try {
        const res = await fetch(`${API_BASE}/admin/approve`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ approval_id: id, approved: approved })
        });
        if (!res.ok) throw new Error('Action failed');

        showToast(approved ? "Output Approved & Released" : "Output Rejected & Blocked", !approved);
        document.getElementById(`task-${id}`).remove();
    } catch (err) {
        showToast(err.message, true);
    }
}

// --- 4-SECTION EXPLORER CONTROLLER ---
let currentExplorerSection = 'atoms';

function toggleMolecularSearch() {
    console.log("Opening Explorer...");
    showView('molecular');
    // Always trigger a switch to the current or default section to ensure JS initialization runs
    switchExplorerSection(currentExplorerSection || 'atoms');
}

function switchExplorerSection(sectionId) {
    console.log("Switching Explorer to:", sectionId);
    currentExplorerSection = sectionId;

    // 1. Update Tab Buttons
    const tabs = ['atoms', 'molecules', 'periodic'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-${tab}`);
        if (btn) {
            if (tab === sectionId) btn.classList.add('active');
            else btn.classList.remove('active');
        }
    });

    // 2. Update Content Containers
    const containers = {
        'atoms': 'aa-atoms-container',
        'molecules': 'aa-molecules-container',
        'periodic': 'aa-periodic-container'
    };

    const actualContainers = ['aa-atoms-container', 'aa-molecules-container', 'aa-periodic-container'];
    actualContainers.forEach(contId => {
        const cont = document.getElementById(contId);
        if (cont) {
            if (contId === `aa-${sectionId}-container`) {
                cont.classList.remove('hidden');
                cont.classList.add('active-section');
            } else {
                cont.classList.add('hidden');
                cont.classList.remove('active-section');
            }
        }
    });

    // 3. Trigger Module Initializations
    if (sectionId === 'atoms') {
        initAtomsModule();
    } else if (sectionId === 'molecules') {
        initMoleculesModule();
    } else if (sectionId === 'periodic') {
        initPeriodicTable();
    }
}

// --- PERIODIC TABLE MODULE: DATA & GENERATION ---
function initPeriodicTable() {
    const grid = document.getElementById("periodic-table-grid");
    if (!grid || grid.children.length > 0) return; // Prevent double render

    grid.innerHTML = '';

    // Position Map Helper for 18-Column IUPAC Layout
    function getElementPosition(atNum) {
        const n = parseInt(atNum);
        if (n === 1) return { r: 1, c: 1 };
        if (n === 2) return { r: 1, c: 18 };
        if (n >= 3 && n <= 4) return { r: 2, c: n - 2 };
        if (n >= 5 && n <= 10) return { r: 2, c: n + 8 };
        if (n >= 11 && n <= 12) return { r: 3, c: n - 10 };
        if (n >= 13 && n <= 18) return { r: 3, c: n };
        if (n >= 19 && n <= 36) return { r: 4, c: n - 18 };
        if (n >= 37 && n <= 54) return { r: 5, c: n - 36 };
        if (n >= 55 && n <= 56) return { r: 6, c: n - 54 };
        if (n >= 57 && n <= 71) return { r: 9, c: n - 53 }; // Lanthanides breakout
        if (n >= 72 && n <= 86) return { r: 6, c: n - 68 };
        if (n >= 87 && n <= 88) return { r: 7, c: n - 86 };
        if (n >= 89 && n <= 103) return { r: 10, c: n - 85 }; // Actinides breakout
        if (n >= 104 && n <= 118) return { r: 7, c: n - 100 };
        return { r: 1, c: 1 };
    }

    const sortedEntries = Object.entries(atomicData).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

    sortedEntries.forEach(([atNum, data]) => {
        const pos = getElementPosition(atNum);
        const cell = document.createElement("div");
        cell.className = "aa-periodic-element glass";
        cell.style.gridRow = pos.r;
        cell.style.gridColumn = pos.c;

        // Series Coloring Logic
        let seriesColor = "#33b5e5"; // Default Non-metals
        const n = parseInt(atNum);
        if ([1, 3, 11, 19, 37, 55, 87].includes(n)) seriesColor = "#ff4444"; // Alkali
        else if ([4, 12, 20, 38, 56, 88].includes(n)) seriesColor = "#ff8800"; // Alkaline earth
        else if ((n >= 21 && n <= 30) || (n >= 39 && n <= 48) || (n >= 72 && n <= 80) || (n >= 104 && n <= 112)) seriesColor = "#ffbb33"; // Transition
        else if ([2, 10, 18, 36, 54, 86, 118].includes(n)) seriesColor = "#00C851"; // Noble Gas
        else if (n >= 57 && n <= 71) seriesColor = "#aa66cc"; // Lanthanides
        else if (n >= 89 && n <= 103) seriesColor = "#0099cc"; // Actinides

        cell.style.setProperty("--series-color", seriesColor);
        cell.innerHTML = `
            <div class="at-num">${atNum}</div>
            <div class="at-sym" style="color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);">${data.symbol}</div>
            <div class="at-name">${data.name}</div>
        `;

        cell.onclick = () => {
            showElementFlashcard(atNum, seriesColor);
            // window.scrollTo({ top: 0, behavior: 'smooth' }); // Stay at the card
        };

        grid.appendChild(cell);
    });
}

function closeElementPanel() {
    const deck = document.getElementById('aa-periodic-observation-deck');
    if (deck) {
        deck.classList.remove('visible');
        setTimeout(() => deck.classList.add('hidden'), 500);
    }
}


async function showElementFlashcard(atNum, seriesColor) {
    const data = atomicData[atNum];
    if (!data) return;

    const deck = document.getElementById('aa-periodic-observation-deck');
    const flashcard = document.getElementById('aa-element-flashcard');
    if (!deck || !flashcard) return;

    // Derived Research Data
    const shells = data.shells || [];
    const valency = shells.length > 0 ? shells[shells.length - 1] : "N/A";

    let block = 's-block';
    const n = parseInt(atNum);
    if (n > 12 && n < 19) block = 'p-block';
    else if (n > 20 && n < 31) block = 'd-block';
    else if (n > 56 && n < 72) block = 'f-block';

    const en = data.en || (2.0 + Math.random() * 0.5).toFixed(2);
    const radius = data.radius || (100 + Math.random() * 50).toFixed(0);
    const state = data.state || (n > 90 ? "Solid (Synth)" : "Solid");

    // SET SKELETON STATE
    flashcard.innerHTML = `
        <button class="panel-close-btn" onclick="closeElementPanel()">×</button>
        <div class="flash-id-block">
            <div class="flash-at-num">${atNum}</div>
            <div class="flash-at-sym">${data.symbol}</div>
            <div class="flash-at-name">${data.name}</div>
        </div>

        <div class="flash-research-brief">
            <span class="brief-label">Details</span>
            <p class="brief-text" style="color: var(--text-muted); opacity: 0.6;">
                <span class="spinner-small" style="display: inline-block; vertical-align: middle; margin-right: 10px;"></span>
                Analyzing Research Dossier...
            </p>
        </div>

        <div class="flash-details">
            <div class="flash-data-grid">
                <div class="data-field">
                    <span class="data-label">Electronegativity</span>
                    <span class="data-val">${en} χ</span>
                </div>
                <div class="data-field">
                    <span class="data-label">Atomic Radius</span>
                    <span class="data-val">${radius} pm</span>
                </div>
                <div class="data-field">
                    <span class="data-label">Valence Shell</span>
                    <span class="data-val">${valency} e⁻</span>
                </div>
                <div class="data-field">
                    <span class="data-label">Base State</span>
                    <span class="data-val">${state}</span>
                </div>
                <div class="data-field">
                    <span class="data-label">Orbital Block</span>
                    <span class="data-val">${block}</span>
                </div>
            </div>
            <div class="flash-category" style="color: ${seriesColor};">
                Family: ${seriesColor === '#ff4444' ? 'Alkali Metal' : (seriesColor === '#00C851' ? 'Noble Gas' : 'Research Grade Element')}
            </div>
        </div>
    `;

    deck.classList.remove('hidden');
    void deck.offsetWidth;
    deck.classList.add('visible');
    flashcard.style.borderColor = seriesColor;

    // FETCH REAL-TIME AI INSIGHT
    try {
        const response = await fetch(`${API_BASE}/query/element-insight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `Analyze element ${data.name} with atomic number ${atNum}`,
                agent: "auto"
            })
        });
        const result = await response.json();
        const briefTextEl = flashcard.querySelector('.brief-text');
        if (briefTextEl && result.insight) {
            briefTextEl.style.opacity = "1";
            briefTextEl.style.color = "var(--text-main)";
            briefTextEl.innerHTML = result.insight;
        }
    } catch (err) {
        const briefTextEl = flashcard.querySelector('.brief-text');
        if (briefTextEl) briefTextEl.innerHTML = "Synthesis engine offline. Using local cached data.";
    }
}

// --- MOLECULES MODULE: RESEARCH ENGINE & VISUALIZER ---
let explorer3dViewer = null;

// --- MOLECULAR EXPLORER: THREE.JS UNIVERSAL SYNTHESIS ENGINE ---

function initMoleculesModule() {
    const container = document.getElementById('aa-mol-synthesis-viewport');
    if (!container || molRenderer) return;

    molScene = new THREE.Scene();
    molCamera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
    molCamera.position.z = 15;

    molRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    molRenderer.setSize(container.clientWidth, container.clientHeight);
    molRenderer.setPixelRatio(window.devicePixelRatio);
    container.innerHTML = ""; // Clear placeholder
    container.appendChild(molRenderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    molScene.add(ambientLight);

    const p1 = new THREE.PointLight(0xffffff, 1.2);
    p1.position.set(20, 20, 20);
    molScene.add(p1);

    animateMolecules();

    window.addEventListener('resize', () => {
        if (!molRenderer || !container) return;
        molCamera.aspect = container.clientWidth / container.clientHeight;
        molCamera.updateProjectionMatrix();
        molRenderer.setSize(container.clientWidth, container.clientHeight);
    });
}

function formatScientificFormula(formula) {
    if (!formula) return "---";
    // Regex for numbers to be subscripts
    return formula.replace(/(\d+)/g, '<sub>$1</sub>');
}

async function searchAndSynthesize() {
    const input = document.getElementById("aa-mol-synthesis-search");
    const query = input.value.trim();
    if (!query) return;

    const details = document.getElementById("aa-mol-details-panel");
    const loader = document.getElementById("aa-mol-loading-synth");

    details.classList.add("hidden");
    loader.classList.remove("hidden");
    isSynthesizing = false;

    try {
        // 1. Identify CID (Robust search)
        showToast("Identifying molecular identity...");
        const cidRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`);
        const cidData = await cidRes.json();

        if (!cidData.IdentifierList || !cidData.IdentifierList.CID) {
            throw new Error(`Identity resolution failed for '${query}'.`);
        }
        const cid = cidData.IdentifierList.CID[0];
        console.log(`Dynamic Discovery: CID ${cid} resolved.`);

        // 2. Fetch Properties & 3D Coordinates (Unified)
        showToast(`Resolving CID ${cid} structural records...`);
        
        // Parallel fetch for speed
        const [propRes, sdfRes] = await Promise.all([
            fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,IUPACName,MolecularWeight/JSON`),
            fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`)
        ]);

        const propData = await propRes.json();
        const props = propData.PropertyTable.Properties[0];
        
        let sdfText = await sdfRes.text();

        // Fallback: If 3D coordinates are strictly unavailable, try 2D record
        if (!sdfText.includes("V2000")) {
            console.warn("3D record missing. Attempting 2D projection...");
            const sdf2dRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF`);
            sdfText = await sdf2dRes.text();
            if (!sdfText.includes("V2000")) throw new Error("No structural records available for this compound.");
        }

        const data = parseSDFForSynthesis(sdfText);
        if (data.atoms.length === 0) throw new Error("Structural data parse failure.");

        // Update UI
        document.getElementById("aa-mol-common-name").innerText = query;
        document.getElementById("aa-mol-iupac-name").innerText = props.IUPACName || query.toUpperCase();
        document.getElementById("aa-mol-formula-display").innerHTML = formatScientificFormula(props.MolecularFormula);
        
        // Prepare Scene
        spawnCinematicAtoms(data);

        loader.classList.add("hidden");
        details.classList.remove("hidden");
        showToast(`Discovery Successful: ${data.atoms.length} atoms mapped.`);

    } catch (err) {
        console.error("Synthesis Search Error:", err);
        loader.classList.add("hidden");
        showToast(err.message, true);
    }
}

function parseSDFForSynthesis(sdf) {
    const lines = sdf.split("\n");
    const atoms = [];
    const bonds = [];
    let atomCount = 0;
    let bondCount = 0;

    // Line 4 usually contains the counts
    const line4 = lines[3];
    atomCount = parseInt(line4.substring(0, 3).trim());
    bondCount = parseInt(line4.substring(3, 6).trim());

    // Atoms block
    for (let i = 4; i < 4 + atomCount; i++) {
        const line = lines[i];
        const x = parseFloat(line.substring(0, 10));
        const y = parseFloat(line.substring(10, 20));
        const z = parseFloat(line.substring(20, 30));
        const sym = line.substring(31, 34).trim().toUpperCase();
        atoms.push({ x, y, z, sym });
    }

    // Bonds block
    for (let i = 4 + atomCount; i < 4 + atomCount + bondCount; i++) {
        const line = lines[i];
        const a1 = parseInt(line.substring(0, 3).trim()) - 1;
        const a2 = parseInt(line.substring(3, 6).trim()) - 1;
        const type = parseInt(line.substring(6, 9).trim());
        bonds.push({ a1, a2, type });
    }

    return { atoms, bonds };
}

function createAtomLabel(text, radius) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 128; canvas.height = 128;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 90px Inter, Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    // Scale label based on atom radius (approx 1.8x the radius works best for centering)
    const labelScale = radius * 1.8;
    sprite.scale.set(labelScale, labelScale, 1);
    return sprite;
}

function spawnCinematicAtoms(data) {
    const atoms = data.atoms;
    const bonds = data.bonds;

    // Clear old meshes
    atomMeshes.forEach(m => molScene.remove(m));
    bondMeshes.forEach(m => molScene.remove(m));
    atomMeshes = [];
    bondMeshes = [];
    isSynthesizing = false;

    // Calculate center for normalization
    let avgX = 0, avgY = 0, avgZ = 0;
    atoms.forEach(a => { avgX += a.x; avgY += a.y; avgZ += a.z; });
    avgX /= atoms.length; avgY /= atoms.length; avgZ /= atoms.length;

    // Target positions (Increased scale to 1.3 for clear "Ball and Stick" spacing)
    const targetPositions = atoms.map(a => new THREE.Vector3((a.x - avgX) * 1.3, (a.y - avgY) * 1.3, (a.z - avgZ) * 1.3));

    // 1. Spawn Atoms in Standard Spaced Positions
    atoms.forEach((data, index) => {
        const color = cpkColors[data.sym] || 0xcccccc;
        const radius = data.sym === 'H' ? 0.4 : 0.75; // Smaller "Balls"

        const geometry = new THREE.SphereGeometry(radius, 32, 32);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.2,
            metalness: 0.3,
            emissive: color,
            emissiveIntensity: 0.1
        });
        const sphere = new THREE.Mesh(geometry, material);

        // Random scatter position
        sphere.position.set((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30);
        sphere.userData = { target: targetPositions[index], sym: data.sym };

        // Add label (C, H, O, etc) - Now scaled to the sphere radius
        const label = createAtomLabel(data.sym, radius);
        sphere.add(label);

        molScene.add(sphere);
        atomMeshes.push(sphere);
    });

    // 2. Prepare Bonds (Hidden)
    bonds.forEach((bond, index) => {
        const geometry = new THREE.CylinderGeometry(0.12, 0.12, 1, 12);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff, // Brilliant White
            emissive: 0xffffff,
            emissiveIntensity: 0.6, // Strong visibility
            metalness: 1.0,
            roughness: 0
        });
        const cylinder = new THREE.Mesh(geometry, material);
        cylinder.visible = false;
        cylinder.userData = { a1: bond.a1, a2: bond.a2, order: index };
        molScene.add(cylinder);
        bondMeshes.push(cylinder);
    });

    const maxDist = Math.max(...atoms.map(a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z)));
    molCamera.position.z = Math.max(15, maxDist * 3);
}

function triggerSynthesisAnimationByUI() {
    isSynthesizing = true;
    synthesisStartTime = Date.now();
    showToast("Commencing synthesis merge...");
}

function updateBonds() {
    const elapsed = Date.now() - synthesisStartTime;
    const bondInterval = 300; // 0.3s between bonds

    bondMeshes.forEach(mesh => {
        const a1 = atomMeshes[mesh.userData.a1];
        const a2 = atomMeshes[mesh.userData.a2];
        if (!a1 || !a2) return;

        const p1 = a1.position;
        const p2 = a2.position;

        // Position & Rotate cylinder
        mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
        const direction = new THREE.Vector3().subVectors(p2, p1);
        mesh.scale.set(1, direction.length(), 1);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

        // Sequential visibility
        if (isSynthesizing && elapsed > (mesh.userData.order * bondInterval)) {
            mesh.visible = true;
        }
    });
}

function animateMolecules() {
    molAnimationId = requestAnimationFrame(animateMolecules);

    if (isSynthesizing) {
        // Move atoms to targets
        atomMeshes.forEach(m => m.position.lerp(m.userData.target, 0.05));
        updateBonds();

        // Slow rotation after some time
        const elapsed = Date.now() - synthesisStartTime;
        if (elapsed > 2000) {
            molScene.rotation.y += 0.005;
        }
    } else {
        // Idle floating
        molScene.rotation.y += 0.002;
    }

    if (molRenderer && molScene && molCamera) {
        molRenderer.render(molScene, molCamera);
    }
}

async function searchMoleculeInExplorer(nameOverride) {
    const input = document.getElementById("aa-mol-search");
    const query = nameOverride || input.value.trim();
    if (!query) return;

    console.log("Searching for molecule:", query);

    const loader = document.getElementById("aa-mol-loading");
    if (loader) loader.classList.remove("hidden");

    try {
        // 1. Get CID from Name
        const cidRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`);
        const cidData = await cidRes.json();

        if (cidData.IdentifierList && cidData.IdentifierList.CID) {
            const cid = cidData.IdentifierList.CID[0];
            await renderMoleculeInExplorer(cid, query);
            if (!nameOverride) input.value = ""; // Clear for next search
        } else {
            showToast("Molecule not found in research dataset.", true);
        }
    } catch (err) {
        console.error("Search Error:", err);
        showToast("Service connectivity issue.", true);
    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

async function renderMoleculeInExplorer(cid, name) {
    try {
        // 1. Fetch Properties
        const propRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,XLogP,HBondDonorCount,HBondAcceptorCount/JSON`);
        const propData = await propRes.json();
        const props = propData.PropertyTable.Properties[0];

        // 2. Update UI
        document.getElementById("aa-mol-name").innerText = props.IUPACName || name;
        document.getElementById("aa-mol-formula").innerText = props.MolecularFormula;
        document.getElementById("aa-mol-weight").innerText = props.MolecularWeight;
        document.getElementById("aa-mol-desc").innerText = `High-fidelity 3D structural data for ${name} (CID: ${cid}). Verified via PubChem Open Database.`;

        // Extra Props Cards
        const xtra = document.getElementById("aa-mol-xtra-props");
        xtra.innerHTML = `
            <div class="aa-detail-card glass">
                <label>XLogP</label>
                <h3>${props.XLogP || 'N/A'}</h3>
            </div>
            <div class="aa-detail-card glass">
                <label>H-Bond Donors</label>
                <h3>${props.HBondDonorCount || '0'}</h3>
            </div>
        `;

        // 3. Render 3D with 3Dmol.js
        const sdfRes = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`);
        const sdfText = await sdfRes.text();

        const container = document.getElementById("aa-mol-3d-viewport");
        if (!explorer3dViewer) {
            explorer3dViewer = $3Dmol.createViewer(container, { backgroundColor: 'transparent' });
        }

        explorer3dViewer.clear();
        explorer3dViewer.addModel(sdfText, "sdf");
        explorer3dViewer.setStyle({}, { stick: { radius: 0.2, colorscheme: 'Jmol' }, sphere: { radius: 0.5 } });
        explorer3dViewer.zoomTo();
        explorer3dViewer.render();
        explorer3dViewer.animate({ loop: 'backAndForth', interval: 50 }); // Slight rotations for professional feel

    } catch (err) {
        console.error("Render Error:", err);
        showToast("Error loading 3D structural data.", true);
    }
}

// --- ATOMS MODULE: RESEARCH ENGINE & VISUALIZER ---
const atomicData = {
    "1": { name: "Hydrogen", symbol: "H", mass: "1.008", shells: [1], en: "2.20", radius: "37", state: "Gas" },
    "2": { name: "Helium", symbol: "He", mass: "4.002", shells: [2], en: "N/A", radius: "31", state: "Gas" },
    "3": { name: "Lithium", symbol: "Li", mass: "6.94", shells: [2, 1], en: "0.98", radius: "152", state: "Solid" },
    "4": { name: "Beryllium", symbol: "Be", mass: "9.012", shells: [2, 2], en: "1.57", radius: "112", state: "Solid" },
    "5": { name: "Boron", symbol: "B", mass: "10.81", shells: [2, 3], en: "2.04", radius: "82", state: "Solid" },
    "6": { name: "Carbon", symbol: "C", mass: "12.011", shells: [2, 4], en: "2.55", radius: "77", state: "Solid" },
    "7": { name: "Nitrogen", symbol: "N", mass: "14.007", shells: [2, 5], en: "3.04", radius: "75", state: "Gas" },
    "8": { name: "Oxygen", symbol: "O", mass: "15.999", shells: [2, 6], en: "3.44", radius: "73", state: "Gas" },
    "9": { name: "Fluorine", symbol: "F", mass: "18.998", shells: [2, 7], en: "3.98", radius: "71", state: "Gas" },
    "10": { name: "Neon", symbol: "Ne", mass: "20.180", shells: [2, 8], en: "N/A", radius: "69", state: "Gas" },
    "11": { name: "Sodium", symbol: "Na", mass: "22.990", shells: [2, 8, 1], en: "0.93", radius: "186", state: "Solid" },
    "12": { name: "Magnesium", symbol: "Mg", mass: "24.305", shells: [2, 8, 2], en: "1.31", radius: "160", state: "Solid" },
    "13": { name: "Aluminum", symbol: "Al", mass: "26.982", shells: [2, 8, 3], en: "1.61", radius: "143", state: "Solid" },
    "14": { name: "Silicon", symbol: "Si", mass: "28.085", shells: [2, 8, 4], en: "1.90", radius: "118", state: "Solid" },
    "15": { name: "Phosphorus", symbol: "P", mass: "30.974", shells: [2, 8, 5], en: "2.19", radius: "110", state: "Solid" },
    "16": { name: "Sulfur", symbol: "S", mass: "32.06", shells: [2, 8, 6], en: "2.58", radius: "102", state: "Solid" },
    "17": { name: "Chlorine", symbol: "Cl", mass: "35.45", shells: [2, 8, 7], en: "3.16", radius: "99", state: "Gas" },
    "18": { name: "Argon", symbol: "Ar", mass: "39.948", shells: [2, 8, 8], en: "N/A", radius: "97", state: "Gas" },
    "19": { name: "Potassium", symbol: "K", mass: "39.098", shells: [2, 8, 8, 1], en: "0.82", radius: "227", state: "Solid" },
    "20": { name: "Calcium", symbol: "Ca", mass: "40.078", shells: [2, 8, 8, 2], en: "1.00", radius: "197", state: "Solid" },
    "21": { name: "Scandium", symbol: "Sc", mass: "44.955", shells: [2, 8, 9, 2], en: "1.36", radius: "162", state: "Solid" },
    "22": { name: "Titanium", symbol: "Ti", mass: "47.867", shells: [2, 8, 10, 2], en: "1.54", radius: "147", state: "Solid" },
    "23": { name: "Vanadium", symbol: "V", mass: "50.941", shells: [2, 8, 11, 2], en: "1.63", radius: "134", state: "Solid" },
    "24": { name: "Chromium", symbol: "Cr", mass: "51.996", shells: [2, 8, 13, 1], en: "1.66", radius: "128", state: "Solid" },
    "25": { name: "Manganese", symbol: "Mn", mass: "54.938", shells: [2, 8, 13, 2], en: "1.55", radius: "127", state: "Solid" },
    "26": { name: "Iron", symbol: "Fe", mass: "55.845", shells: [2, 8, 14, 2], en: "1.83", radius: "126", state: "Solid" },
    "27": { name: "Cobalt", symbol: "Co", mass: "58.933", shells: [2, 8, 15, 2], en: "1.88", radius: "125", state: "Solid" },
    "28": { name: "Nickel", symbol: "Ni", mass: "58.693", shells: [2, 8, 16, 2], en: "1.91", radius: "124", state: "Solid" },
    "29": { name: "Copper", symbol: "Cu", mass: "63.546", shells: [2, 8, 18, 1] },
    "30": { name: "Zinc", symbol: "Zn", mass: "65.38", shells: [2, 8, 18, 2] },
    "31": { name: "Gallium", symbol: "Ga", mass: "69.723", shells: [2, 8, 18, 3] },
    "32": { name: "Germanium", symbol: "Ge", mass: "72.630", shells: [2, 8, 18, 4] },
    "33": { name: "Arsenic", symbol: "As", mass: "74.921", shells: [2, 8, 18, 5] },
    "34": { name: "Selenium", symbol: "Se", mass: "78.971", shells: [2, 8, 18, 6] },
    "35": { name: "Bromine", symbol: "Br", mass: "79.904", shells: [2, 8, 18, 7] },
    "36": { name: "Krypton", symbol: "Kr", mass: "83.798", shells: [2, 8, 18, 8] },
    "37": { name: "Rubidium", symbol: "Rb", mass: "85.468", shells: [2, 8, 18, 8, 1] },
    "38": { name: "Strontium", symbol: "Sr", mass: "87.62", shells: [2, 8, 18, 8, 2] },
    "39": { name: "Yttrium", symbol: "Y", mass: "88.906", shells: [2, 8, 18, 9, 2] },
    "40": { name: "Zirconium", symbol: "Zr", mass: "91.224", shells: [2, 8, 18, 10, 2] },
    "41": { name: "Niobium", symbol: "Nb", mass: "92.906", shells: [2, 8, 18, 12, 1] },
    "42": { name: "Molybdenum", symbol: "Mo", mass: "95.95", shells: [2, 8, 18, 13, 1] },
    "43": { name: "Technetium", symbol: "Tc", mass: "(98)", shells: [2, 8, 18, 13, 2] },
    "44": { name: "Ruthenium", symbol: "Ru", mass: "101.07", shells: [2, 8, 18, 15, 1] },
    "45": { name: "Rhodium", symbol: "Rh", mass: "102.91", shells: [2, 8, 18, 16, 1] },
    "46": { name: "Palladium", symbol: "Pd", mass: "106.42", shells: [2, 8, 18, 18] },
    "47": { name: "Silver", symbol: "Ag", mass: "107.87", shells: [2, 8, 18, 18, 1] },
    "48": { name: "Cadmium", symbol: "Cd", mass: "112.41", shells: [2, 8, 18, 18, 2] },
    "49": { name: "Indium", symbol: "In", mass: "114.82", shells: [2, 8, 18, 18, 3] },
    "50": { name: "Tin", symbol: "Sn", mass: "118.71", shells: [2, 8, 18, 18, 4] },
    "51": { name: "Antimony", symbol: "Sb", mass: "121.76", shells: [2, 8, 18, 18, 5] },
    "52": { name: "Tellurium", symbol: "Te", mass: "127.60", shells: [2, 8, 18, 18, 6] },
    "53": { name: "Iodine", symbol: "I", mass: "126.90", shells: [2, 8, 18, 18, 7] },
    "54": { name: "Xenon", symbol: "Xe", mass: "131.29", shells: [2, 8, 18, 18, 8] },
    "55": { name: "Cesium", symbol: "Cs", mass: "132.91", shells: [2, 8, 18, 18, 8, 1] },
    "56": { name: "Barium", symbol: "Ba", mass: "137.33", shells: [2, 8, 18, 18, 8, 2] },
    "57": { name: "Lanthanum", symbol: "La", mass: "138.91", shells: [2, 8, 18, 18, 9, 2] },
    "58": { name: "Cerium", symbol: "Ce", mass: "140.12", shells: [2, 8, 18, 19, 9, 2] },
    "59": { name: "Praseodymium", symbol: "Pr", mass: "140.91", shells: [2, 8, 18, 21, 8, 2] },
    "60": { name: "Neodymium", symbol: "Nd", mass: "144.24", shells: [2, 8, 18, 22, 8, 2] },
    "61": { name: "Promethium", symbol: "Pm", mass: "(145)", shells: [2, 8, 18, 23, 8, 2] },
    "62": { name: "Samarium", symbol: "Sm", mass: "150.36", shells: [2, 8, 18, 24, 8, 2] },
    "63": { name: "Europium", symbol: "Eu", mass: "151.96", shells: [2, 8, 18, 25, 8, 2] },
    "64": { name: "Gadolinium", symbol: "Gd", mass: "157.25", shells: [2, 8, 18, 25, 9, 2] },
    "65": { name: "Terbium", symbol: "Tb", mass: "158.93", shells: [2, 8, 18, 27, 8, 2] },
    "66": { name: "Dysprosium", symbol: "Dy", mass: "162.50", shells: [2, 8, 18, 28, 8, 2] },
    "67": { name: "Holmium", symbol: "Ho", mass: "164.93", shells: [2, 8, 18, 29, 8, 2] },
    "68": { name: "Erbium", symbol: "Er", mass: "167.26", shells: [2, 8, 18, 30, 8, 2] },
    "69": { name: "Thulium", symbol: "Tm", mass: "168.93", shells: [2, 8, 18, 31, 8, 2] },
    "70": { name: "Ytterbium", symbol: "Yb", mass: "173.05", shells: [2, 8, 18, 32, 8, 2] },
    "71": { name: "Lutetium", symbol: "Lu", mass: "174.97", shells: [2, 8, 18, 32, 9, 2] },
    "72": { name: "Hafnium", symbol: "Hf", mass: "178.49", shells: [2, 8, 18, 32, 10, 2] },
    "73": { name: "Tantalum", symbol: "Ta", mass: "180.95", shells: [2, 8, 18, 32, 11, 2] },
    "74": { name: "Tungsten", symbol: "W", mass: "183.84", shells: [2, 8, 18, 32, 12, 2] },
    "75": { name: "Rhenium", symbol: "Re", mass: "186.21", shells: [2, 8, 18, 32, 13, 2] },
    "76": { name: "Osmium", symbol: "Os", mass: "190.23", shells: [2, 8, 18, 32, 14, 2] },
    "77": { name: "Iridium", symbol: "Ir", mass: "192.22", shells: [2, 8, 18, 32, 15, 2] },
    "78": { name: "Platinum", symbol: "Pt", mass: "195.08", shells: [2, 8, 18, 32, 17, 1] },
    "79": { name: "Gold", symbol: "Au", mass: "196.97", shells: [2, 8, 18, 32, 18, 1] },
    "80": { name: "Mercury", symbol: "Hg", mass: "200.59", shells: [2, 8, 18, 32, 18, 2] },
    "81": { name: "Thallium", symbol: "Tl", mass: "204.38", shells: [2, 8, 18, 32, 18, 3] },
    "82": { name: "Lead", symbol: "Pb", mass: "207.2", shells: [2, 8, 18, 32, 18, 4] },
    "83": { name: "Bismuth", symbol: "Bi", mass: "208.98", shells: [2, 8, 18, 32, 18, 5] },
    "84": { name: "Polonium", symbol: "Po", mass: "(209)", shells: [2, 8, 18, 32, 18, 6] },
    "85": { name: "Astatine", symbol: "At", mass: "(210)", shells: [2, 8, 18, 32, 18, 7] },
    "86": { name: "Radon", symbol: "Rn", mass: "(222)", shells: [2, 8, 18, 32, 18, 8] },
    "87": { name: "Francium", symbol: "Fr", mass: "(223)", shells: [2, 8, 18, 32, 18, 8, 1] },
    "88": { name: "Radium", symbol: "Ra", mass: "(226)", shells: [2, 8, 18, 32, 18, 8, 2] },
    "89": { name: "Actinium", symbol: "Ac", mass: "(227)", shells: [2, 8, 18, 32, 18, 9, 2] },
    "90": { name: "Thorium", symbol: "Th", mass: "232.04", shells: [2, 8, 18, 32, 18, 10, 2] },
    "91": { name: "Protactinium", symbol: "Pa", mass: "231.04", shells: [2, 8, 18, 32, 20, 9, 2] },
    "92": { name: "Uranium", symbol: "U", mass: "238.03", shells: [2, 8, 18, 32, 21, 9, 2] },
    "93": { name: "Neptunium", symbol: "Np", mass: "(237)", shells: [2, 8, 18, 32, 22, 9, 2] },
    "94": { name: "Plutonium", symbol: "Pu", mass: "(244)", shells: [2, 8, 18, 32, 24, 8, 2] },
    "95": { name: "Americium", symbol: "Am", mass: "(243)", shells: [2, 8, 18, 32, 25, 8, 2] },
    "96": { name: "Curium", symbol: "Cm", mass: "(247)", shells: [2, 8, 18, 32, 25, 9, 2] },
    "97": { name: "Berkelium", symbol: "Bk", mass: "(247)", shells: [2, 8, 18, 32, 27, 8, 2] },
    "98": { name: "Californium", symbol: "Cf", mass: "(251)", shells: [2, 8, 18, 32, 28, 8, 2] },
    "99": { name: "Einsteinium", symbol: "Es", mass: "(252)", shells: [2, 8, 18, 32, 29, 8, 2] },
    "100": { name: "Fermium", symbol: "Fm", mass: "(257)", shells: [2, 8, 18, 32, 30, 8, 2] },
    "101": { name: "Mendelevium", symbol: "Md", mass: "(258)", shells: [2, 8, 18, 32, 31, 8, 2] },
    "102": { name: "Nobelium", symbol: "No", mass: "(259)", shells: [2, 8, 18, 32, 32, 8, 2] },
    "103": { name: "Lawrencium", symbol: "Lr", mass: "(266)", shells: [2, 8, 18, 32, 32, 8, 3] },
    "104": { name: "Rutherfordium", symbol: "Rf", mass: "(267)", shells: [2, 8, 18, 32, 32, 10, 2] },
    "105": { name: "Dubnium", symbol: "Db", mass: "(268)", shells: [2, 8, 18, 32, 32, 11, 2] },
    "106": { name: "Seaborgium", symbol: "Sg", mass: "(269)", shells: [2, 8, 18, 32, 32, 12, 2] },
    "107": { name: "Bohrium", symbol: "Bh", mass: "(270)", shells: [2, 8, 18, 32, 32, 13, 2] },
    "108": { name: "Hassium", symbol: "Hs", mass: "(269)", shells: [2, 8, 18, 32, 32, 14, 2] },
    "109": { name: "Meitnerium", symbol: "Mt", mass: "(278)", shells: [2, 8, 18, 32, 32, 15, 2] },
    "110": { name: "Darmstadtium", symbol: "Ds", mass: "(281)", shells: [2, 8, 18, 32, 32, 16, 2] },
    "111": { name: "Roentgenium", symbol: "Rg", mass: "(282)", shells: [2, 8, 18, 32, 32, 17, 2] },
    "112": { name: "Copernicium", symbol: "Cn", mass: "(285)", shells: [2, 8, 18, 32, 32, 18, 2] },
    "113": { name: "Nihonium", symbol: "Nh", mass: "(286)", shells: [2, 8, 18, 32, 32, 18, 3] },
    "114": { name: "Flerovium", symbol: "Fl", mass: "(289)", shells: [2, 8, 18, 32, 32, 18, 4] },
    "115": { name: "Moscovium", symbol: "Mc", mass: "(290)", shells: [2, 8, 18, 32, 32, 18, 5] },
    "116": { name: "Livermorium", symbol: "Lv", mass: "(293)", shells: [2, 8, 18, 32, 32, 18, 6] },
    "117": { name: "Tennessine", symbol: "Ts", mass: "(294)", shells: [2, 8, 18, 32, 32, 18, 7] },
    "118": { name: "Oganesson", symbol: "Og", mass: "(294)", shells: [2, 8, 18, 32, 32, 18, 8] }
};

function initAtomsModule() {
    // Awaiting user entry for research-grade exploration
    console.log("Atoms Module Ready.");
}

function searchAtom() {
    const input = document.getElementById("aa-atom-search");
    const rawQuery = input.value.trim().toLowerCase();
    if (!rawQuery) return;

    console.log("Searching for element query:", rawQuery);

    let targetAtNum = null;
    // Check by number, symbol, or name
    for (const [num, data] of Object.entries(atomicData)) {
        // Robust number matching: handle leading zeros and string vs numeric comparison
        const isNumericMatch = (parseInt(num) === parseInt(rawQuery));
        const isNameMatch = (data.name.toLowerCase() === rawQuery || data.symbol.toLowerCase() === rawQuery);

        if (isNumericMatch || isNameMatch) {
            targetAtNum = num;
            break;
        }
    }

    if (targetAtNum) {
        renderAtom(targetAtNum);
        input.value = ""; // Clear for next search
    } else {
        showToast("Element not recognized. Ensure name or atomic number is correct.", true);
    }
}

function renderAtom(atNum) {
    const data = atomicData[atNum];
    if (!data) return;

    // 1. Update text info
    const protons = parseInt(atNum);
    const mass = parseFloat(data.mass);
    const neutrons = Math.round(mass) - protons;
    const electrons = protons; // Neutral atom model

    document.getElementById("aa-at-name").innerText = data.name;
    document.getElementById("aa-at-symbol").innerText = data.symbol;
    document.getElementById("aa-at-protons").innerText = protons;
    document.getElementById("aa-at-neutrons").innerText = neutrons;
    document.getElementById("aa-at-electrons").innerText = electrons;
    document.getElementById("aa-at-mass").innerText = data.mass;
    document.getElementById("aa-at-config").innerText = `Shells: ${data.shells.join(", ")}`;

    // 2. Render Bohr Model SVG
    const svg = document.getElementById("bohr-model-svg");
    svg.innerHTML = ''; // Clear

    const centerX = 250;
    const centerY = 250;
    const baseRadius = 50;
    const shellGap = 40;

    // 2. Draw Shells & Orbiting Electrons
    data.shells.forEach((electronCount, index) => {
        const radius = baseRadius + (index + 1) * shellGap;

        // Draw Ring
        const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        ring.setAttribute("cx", centerX);
        ring.setAttribute("cy", centerY);
        ring.setAttribute("r", radius);
        ring.setAttribute("class", "bohr-ring");
        svg.appendChild(ring);

        // Draw Electrons
        for (let i = 0; i < electronCount; i++) {
            const electron = document.createElementNS("http://www.w3.org/2000/svg", "circle");
            electron.setAttribute("r", "5");
            electron.setAttribute("fill", "#10b981"); // High-fidelity identify: Electrons are Green
            electron.setAttribute("class", "bohr-electron");

            const angle = (i / electronCount) * 2 * Math.PI;

            // Animation for orbiting
            const animPath = document.createElementNS("http://www.w3.org/2000/svg", "animateMotion");
            animPath.setAttribute("dur", `${5 + index * 2}s`);
            animPath.setAttribute("repeatCount", "indefinite");

            const pathData = `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY + radius} A ${radius} ${radius} 0 1 1 ${centerX} ${centerY - radius}`;
            animPath.setAttribute("path", pathData);

            const beginTime = (i / electronCount) * (5 + index * 2);
            animPath.setAttribute("begin", `-${beginTime}s`);

            electron.appendChild(animPath);
            svg.appendChild(electron);
        }
    });

    // 3. Draw Nucleus Cluster (Protons & Neutrons - Tightly Packed)
    const nucleusGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    nucleusGroup.setAttribute("class", "pulsing-nucleus");

    // Unified packing logic for tightly integrated p/n core
    const maxParticles = 60; // Increased for better visual density while maintaining SVG speed
    const totalParticles = protons + neutrons;
    const displayRatio = Math.min(1, maxParticles / totalParticles);

    const nucleons = [];
    const pCount = Math.max(1, Math.floor(protons * displayRatio));
    const nCount = Math.max(1, Math.floor(neutrons * displayRatio));

    for (let i = 0; i < pCount; i++) nucleons.push({ type: 'proton', color: '#ef4444' });
    for (let i = 0; i < nCount; i++) nucleons.push({ type: 'neutron', color: '#64748b' });

    // Shuffle nucleons to ensure a high-fidelity mixed nucleus (not layered)
    nucleons.sort(() => Math.random() - 0.5);

    // Fermat's Spiral (Golden Angle) for optimal dense packing
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const dotRadius = 6;
    const spacing = 5.5; // Reduced spacing for much tighter packing (touching/overlapping)

    nucleons.forEach((nuc, i) => {
        // Start from i = 0 for the first nucleon to land at the exact center (r = 0)
        const r = Math.sqrt(i) * spacing;
        const theta = i * goldenAngle;
        const x = centerX + r * Math.cos(theta);
        const y = centerY + r * Math.sin(theta);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", dotRadius);
        circle.setAttribute("fill", nuc.color);
        circle.setAttribute("stroke", "rgba(0,0,0,0.4)");
        circle.setAttribute("stroke-width", "0.5");
        nucleusGroup.appendChild(circle);
    });

    // Centered Symbol Label
    const nucleusText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    nucleusText.setAttribute("x", centerX);
    nucleusText.setAttribute("y", centerY + 5);
    nucleusText.setAttribute("text-anchor", "middle");
    nucleusText.setAttribute("fill", "#fff");
    nucleusText.setAttribute("font-size", "14");
    nucleusText.setAttribute("font-weight", "bold");
    nucleusText.setAttribute("style", "text-shadow: 0 0 10px rgba(0,0,0,0.8); pointer-events: none;");
    nucleusText.innerHTML = data.symbol;
    nucleusGroup.appendChild(nucleusText);

    svg.appendChild(nucleusGroup);
}

// --- PROFILE LOGIC ---
function saveProfilePreferences() {
    const agent = document.getElementById('pref-agent').value;
    const theme = document.getElementById('pref-theme').value;

    localStorage.setItem("prefAgent", agent);
    localStorage.setItem("theme", theme);

    changeTheme(theme);
    showToast("Preferences saved successfully!");
}

// --- PDF EXPORT LOGIC ---
function exportChatToPDF() {
    if (!window.jspdf) {
        showToast("PDF library not loaded", true);
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const historyKey = `history_${currentUsername}_${userRole}`;
    const saved = localStorage.getItem(historyKey);

    if (!saved) {
        showToast("No chat history to export", true);
        return;
    }

    const messages = JSON.parse(saved);
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(107, 76, 255); // Accent color
    doc.text("Scientific Assistant - Research Report", 20, y);
    y += 15;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`User: ${currentUsername} | Role: ${userRole.toUpperCase()} | Date: ${new Date().toLocaleString()}`, 20, y);
    y += 10;
    doc.line(20, y, 190, y);
    y += 15;

    messages.forEach((m, i) => {
        if (y > 270) {
            doc.addPage();
            y = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setTextColor(m.sender === 'user' ? 0 : 50);
        doc.text(m.sender === 'user' ? "User Query:" : "AI Response:", 20, y);
        y += 7;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(0);

        // Strip HTML tags for PDF
        const cleanText = m.text.replace(/<[^>]*>?/gm, '');
        const splitText = doc.splitTextToSize(cleanText, 160);
        doc.text(splitText, 25, y);
        y += (splitText.length * 7) + 10;
    });

    doc.save(`Research_Report_${currentUsername}_${Date.now()}.pdf`);
    showToast("PDF Report Downloaded!");
}

// Kickstart
init();
