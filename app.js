// ============================================================================
// YOUTUBE DJ MIXER - Main Application
// ============================================================================

// --- UTILITY FUNCTIONS ---

/**
 * Escapes HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Highlights matching query in text
 * @param {string} text - Text to process
 * @param {string} query - Query to highlight
 * @returns {string} HTML with highlights
 */
function highlightText(text, query) {
    if (!query || !text) return escapeHtml(text);
    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escapedQuery) return escapeHtml(text);
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    return parts.map(part => {
        if (part.toLowerCase() === query.trim().toLowerCase()) {
            return `<span class="search-highlight">${escapeHtml(part)}</span>`;
        }
        return escapeHtml(part);
    }).join('');
}

/**
 * Logs debug messages to console and UI
 * @param {string} msg - Message to log
 */
function logDebug(msg) {
    console.log(msg);
    const debugEl = document.getElementById('debugLog');
    if (debugEl) {
        const line = document.createElement('div');
        line.textContent = `> ${msg}`;
        line.className = "border-b border-zinc-800 py-1 font-mono text-zinc-400";
        debugEl.prepend(line);
    }
}

/**
 * Shows a toast notification
 * @param {string} msg - Message to display
 * @param {string} type - Type of toast ('success' or 'error')
 */
function showToast(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type} show`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Shows a confirmation modal
 * @param {string} title - Modal title
 * @param {string} msg - Modal message
 * @param {Array} options - Array of button options
 */
function showConfirm(title, msg, options) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const btnContainer = document.getElementById('modal-buttons');
    const inputEl = document.getElementById('modal-input');

    if (inputEl) inputEl.classList.add('hidden'); // Ensure input is hidden for confirm

    titleEl.innerText = title;
    msgEl.innerText = msg;
    btnContainer.innerHTML = '';

    options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = opt.primary
            ? "px-3 py-2 rounded bg-dj-neon text-black hover:bg-cyan-400 text-xs font-bold transition-all"
            : "px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs transition-all";
        btn.innerText = opt.label;
        btn.onclick = () => {
            overlay.classList.remove('open');
            if (opt.callback) opt.callback();
        };
        btnContainer.appendChild(btn);
    });

    overlay.classList.add('open');
}

/**
 * Shows a prompt modal
 * @param {string} title - Modal title
 * @param {string} msg - Modal message
 * @param {string} defaultValue - Initial value for input
 * @param {function} callback - Callback with the result
 */
function showPrompt(title, msg, defaultValue, callback) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const msgEl = document.getElementById('modal-msg');
    const inputEl = document.getElementById('modal-input');
    const btnContainer = document.getElementById('modal-buttons');

    titleEl.innerText = title;
    msgEl.innerText = msg;

    if (inputEl) {
        inputEl.classList.remove('hidden');
        inputEl.value = defaultValue || '';
        setTimeout(() => inputEl.focus(), 100);
    }

    btnContainer.innerHTML = '';

    // OK Button
    const okBtn = document.createElement('button');
    okBtn.className = "px-3 py-2 rounded bg-dj-neon text-black hover:bg-cyan-400 text-xs font-bold transition-all";
    okBtn.innerText = "Valider";
    okBtn.onclick = () => {
        overlay.classList.remove('open');
        if (callback) callback(inputEl ? inputEl.value : '');
    };
    btnContainer.appendChild(okBtn);

    // Cancel Button
    const cancelBtn = document.createElement('button');
    cancelBtn.className = "px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-xs transition-all";
    cancelBtn.innerText = "Annuler";
    cancelBtn.onclick = () => {
        overlay.classList.remove('open');
    };
    btnContainer.appendChild(cancelBtn);

    overlay.classList.add('open');

    // Enter/Escape key support
    inputEl.onkeydown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            okBtn.click();
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelBtn.click();
        }
    };
}

/**
 * Global error handler
 */
window.onerror = function (msg, url, line) {
    logDebug(`Global Error: ${msg} @ line ${line}`);
    showToast(`Erreur: ${msg}`, 'error');
    return false;
};

// --- YOUTUBE API CONFIGURATION ---
const SEARCH_CACHE_KEY = 'dj_mixer_search_cache';
const MAX_CACHE_ITEMS = 50;
const CACHE_EXPIRY_HOURS = 24;

const QUEUE_STORAGE_KEY = 'dj_mixer_queue';

// --- DISCOVERY TERMS BANK ---
const DISCOVERY_TERMS = [
    "70s disco", "80s synthwave", "90s house", "2000s r&b", "funk music", "soul classics",
    "chanson française", "rock français", "reggae gold", "latin jazz", "bossa nova",
    "nu jazz", "lofi beats", "afrobeats", "reggaeton hits", "french touch electro",
    "italo disco", "modern jazz", "classic rock", "grunge hits", "trip hop classics",
    "motown hits", "vibrant pop", "soulful blues", "electric blues", "hard rock",
    "punk rock", "alternative rock 90s", "french pop", "k-pop hits", "j-pop classics",
    "brazilian bossa", "salsa classics", "flamenco fusion", "indian classical fusion",
    "ambient electronic", "deep house", "techno favorites", "progressive trance",
    "classical masterpieces", "baroque music", "romantic era piano", "soundtrack suites",
    "underground rap", "old school hip hop", "west coast rap", "east coast hip hop",
    "chicago house", "detroit techno", "uk garage", "drum and bass classics",
    "indie folk", "acoustic covers", "jazz vocalists", "big band era", "swing music",
    "rockabilly", "blues rock", "psychedelic rock", "progressive rock", "post-punk",
    "dream pop", "shoegaze", "garage rock", "surf rock", "calypso music",
    "highlife", "tropicalia", "mambo classics", "cha cha cha music", "tango highlights"
];

logDebug("Script Initialized. Waiting for YouTube API...");

// --- WAVEFORM GENERATION ---
function generateWaveform() {
    let html = '';
    for (let i = 0; i < 40; i++) {
        let h = Math.floor(Math.random() * 80) + 20;
        html += `<div class="w-1 bg-current rounded-t" style="height: ${h}%"></div>`;
    }
    return html;
}

/**
 * Extracts YouTube video ID from URL
 * @param {string} url - YouTube URL or video ID
 * @returns {string|false} Video ID or false if invalid
 */
function extractVideoID(url) {
    logDebug(`Extracting ID from: ${url}`);
    if (!url) return false;

    // Trim whitespace
    url = url.trim();

    // Support direct ID (11 characters, alphanumeric + - and _)
    if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
        logDebug(`Direct ID detected: ${url}`);
        return url;
    }

    // Multiple regex patterns for different YouTube URL formats
    const patterns = [
        // Standard watch URL: youtube.com/watch?v=VIDEO_ID
        /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        // Short URL with optional params: youtu.be/VIDEO_ID or youtu.be/VIDEO_ID?si=...
        /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})(?:\?|&|$)/,
        // Embed URL: youtube.com/embed/VIDEO_ID
        /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
        // Shorts URL: youtube.com/shorts/VIDEO_ID
        /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        // Mobile URL: m.youtube.com/watch?v=VIDEO_ID
        /(?:m\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
        // URL with additional parameters: youtube.com/watch?v=VIDEO_ID&...
        /(?:youtube\.com\/watch\?.*v=)([a-zA-Z0-9_-]{11})/,
        // v/ format: youtube.com/v/VIDEO_ID
        /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) {
            logDebug(`Extracted ID: ${match[1]} using pattern: ${pattern}`);
            return match[1];
        }
    }

    logDebug(`No valid ID found in: ${url}`);
    return false;
}

/**
 * Parses track info into artist and title
 * @param {string} fullTitle - Full track title
 * @returns {Object} Object with artist and title
 */
function parseTrackInfo(fullTitle) {
    let artist = fullTitle;
    let title = "";
    const separator = fullTitle.includes(" - ") ? " - " : (fullTitle.includes(": ") ? ": " : null);
    if (separator) {
        const parts = fullTitle.split(separator);
        artist = parts[0].trim();
        title = parts.slice(1).join(separator).trim();
    }
    return { artist, title };
}

// ============================================================================
// DJ MIXER CLASS
// ============================================================================

class DJMixer {
    constructor() {
        // Determine Mode
        const urlParams = new URLSearchParams(window.location.search);
        this.isProjector = urlParams.get('mode') === 'projector';

        this.players = { A: null, B: null };
        this.ready = { A: false, B: false };
        this.state = {
            A: { volume: 100, speed: 1, playing: false, videoId: null, monitor: true, title: 'Aucune piste', priming: false, autoPlayNext: false, lookaheadDone: false, smartEndPoint: null, smartStartPoint: null },
            B: { volume: 100, speed: 1, playing: false, videoId: null, monitor: true, title: 'Aucune piste', priming: false, autoPlayNext: false, lookaheadDone: false, smartEndPoint: null, smartStartPoint: null },
            crossfader: 50,
            audioOutput: 'local', // 'local' (PC) or 'projector' (Projector)
            zoomActive: false,
            scrSyncVideo: localStorage.getItem('dj_scr_sync_video') === 'true',
        };
        this.scrThumbnails = { A: null, B: null };

        // Advanced Features
        this.faderStartEnabled = true;
        this.autoPlayEnabled = false;
        this.shuffleEnabled = false;
        this.smartChainingEnabled = localStorage.getItem('dj_smart_chaining') !== 'false';
        this.turboEnabled = localStorage.getItem('dj_turbo_enabled') !== 'false'; // Default TRUE
        this.isAutoTransitioning = false; // New flag for overlapping transitions
        this.playlists = {};

        // PERFORMANCE: Timer management
        this.timerInterval = {};
        this.timerActive = { A: false, B: false };

        // Transition Settings
        this.autoNextThreshold = parseInt(localStorage.getItem('dj_auto_next_threshold')) || 10;

        // End-screen blocker references
        this.endScreenBlocker = { A: null, B: null };

        // Sync Channel
        this.handshakeInterval = null;
        this.pendingState = null;
        this.syncChannel = new BroadcastChannel('dj_mixer_sync');

        // Artist Separation Rule
        this.recentArtists = [];
        this.MAX_RECENT_ARTISTS = 15;

        // Priming Timeout Management
        this.primingTimeouts = { A: null, B: null };

        if (this.isProjector) {
            this.initProjectorMode();
        } else {
            // Controller Mode
            // Multi-Queue Setup (10 tabs)
            this.activeQueueIndex = 0;
            this.queueNames = JSON.parse(localStorage.getItem('dj_queue_names')) ||
                Array.from({ length: 10 }, (_, i) => `LISTE ${i + 1}`);
            this.queues = JSON.parse(localStorage.getItem('dj_queues')) ||
                Array.from({ length: 10 }, () => []);

            // Retro-compatibility: if this.queue existed, move it to first tab
            const legacyQueue = JSON.parse(localStorage.getItem('dj_queue'));
            if (legacyQueue && Array.isArray(legacyQueue) && legacyQueue.length > 0) {
                this.queues[0] = legacyQueue;
                localStorage.removeItem('dj_queue');
            }

            // Reference to current queue for convenience
            this.queue = this.queues[this.activeQueueIndex];

            // Queue play position (tracks before this index have been played)
            this.queuePlayIndex = 0;

            setTimeout(() => {
                this.renderQueueTabs();
                this.renderQueue();
                // Load saved theme
                const savedTheme = localStorage.getItem('dj_theme') || 'neon';
                this.applyTheme(savedTheme);
                const ts = document.getElementById('themeSelect');
                if (ts) ts.value = savedTheme;

                // Sync initial button states
                this.updateMasterButtonUI('FaderStart', this.faderStartEnabled);
                this.updateMasterButtonUI('AutoNext', this.autoPlayEnabled);
                this.updateMasterButtonUI('Shuffle', this.shuffleEnabled);
                this.updateMasterButtonUI('SmartChaining', this.smartChainingEnabled);

                // Restore saved queue height
                const savedHeight = localStorage.getItem('dj_queue_height');
                if (savedHeight) {
                    const section = document.getElementById('queueSection');
                    if (section) section.style.height = savedHeight + 'px';
                }

                // Queue resize handle
                this.initQueueResize();

                // Initial UI Glow
                this.updateOnAirGlow(this.state.crossfader);

                // Initial Turbo UI
                this.updateTurboUI();

                logDebug(`Mixer Initialized: TurboMode=${this.turboEnabled}, SmartChaining=${this.smartChainingEnabled}`);
            }, 100);
        }

        // Listen for Sync Events
        this.syncChannel.onmessage = (event) => this.handleSyncMessage(event.data);

        // Queue drag-drop listeners (attached once, not per-render)
        // GLOBAL KEYBOARD SHORTCUTS
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F11') {
                e.preventDefault();
                if (window.electronAPI && window.electronAPI.toggleFullscreen) {
                    window.electronAPI.toggleFullscreen();
                }
            }
        });

        if (!this.isProjector) {
            setTimeout(() => this.initQueueListeners(), 200);
        }
    }

    /**
     * Closes the application via Electron IPC
     */
    closeApp() {
        if (window.electronAPI && window.electronAPI.closeApp) {
            showConfirm("Quitter", "Voulez-vous vraiment fermer l'application ?", [
                {
                    label: "Quitter",
                    primary: true,
                    callback: () => window.electronAPI.closeApp()
                },
                {
                    label: "Annuler"
                }
            ]);
        } else {
            // Fallback for browser testing
            if (confirm("Voulez-vous vraiment fermer l'application ?")) {
                window.close();
            }
        }
    }

    // --- INITIALIZATION ---

    initProjectorMode() {
        document.body.classList.add('projector-mode');
        document.body.innerHTML = `
            <!-- LIVE INDICATOR (Subtle) -->
            <div class="fixed top-4 left-4 z-[100] flex items-center gap-2 px-3 py-1 bg-black/50 rounded-full border border-white/10 pointer-events-none">
                <div class="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
                <span class="text-[10px] font-bold text-white/50 tracking-widest">LIVE OUT</span>
            </div>

            <!-- SCREEN SAVER OVERLAY (Projector Copy) -->
            <div id="screenSaverOverlay" class="fixed inset-0 z-[1000] bg-black hidden flex-col items-center justify-center overflow-hidden">
                <canvas id="screenSaverCanvas" class="absolute inset-0 w-full h-full"></canvas>
                <div id="screenSaverTextContainer" class="z-10 pointer-events-none text-center px-10">
                    <h1 id="screenSaverText" class="text-6xl md:text-9xl font-display font-black tracking-tighter uppercase blur-sm opacity-50 transition-all duration-500"></h1>
                </div>
            </div>

            <div id="pA" class="projector-deck">
                <div id="playerA" class="w-full h-full"></div>
                <div id="projPrimingA" class="projector-priming-overlay hidden">
                    <div class="flex flex-col items-center gap-4 text-center">
                        <i class="ph-fill ph-spinner-gap text-6xl animate-spin text-dj-neon"></i>
                        <h2 id="projTitleA" class="text-3xl font-display font-black text-white uppercase tracking-tighter"></h2>
                        <p id="projArtistA" class="text-sm font-display font-bold text-dj-neon uppercase tracking-widest"></p>
                    </div>
                </div>
            </div>
            <div id="pB" class="projector-deck">
                <div id="playerB" class="w-full h-full"></div>
                <div id="projPrimingB" class="projector-priming-overlay hidden">
                    <div class="flex flex-col items-center gap-4 text-center">
                        <i class="ph-fill ph-spinner-gap text-6xl animate-spin text-dj-warning"></i>
                        <h2 id="projTitleB" class="text-3xl font-display font-black text-white uppercase tracking-tighter"></h2>
                        <p id="projArtistB" class="text-sm font-display font-bold text-dj-warning uppercase tracking-widest"></p>
                    </div>
                </div>
            </div>
        `;
        console.log("Projector Mode Initialized");

        // START HANDSHAKE RETRY LOOP
        logDebug("Starting Handshake Loop...");
        this.handshakeInterval = setInterval(() => {
            logDebug("Projector: Requesting Sync...");
            this.broadcast({ type: 'REQUEST_STATE' });
        }, 1500);
    }

    // --- FEATURE TOGGLES ---

    toggleFaderStart() {
        this.faderStartEnabled = !this.faderStartEnabled;
        this.updateMasterButtonUI('FaderStart', this.faderStartEnabled);
        logDebug(`Fader Start: ${this.faderStartEnabled}`);
    }

    toggleAutoPlay() {
        this.autoPlayEnabled = !this.autoPlayEnabled;
        this.updateMasterButtonUI('AutoNext', this.autoPlayEnabled);
        logDebug(`Auto Play: ${this.autoPlayEnabled}`);

        // If enabled, check for immediate lookahead
        if (this.autoPlayEnabled) {
            const activeDeck = this.state.A.playing ? 'A' : (this.state.B.playing ? 'B' : null);
            if (activeDeck) this.checkLookaheadPriming(activeDeck);
        }
    }

    toggleShuffle() {
        this.shuffleEnabled = !this.shuffleEnabled;
        this.updateMasterButtonUI('Shuffle', this.shuffleEnabled);
        logDebug(`Shuffle: ${this.shuffleEnabled}`);

        if (this.shuffleEnabled && this.queue.length > this.queuePlayIndex + 1) {
            logDebug("Shuffle Enabled: reordering remaining queue...");
            // Physical shuffle of remaining items
            const remaining = this.queue.slice(this.queuePlayIndex);
            for (let i = remaining.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
            }
            // Replace remaining items in queue
            this.queue.splice(this.queuePlayIndex, remaining.length, ...remaining);

            this.renderQueue();
            this.saveQueues();

            // Force lookahead to re-prime the potentially new "next" track
            const activeDeck = this.state.A.playing ? 'A' : (this.state.B.playing ? 'B' : null);
            if (activeDeck) {
                this.state[activeDeck].lookaheadDone = false; // Reset so it runs again
                this.checkLookaheadPriming(activeDeck);
            }
        }
    }

    toggleSmartChaining() {
        this.smartChainingEnabled = !this.smartChainingEnabled;
        localStorage.setItem('dj_smart_chaining', this.smartChainingEnabled);
        this.updateMasterButtonUI('SmartChaining', this.smartChainingEnabled);
        logDebug(`Smart Chaining (SponsorBlock): ${this.smartChainingEnabled}`);

        // If enabled, check if current tracks have segments
        if (this.smartChainingEnabled) {
            if (this.state.A.videoId) this.fetchSponsorBlockSegments('A', this.state.A.videoId);
            if (this.state.B.videoId) this.fetchSponsorBlockSegments('B', this.state.B.videoId);
        }
    }

    async fetchSponsorBlockSegments(deck, videoId) {
        if (!videoId || !this.smartChainingEnabled) return;
        this.state[deck].smartEndPoint = null; // Reset
        this.state[deck].smartStartPoint = null; // Reset

        try {
            // Fetch multiple categories for both start and end detection
            // music_offtopic: non-music at end/start, outro: credits, preview: teasing/next video, filler: non-music/talking, sponsor: ads
            const categories = encodeURIComponent(JSON.stringify(["music_offtopic", "outro", "preview", "filler", "sponsor", "interaction", "intro"]));
            const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${videoId}&categories=${categories}`;
            const response = await fetch(url);

            if (response.status === 404) {
                logDebug(`SponsorBlock: No segments for ${videoId}`);
                return;
            }

            if (!response.ok) throw new Error(`Status ${response.status}`);

            const segments = await response.json();
            const duration = this.players[deck].getDuration();

            if (!duration) {
                // Retry once duration is likely available
                setTimeout(() => this.fetchSponsorBlockSegments(deck, videoId), 2000);
                return;
            }

            logDebug(`SponsorBlock: Found ${segments.length} segments for ${videoId}`);

            // --- END POINT DETECTION (Transitions) ---
            const endSegments = segments.filter(s => s.segment[0] > (duration * 0.4)); // Modified to be more inclusive
            if (endSegments.length > 0) {
                // Sort by start time and pick the earliest "end" segment that makes sense
                endSegments.sort((a, b) => a.segment[0] - b.segment[0]);

                // We want the most likely actual end of the song
                const validEnd = endSegments.find(s => ["music_offtopic", "outro", "preview"].includes(s.category));
                if (validEnd) {
                    const endPoint = validEnd.segment[0];
                    if (duration - endPoint > 2) {
                        this.state[deck].smartEndPoint = endPoint;
                        logDebug(`SponsorBlock (END - ${validEnd.category}): Set at ${endPoint.toFixed(1)}s`);
                    }
                }
            }

            // --- START POINT DETECTION (Intro skipping) ---
            // Find segments that start at or very near 0 and end within the first 35% of the video
            const startSegments = segments.filter(s => s.segment[0] < (duration * 0.05) && s.segment[1] < (duration * 0.35));
            if (startSegments.length > 0) {
                // Pick the latest end time among intro segments
                startSegments.sort((a, b) => b.segment[1] - a.segment[1]);
                const startPoint = startSegments[0].segment[1];

                if (startPoint > 1) {
                    this.state[deck].smartStartPoint = startPoint;
                    logDebug(`SponsorBlock (START - ${startSegments[0].category}): Set at ${startPoint.toFixed(1)}s`);
                }
            }

        } catch (e) {
            logDebug(`SponsorBlock Error: ${e.message}`);
        }
    }

    updateMasterButtonUI(key, isActive) {
        const btn = document.getElementById(`btn${key}`);
        if (!btn) return;

        if (isActive) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    toggleAudioOutput() {
        this.state.audioOutput = (this.state.audioOutput === 'local') ? 'projector' : 'local';

        const btn = document.getElementById('audioToggleBtn');
        const label = document.getElementById('audioLabel');
        const icon = document.getElementById('audioIcon');

        if (this.state.audioOutput === 'projector') {
            label.innerText = "AUDIO: PROJ";
            icon.className = "ph-fill ph-projector-screen text-dj-neon";
            btn.classList.add('border-dj-neon');
        } else {
            label.innerText = "AUDIO: PC";
            icon.className = "ph-fill ph-speaker-high";
            btn.classList.remove('border-dj-neon');
        }

        this.applyVolumes();
        this.broadcast({ type: 'AUDIO_OUTPUT', val: this.state.audioOutput });
    }

    toggleTurboMode() {
        this.turboEnabled = !this.turboEnabled;
        localStorage.setItem('dj_turbo_enabled', this.turboEnabled);
        this.updateTurboUI();
        logDebug(`Turbo Mode: ${this.turboEnabled ? 'ENABLED (High Config)' : 'DISABLED (Low Config)'}`);
        showToast(`Mode Turbo ${this.turboEnabled ? 'Activé' : 'Désactivé'}`, 'info');
    }

    updateTurboUI() {
        const btn = document.getElementById('perfToggleBtn');
        const icon = document.getElementById('perfIcon');
        const btnMob = document.getElementById('perfToggleBtnRowBlock');
        const iconMob = document.getElementById('perfIconMobile');

        if (this.turboEnabled) {
            if (icon) icon.className = "ph-fill ph-lightning text-dj-neon";
            if (iconMob) iconMob.className = "ph-fill ph-lightning text-dj-neon";
            if (btn) btn.classList.add('border-dj-neon/50', 'bg-dj-neon/10');
            if (btnMob) btnMob.classList.add('perf-active', 'border-dj-neon', 'bg-dj-neon/10'); // Re-added from original
            document.body.classList.remove('low-config'); // Re-added from original
        } else {
            if (icon) icon.className = "ph-fill ph-lightning text-zinc-500";
            if (iconMob) iconMob.className = "ph-fill ph-lightning text-zinc-500";
            if (btn) btn.classList.remove('border-dj-neon/50', 'bg-dj-neon/10');
            if (btnMob) btnMob.classList.remove('perf-active', 'border-dj-neon', 'bg-dj-neon/10'); // Re-added from original
            document.body.classList.add('low-config'); // Re-added from original
        }
    }

    /**
     * Toggles video zoom (Scale & Clip) on projector
     */
    toggleZoom() {
        this.state.zoomActive = !this.state.zoomActive;
        this.applyZoom();
        this.broadcast({ type: 'TOGGLE_ZOOM', active: this.state.zoomActive });

        if (!this.isProjector) {
            showToast(this.state.zoomActive ? "Zoom Projecteur Activé" : "Zoom Projecteur Désactivé", "success");
            this.updateZoomUI();
        }
    }

    applyZoom() {
        if (this.isProjector) {
            if (this.state.zoomActive) {
                document.body.classList.add('zoom-active');
            } else {
                document.body.classList.remove('zoom-active');
            }
        }
    }

    updateZoomUI() {
        if (this.isProjector) return;
        const btn = document.getElementById('zoomToggleBtn');
        if (btn) {
            if (this.state.zoomActive) {
                btn.classList.add('text-dj-neon', 'border-dj-neon/50', 'bg-dj-neon/10');
            } else {
                btn.classList.remove('text-dj-neon', 'border-dj-neon/50', 'bg-dj-neon/10');
            }
        }
    }

    // --- PLAYER CALLBACKS ---

    onPlayerReady(deck) {
        this.ready[deck] = true;
        logDebug(`Deck ${deck} is READY`);

        if (this.isProjector) {
            const statusEl = document.getElementById(`status${deck}`);
            if (statusEl) {
                statusEl.innerText = `Deck ${deck}: READY`;
                statusEl.classList.add('text-green-400');
            }

            this.applyVolumes();
            if (this.pendingState && this.ready.A && this.ready.B) {
                this.applyFullSync(this.pendingState);
                this.pendingState = null;
            }
        } else {
            const titleEl = document.getElementById(`title${deck}`);
            if (titleEl) {
                titleEl.classList.remove('text-red-500');
                if (titleEl.innerText.includes("Chargement")) {
                    titleEl.innerText = "Prêt à jouer";
                }
            }

            // Also update the new display UI
            const displayTitle = document.getElementById(`displayTitle${deck}`);
            if (displayTitle && displayTitle.innerText.includes("Chargement")) {
                displayTitle.innerText = "Prêt à jouer";
            }

            this.handleCrossfade(this.state.crossfader);
        }
    }

    onPlayerStateChange(deck, event) {
        const isPlaying = event.data == 1;
        const isPaused = event.data == 2;
        const isEnded = event.data == 0;
        this.state[deck].playing = isPlaying;

        if (isPlaying) {
            this.hidePrimingOverlay(deck);
            // --- PRIMING COMPLETION LOGIC ---
            if (this.state[deck].priming) {
                logDebug(`Deck ${deck} Primed (Stream Ready)`);
                this.state[deck].priming = false;

                if (this.state[deck].autoPlayNext) {
                    this.state[deck].autoPlayNext = false;
                    logDebug(`Deck ${deck}: AutoPlayNext triggered.`);

                    // --- SMART START SKIP ---
                    if (this.state[deck].smartStartPoint) {
                        const start = this.state[deck].smartStartPoint;
                        logDebug(`Smart Start: Skipping intro, seeking to ${start.toFixed(1)}s`);
                        this.players[deck].seekTo(start);
                    }

                    this.hidePrimingOverlay(deck);
                    this.startTimer(deck); // IMPORTANT: Resume timer for tracking

                    // --- SYNCED TRANSITION TRIGGER ---
                    if (this.pendingTransition && this.pendingTransition.targetDeck === deck) {
                        this.triggerPendingTransition();
                    }
                } else {
                    // Fix: Give it a tiny moment to render the first frame before pausing
                    if (this.primingTimeouts[deck]) clearTimeout(this.primingTimeouts[deck]);
                    this.primingTimeouts[deck] = setTimeout(() => {
                        this.players[deck].pauseVideo();

                        // --- SMART START SKIP (Primed state) ---
                        const start = this.state[deck].smartStartPoint || 0;
                        if (start > 0) logDebug(`Smart Start: Primed at intro-skip point ${start.toFixed(1)}s`);
                        this.players[deck].seekTo(start);

                        // Update Overlay to "Ready" state
                        this.updatePrimingOverlayStatus(deck, "Prêt pour lancement direct");
                        this.primingTimeouts[deck] = null;
                    }, 150); // Slightly increased for stability
                }

                // Restore Volumes after a tiny delay to ensure seek/pause happened
                setTimeout(() => this.applyVolumes(), 100);

                if (!this.isProjector && !this.state[deck].playing) {
                    showToast(`Deck ${deck} prêt`, 'success');
                }
                return;
            }

            // Natural Play (started by user or fader)
            this.hidePrimingOverlay(deck);
            this.startTimer(deck);

            // PROJECTOR AUDIO SYNC: If playing, ensure volumes are applied
            if (this.isProjector) {
                setTimeout(() => this.applyVolumes(), 100);
            } else {
                // Controller logic: Check for lookahead priming when a deck starts playing
                this.checkLookaheadPriming(deck);
            }
        } else if (event.data === 3 || event.data === -1) { // Buffering or Unstarted
            this.hidePrimingOverlay(deck);
        } else if (isPaused || isEnded) {
            this.stopTimer(deck);
        }

        if (isEnded) {
            const start = this.state[deck].smartStartPoint || 0;
            if (this.isProjector) {
                logDebug(`Projector: Deck ${deck} ended. Cueing back to ${start.toFixed(1)}s.`);
                this.players[deck].cueVideoById({
                    videoId: this.state[deck].videoId,
                    startSeconds: start,
                    playerVars: {
                        playlist: this.state[deck].videoId,
                        loop: 1,
                        rel: 0,
                        modestbranding: 1
                    }
                });
            } else {
                if (this.state[deck].handledEnd) {
                    this.state[deck].handledEnd = false;
                    return;
                }

                if (this.autoPlayEnabled && this.queuePlayIndex < this.queue.length) {
                    logDebug(`Deck ${deck} Ended naturally. Auto Transition.`);
                    this.transitionToNextDeck(deck);
                } else {
                    logDebug(`Deck ${deck} Ended naturally. Resetting to ${start.toFixed(1)}s.`);
                    this.players[deck].stopVideo();
                    this.players[deck].cueVideoById({
                        videoId: this.state[deck].videoId,
                        startSeconds: start
                    });
                    this.broadcast({ type: 'RESET_VIDEO', deck, videoId: this.state[deck].videoId, val: start });
                }
            }
        }

        // ALWAYS ENSURE VOLUME SYNC ON STATE CHANGE (PC & PROJ)
        this.applyVolumes();

        // Controller UI updates
        if (!this.isProjector) {
            const icon = document.getElementById(`iconPlay${deck}`);
            if (icon) icon.className = isPlaying ? "ph-fill ph-pause text-xl" : "ph-fill ph-play text-xl";

            const blocker = document.getElementById(`clickBlocker${deck}`);
            if (blocker) {
                if (isPlaying) blocker.classList.remove('hidden');
                else blocker.classList.add('hidden');
            }

            this.updateSafetyUI(deck, isPlaying);

            if (isPlaying) this.broadcast({ type: 'PLAY', deck });
            else if (isPaused) this.broadcast({ type: 'PAUSE', deck });

            this.startVUMeter();
        }
    }

    startVUMeter() {
        if (this.isProjector) return;

        const visualizer = document.getElementById('masterVisualizer');
        if (!visualizer) {
            logDebug("VU Meter: masterVisualizer NOT FOUND in DOM");
            return;
        }

        const bars = visualizer.querySelectorAll('.waveform-bar');
        if (bars.length === 0) {
            logDebug("VU Meter: No waveform-bar elements found");
            return;
        }

        const isActive = this.state.A.playing || this.state.B.playing;

        if (isActive) {
            visualizer.classList.add('pulse-active');
            if (!this.vuInterval) {
                logDebug("VU Meter: Starting Interval");
                const interval = this.turboEnabled ? 60 : 120; // 60ms for Turbo ON, 120ms for Turbo OFF
                this.vuInterval = setInterval(() => {
                    if (!this.state.A.playing && !this.state.B.playing) {
                        logDebug("VU Meter: Stopping Interval (No deck playing)");
                        clearInterval(this.vuInterval);
                        this.vuInterval = null;
                        bars.forEach(bar => bar.style.height = '10%');
                        visualizer.classList.remove('pulse-active');
                        return;
                    }

                    const x = this.state.crossfader;
                    const fadeA = x < 50 ? 1 : (100 - x) / 50;
                    const fadeB = x > 50 ? 1 : x / 50;

                    let baseLevel = 0;
                    if (this.state.A.playing) baseLevel += (this.state.A.volume / 100) * fadeA;
                    if (this.state.B.playing) baseLevel += (this.state.B.volume / 100) * fadeB;

                    // Ensure at least some movement if playing
                    baseLevel = Math.max(0.05, baseLevel);

                    bars.forEach((bar, i) => {
                        // Wider variance for more visible movement
                        const variance = Math.random() * 0.6;
                        const level = Math.min(1, Math.max(0.1, baseLevel * (0.4 + variance)));
                        bar.style.height = `${level * 100}%`;
                    });
                }, interval);
            }
        } else {
            if (this.vuInterval) {
                logDebug("VU Meter: Stopping Interval (Manual clean)");
                clearInterval(this.vuInterval);
                this.vuInterval = null;
            }
            bars.forEach(bar => bar.style.height = '10%');
            visualizer.classList.remove('pulse-active');
        }
    }

    // OPTIMIZED END-SCREEN BLOCKER (CORS Safe)
    startEndScreenBlocker(deck) {
        // We no longer attempt iframe manipulation due to CORS.
        // End-screen suppression is now handled by startTimer's look-ahead logic.
    }

    stopEndScreenBlocker(deck) {
        if (this.endScreenBlocker && this.endScreenBlocker[deck]) {
            clearInterval(this.endScreenBlocker[deck]);
            this.endScreenBlocker[deck] = null;
        }
    }

    onPlayerError(deck, event) {
        if (this.isProjector) return;

        const errorCodes = {
            2: "ID Invalide",
            5: "Erreur HTML5",
            100: "Vidéo Introuvable/Privée",
            101: "Integration Bloquée (Copyright)",
            150: "Integration Bloquée (Copyright)"
        };
        const msg = errorCodes[event.data] || `Erreur ${event.data}`;
        logDebug(`ERROR Deck ${deck}: ${msg}`);

        showToast(`Erreur Deck ${deck}: ${msg}`, 'error');
        const titleEl = document.getElementById(`title${deck}`);
        if (titleEl) {
            titleEl.innerText = `ERREUR: ${msg}`;
            titleEl.classList.add('text-red-500');
        }

        // ERROR RESILIENCE: Auto-skip if Auto-Next is on
        if (!this.isProjector && this.autoPlayEnabled) {
            logDebug(`Error Resilience: Skipping deck ${deck} in 3s...`);
            setTimeout(() => {
                if (this.queuePlayIndex < this.queue.length) {
                    this.transitionToNextDeck(deck);
                }
            }, 3000);
        }
    }

    // --- TIMER MANAGEMENT (PERFORMANCE IMPROVED) ---

    startTimer(deck) {
        // Stop existing timer if any
        this.stopTimer(deck);

        this.timerActive[deck] = true;
        let lastBroadcastTime = 0;

        this.timerInterval[deck] = setInterval(() => {
            if (!this.timerActive[deck]) {
                this.stopTimer(deck);
                return;
            }

            if (this.players[deck] && typeof this.players[deck].getCurrentTime === 'function' && typeof this.players[deck].getDuration === 'function') {
                const current = this.players[deck].getCurrentTime();
                const duration = this.players[deck].getDuration();
                const now = Date.now();

                if (!duration) return;

                const BROADCAST_THROTTLE = this.turboEnabled ? 200 : 500;
                const TIMER_TICK = this.turboEnabled ? 50 : 100;

                // 1. Update LOCAL UI
                this.updateTimeUI(deck, current, duration);

                // 2. Broadcast Throttled
                if (now - lastBroadcastTime > BROADCAST_THROTTLE) {
                    this.broadcast({ type: 'TIME_UPDATE', deck, current, duration });
                    lastBroadcastTime = now;
                }

                // 3. Early Auto-Transition for smooth mixing
                if (this.autoPlayEnabled && !this.isProjector && !this.state[deck].handledEnd && !this.isAutoTransitioning) {
                    const remaining = duration - current;
                    // Trigger the 4s crossfade exactly 4 seconds before the track ends
                    if (remaining <= 4.0 && remaining > 0) {
                        logDebug(`Deck ${deck} approaching end (${remaining.toFixed(1)}s left). Triggering smooth transition.`);
                        this.state[deck].handledEnd = true;
                        this.transitionToNextDeck(deck);
                    }
                }

                // If interval needs adjustment, we'd need to restart it. 
                // For simplicity, we just use the current turboEnabled state for BROADCAST_THROTTLE
            }
        }, this.turboEnabled ? 200 : 500);
    }

    updateTimeUI(deck, current, duration) {
        if (!duration) return;

        const remaining = duration - current;
        const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
        const secs = Math.floor(remaining % 60).toString().padStart(2, '0');

        const el = document.getElementById(`time${deck}`);
        if (el) el.innerText = `-${mins}:${secs}`;

        // Update seek bar + Smart Chaining visual indicator for manual mixing
        const seekEl = document.getElementById(`seek${deck}`);
        if (seekEl && document.activeElement !== seekEl) {
            const pct = (current / duration) * 1000;
            seekEl.value = pct;

            // Show SponsorBlock endpoint as a gold marker on the seek bar (manual mode hint)
            if (!this.isProjector && this.smartChainingEnabled && this.state[deck].smartEndPoint && !this.autoPlayEnabled) {
                const endPct = (this.state[deck].smartEndPoint / duration) * 100;
                seekEl.style.background = `linear-gradient(to right,
                    #3f3f46 0%, #3f3f46 ${endPct - 0.5}%,
                    #f59e0b ${endPct - 0.5}%, #f59e0b ${endPct + 0.5}%,
                    #3f3f46 ${endPct + 0.5}%, #3f3f46 100%)`;
            } else {
                seekEl.style.background = '';
            }
        }

        // --- END-SCREEN SUPPRESSION (Only on Controller) ---
        if (!this.isProjector && !this.state[deck].transitioning) {
            let threshold = this.autoPlayEnabled ? this.autoNextThreshold : 1.0;
            let isSmartTrigger = false;

            // Smart Chaining Logic (only auto-triggers when Auto Next is enabled)
            if (this.autoPlayEnabled && this.smartChainingEnabled && this.state[deck].smartEndPoint) {
                if (current >= this.state[deck].smartEndPoint) {
                    logDebug(`Smart Chaining: Triggered by SponsorBlock segment at ${current.toFixed(1)}s`);
                    isSmartTrigger = true;
                    threshold = 0; // Trigger immediately
                }
            }

            // Manual mode visual hint: amber time display when within 30s of SponsorBlock endpoint
            if (!this.autoPlayEnabled && this.smartChainingEnabled && this.state[deck].smartEndPoint) {
                const timeEl = document.getElementById(`time${deck}`);
                if (timeEl) {
                    const distToEnd = this.state[deck].smartEndPoint - current;
                    if (distToEnd >= 0 && distToEnd < 30) {
                        timeEl.style.color = '#f59e0b'; // amber warning
                    } else {
                        timeEl.style.color = ''; // reset to CSS default
                    }
                }
            }

            if (isSmartTrigger || (remaining <= threshold && remaining > 0)) {
                const currentId = this.state[deck].videoId;
                if (this.state[deck].lastTransitionId === currentId) return;

                logDebug(`Transition Trigger: Deck ${deck} reaching threshold (${remaining.toFixed(2)}s).`);
                this.state[deck].lastTransitionId = currentId;
                this.state[deck].transitioning = true;
                this.state[deck].handledEnd = true;

                if (this.autoPlayEnabled && this.queuePlayIndex < this.queue.length) {
                    this.transitionToNextDeck(deck);
                } else {
                    // Fallback for non-autoplay or end of queue
                    this.players[deck].pauseVideo();
                    this.players[deck].stopVideo();
                    this.state[deck].transitioning = false; // Reset so timer can restart later
                    this.players[deck].cueVideoById(this.state[deck].videoId);
                    this.broadcast({ type: 'RESET_VIDEO', deck, videoId: this.state[deck].videoId });
                }
            }
        }
    }

    stopTimer(deck) {
        this.timerActive[deck] = false;
        if (this.timerInterval[deck]) {
            clearInterval(this.timerInterval[deck]);
            this.timerInterval[deck] = null;
        }
    }

    // --- UI UPDATES ---

    updateSafetyUI(deck, isPlaying) {
        const deckTitle = document.getElementById(`title${deck}`);
        const displayTitle = document.getElementById(`displayTitle${deck}`);

        const lockIcon = isPlaying ? '<i class="ph-fill ph-lock-key text-xs mr-1"></i> ' : '';
        const statusText = this.state[deck].title || (this.state[deck].videoId ? 'Piste chargée' : 'Aucune piste');

        if (deckTitle) {
            if (isPlaying) deckTitle.innerHTML = lockIcon + escapeHtml(this.state[deck].title || 'Lecture en cours');
            else deckTitle.innerText = statusText;
        }

        if (displayTitle) {
            // We don't always want the lock icon on the big display, but let's keep it consistent if desired
            displayTitle.innerText = statusText;
        }
    }

    // --- AUTO PLAY & TRANSITION ---

    transitionToNextDeck(endingDeck) {
        if (this.queuePlayIndex >= this.queue.length) return;

        // Mark as auto-transitioning to allow overlap
        this.isAutoTransitioning = true;

        const targetDeck = (endingDeck === 'A') ? 'B' : 'A';
        const targetState = this.state[targetDeck];

        this.pendingTransition = { endingDeck, targetDeck };

        logDebug(`Auto Transition Request: ${endingDeck} -> ${targetDeck} (queue pos ${this.queuePlayIndex})`);

        // Advance the play index
        const nextTrack = this.queue[this.queuePlayIndex];
        this.queuePlayIndex++;
        this.renderQueue();

        // 1. Ensure target deck is loaded
        if (targetState.videoId !== nextTrack.id) {
            logDebug(`Target deck ${targetDeck} not primed. Loading now.`);
            this.state[targetDeck].autoPlayNext = true;
            this.loadTrack(targetDeck, nextTrack.id, nextTrack.title, true);
        } else if (targetState.priming) {
            logDebug(`Target deck ${targetDeck} is STILL priming. Waiting...`);
            this.state[targetDeck].autoPlayNext = true;
        } else {
            // Already ready!
            this.triggerPendingTransition();
        }
    }

    triggerPendingTransition() {
        if (!this.pendingTransition) return;
        const { endingDeck, targetDeck } = this.pendingTransition;
        this.pendingTransition = null;

        logDebug(`Triggering Transition: ${endingDeck} -> ${targetDeck}`);

        // Ensure target is playing
        if (this.ready[targetDeck]) {
            this.players[targetDeck].playVideo();
            this.broadcast({ type: 'PLAY', deck: targetDeck });
            this.hidePrimingOverlay(targetDeck);
        }

        // Perform Crossfade
        const targetX = (targetDeck === 'A') ? 0 : 100;
        this.broadcast({ type: 'AUTO_TRANSITION_TRIGGER', targetDeck, targetX });

        const transitionDuration = 4000;
        this.animateCrossfade(targetX, transitionDuration);

        // Clean up
        setTimeout(() => {
            logDebug(`Auto Transition cleanup: Stopping ${endingDeck}`);
            this.isAutoTransitioning = false;
            this.players[endingDeck].pauseVideo();
            this.players[endingDeck].stopVideo();
            this.state[endingDeck].transitioning = false;
            this.applyVolumes();
        }, transitionDuration + 100);
    }

    animateCrossfade(targetX, duration = 500) {
        const startX = this.state.crossfader;
        const distance = targetX - startX;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function (ease-in-out)
            const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const currentX = startX + (distance * ease);

            // Update slider if it exists
            const slider = document.getElementById('crossfader');
            if (slider) slider.value = currentX;

            // Apply crossfade
            this.handleCrossfade(currentX);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    /**
     * Lookahead: If a deck is playing, prime the next track on the other deck.
     * Respects the 15-track artist separation rule.
     */
    async checkLookaheadPriming(activeDeck) {
        if (this.isProjector || !this.autoPlayEnabled) return;

        // If lookahead already done for this current track, skip
        if (this.state[activeDeck].lookaheadDone) return;

        const otherDeck = (activeDeck === 'A') ? 'B' : 'A';
        const otherState = this.state[otherDeck];

        // 1. Find a candidate that satisfies the artist separation rule
        let candidateIndex = -1;
        const remainingIndices = [];
        for (let i = this.queuePlayIndex; i < this.queue.length; i++) {
            remainingIndices.push(i);
        }

        if (this.shuffleEnabled && remainingIndices.length > 1) {
            // Shuffle approach: filter then pick random
            const validIndices = remainingIndices.filter(idx => {
                const { artist } = parseTrackInfo(this.queue[idx].title);
                return !this.recentArtists.some(a => a.toLowerCase() === artist.toLowerCase());
            });

            if (validIndices.length > 0) {
                candidateIndex = validIndices[Math.floor(Math.random() * validIndices.length)];
            } else {
                // FALLBACK 1: If shuffle is on but no track matches the artist rule, 
                // pick ANY random track from the remaining queue (don't force discovery yet)
                logDebug("Shuffle: Artist rule too strict. Relaxing and picking random from queue.");
                candidateIndex = remainingIndices[Math.floor(Math.random() * remainingIndices.length)];
            }
        } else if (remainingIndices.length > 0) {
            // Linear approach: find first valid
            candidateIndex = remainingIndices.find(idx => {
                const { artist } = parseTrackInfo(this.queue[idx].title);
                return !this.recentArtists.some(a => a.toLowerCase() === artist.toLowerCase());
            });

            // FALLBACK 2: If linear but no track matches artist rule, pick the very next one
            if (candidateIndex === -1 && remainingIndices.length > 0) {
                logDebug("Linear: Artist rule too strict. Relaxing and picking next track.");
                candidateIndex = remainingIndices[0];
            }
        }

        // 2. Fallback: ONLY trigger Discovery if the queue is actually empty
        if (candidateIndex === -1 && remainingIndices.length === 0) {
            logDebug("Queue finished. Triggering Discovery fallback...");
            showToast("Diversité musicale : Recherche d'une nouvelle pépite...", 'info');

            await this.discoverRandom();
            candidateIndex = this.queue.length - 1;
        }

        // 3. Swap the chosen candidate to the next position
        if (candidateIndex !== -1 && candidateIndex !== this.queuePlayIndex) {
            const nextTrack = this.queue[candidateIndex];
            this.queue.splice(candidateIndex, 1);
            this.queue.splice(this.queuePlayIndex, 0, nextTrack);
            this.renderQueue();
            this.saveQueues();
        }

        if (this.queuePlayIndex >= this.queue.length) return;
        const nextTrack = this.queue[this.queuePlayIndex];

        // 4. Only prime if the other deck is idle/empty and NOT currently priming
        if (!otherState.playing && !otherState.priming && (!otherState.videoId || otherState.videoId !== nextTrack.id)) {
            logDebug(`Lookahead: Priming ${nextTrack.title} on Deck ${otherDeck}`);
            this.loadTrack(otherDeck, nextTrack.id, nextTrack.title);

            // Mark as done for this deck so seeks don't trigger it again
            this.state[activeDeck].lookaheadDone = true;
        }
    }

    // --- DECK CONTROLS ---

    loadTrack(deck, videoId, title, force = false) {
        if (!this.players[deck]) return;

        // SAFETY CHECK
        if (this.state[deck].playing && !force) {
            showToast(`⚠️ Deck ${deck} en lecture ! Mettez en pause.`, 'error');
            if (!this.isProjector) {
                const deckEl = document.getElementById(`deckInfo${deck}`);
                if (deckEl) {
                    deckEl.classList.add('animate-bounce');
                    setTimeout(() => deckEl.classList.remove('animate-bounce'), 500);
                }
            }
            return;
        }

        this.state[deck].videoId = videoId;
        this.state[deck].title = title || videoId;
        this.state[deck].transitioning = false; // Reset transition flag
        this.state[deck].lookaheadDone = false; // Reset lookahead for this track

        try {
            const titleEl = document.getElementById(`title${deck}`);
            if (titleEl) {
                titleEl.innerText = "Chargement (Primage)...";
                titleEl.classList.remove('text-red-500');
            }

            // Set priming state
            this.state[deck].priming = true;
            this.applyVolumes(); // Mute immediately via state
            if (this.players[deck] && typeof this.players[deck].setVolume === 'function') {
                this.players[deck].setVolume(0);
            }

            // Show Priming Overlay
            this.showPrimingOverlay(deck, videoId, title);

            // Start video to trigger buffering/stream connection
            this.players[deck].loadVideoById({
                videoId: videoId,
                playerVars: { playlist: videoId, loop: 1 }
            });

            if (titleEl) titleEl.innerText = title || videoId;
            const timeEl = document.getElementById(`time${deck}`);
            if (timeEl) timeEl.innerText = "--:--";

            const seek = document.getElementById(`seek${deck}`);
            if (seek) seek.value = 0;

            // Update Monitor Cover if active
            const info = parseTrackInfo(this.state[deck].title);
            const cTitle = document.getElementById(`coverTitle${deck}`);
            const cArtist = document.getElementById(`coverArtist${deck}`);
            if (cTitle) cTitle.innerText = info.title || info.artist;
            if (cArtist) cArtist.innerText = info.title ? info.artist : "";

            // Update New UI metadata immediately
            const dTitle = document.getElementById(`displayTitle${deck}`);
            const dArtist = document.getElementById(`displayArtist${deck}`);
            if (dTitle) dTitle.innerText = info.title || info.artist;
            if (dArtist) dArtist.innerText = info.title ? info.artist : "";

            // --- SCREENSAVER VIGNETTE SYNC ---
            this.loadThumbnail(deck, videoId);

            const deckInfo = document.getElementById(`deckInfo${deck}`);
            deckInfo.classList.add('ring-2', 'ring-white');
            setTimeout(() => deckInfo.classList.remove('ring-2', 'ring-white'), 200);

            this.broadcast({ type: 'LOAD', deck, videoId, title: this.state[deck].title });

            // RECORD ARTIST (Controller only)
            if (!this.isProjector && title && title !== 'Aucune piste') {
                const { artist } = parseTrackInfo(title);
                if (artist) {
                    // Remove if already in list to move to end (freshen)
                    this.recentArtists = this.recentArtists.filter(a => a.toLowerCase() !== artist.toLowerCase());
                    this.recentArtists.push(artist);
                    if (this.recentArtists.length > this.MAX_RECENT_ARTISTS) {
                        this.recentArtists.shift();
                    }
                    logDebug(`Artist Rule: Recent artists history updated with "${artist}"`);
                }
            }

            // SponsorBlock lookahead
            if (this.smartChainingEnabled) {
                this.fetchSponsorBlockSegments(deck, videoId);
            }

        } catch (e) {
            logDebug(`Exception loading video: ${e.message}`);
            showToast(`Erreur de chargement: ${e.message}`, 'error');
        }
    }

    loadThumbnail(deck, videoId) {
        if (!videoId) {
            this.scrThumbnails[deck] = null;
            return;
        }
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
        const thumbImg = new Image();
        thumbImg.crossOrigin = "Anonymous";
        thumbImg.onerror = () => { this.scrThumbnails[deck] = null; };
        thumbImg.onload = () => { 
            this.scrThumbnails[deck] = thumbImg; 
        };
        thumbImg.src = thumbUrl;
    }

    togglePlay(deck) {
        if (!this.ready[deck]) return;
        const state = this.players[deck].getPlayerState();
        if (state === 1) {
            this.players[deck].pauseVideo();
            this.broadcast({ type: 'PAUSE', deck });
        } else {
            this.players[deck].playVideo();
            this.broadcast({ type: 'PLAY', deck });
        }
    }

    /**
     * Re-routed play call from HTML
     * @param {string} deck - 'A' or 'B'
     */
    play(deck) {
        this.togglePlay(deck);
    }

    cue(deck) {
        if (!this.ready[deck]) return;
        this.players[deck].pauseVideo();
        const start = this.state[deck].smartStartPoint || 0;
        this.players[deck].seekTo(start);
        this.broadcast({ type: 'CUE', deck, val: start });
    }

    setSpeed(deck, speed) {
        if (!this.ready[deck]) return;
        this.players[deck].setPlaybackRate(parseFloat(speed));
        this.broadcast({ type: 'SPEED', deck, val: speed });
    }

    /**
     * GLOBAL CONTROLS
     */

    globalPlay() {
        const activeDeck = (this.state.crossfader <= 50) ? 'A' : 'B';
        const otherDeck = (activeDeck === 'A') ? 'B' : 'A';

        if (this.ready[activeDeck] && this.state[activeDeck].videoId) {
            this.players[activeDeck].playVideo();
            this.broadcast({ type: 'PLAY', deck: activeDeck });

            // Exclusive Mode: Ensure the other deck is paused when we global play
            if (this.ready[otherDeck]) {
                this.players[otherDeck].pauseVideo();
                this.broadcast({ type: 'PAUSE', deck: otherDeck });
            }
        } else {
            showToast(`⚠️ Le Deck ${activeDeck} n'a aucune piste chargée.`, "info");
        }
    }

    globalStop() {
        if (confirm("Êtes-vous sûr de vouloir arrêter la lecture des vidéos ?")) {
            ['A', 'B'].forEach(deck => {
                if (this.ready[deck]) {
                    this.players[deck].pauseVideo();
                    this.broadcast({ type: 'PAUSE', deck });
                }
                this.state[deck].playing = false;
            });
            showToast("Lecture arrêtée.", "success");
        }
    }

    setVolume(deck, val) {
        this.state[deck].volume = parseInt(val);
        this.applyVolumes();
    }

    seek(deck, percent) {
        if (!this.ready[deck]) return;
        const duration = this.players[deck].getDuration();
        const newTime = (percent / 1000) * duration;

        this.players[deck].seekTo(newTime, true);
        this.broadcast({ type: 'SEEK', deck, time: newTime });
    }

    toggleMonitor(deck) {
        this.state[deck].monitor = !this.state[deck].monitor;
        const isHidden = !this.state[deck].monitor;
        const btn = document.getElementById(`btnMonitor${deck}`);
        if (!btn) return;

        const icon = btn.querySelector('i');
        icon.className = isHidden ? "ph-fill ph-eye-slash" : "ph-fill ph-eye";

        if (isHidden) {
            btn.classList.add('text-dj-warning', 'border-dj-warning');
        } else {
            btn.classList.remove('text-dj-warning', 'border-dj-warning');
        }

        // Finalize state via priming overlay logic (which now handles the new UI)
        if (this.state[deck].priming) {
            this.showPrimingOverlay(deck, this.state[deck].videoId, this.state[deck].title);
        } else {
            this.hidePrimingOverlay(deck);
        }
    }

    updatePrimingOverlayStatus(deck, statusText) {
        const deckInfo = document.getElementById(`deckInfo${deck}`);
        if (!deckInfo) return;

        const statusIcon = deckInfo.querySelector(`#statusIcon${deck} i`);
        if (statusIcon) {
            statusIcon.className = "ph-fill ph-check-circle text-4xl text-green-400 bounce-in";
            statusIcon.classList.remove('animate-pulse');
        }

        const liveIndicator = document.getElementById(`liveIndicator${deck}`);
        if (liveIndicator) liveIndicator.classList.add('opacity-100');
    }

    showPrimingOverlay(deck, videoId, title) {
        logDebug(`Showing Priming Overlay for ${deck}`);
        if (this.isProjector) {
            const projOverlay = document.getElementById(`projPriming${deck}`);
            const projTitle = document.getElementById(`projTitle${deck}`);
            const projArtist = document.getElementById(`projArtist${deck}`);

            if (projOverlay) {
                const info = parseTrackInfo(title || "");
                if (projTitle) projTitle.innerText = info.title || info.artist || "CHARGEMENT";
                if (projArtist) projArtist.innerText = info.title ? info.artist : "PISTE";
                projOverlay.classList.remove('hidden');
            }
            return;
        }

        const deckInfo = document.getElementById(`deckInfo${deck}`);
        if (!deckInfo) return;

        const info = parseTrackInfo(title || "");
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

        // Update Background Thumbnail
        const bgThumb = document.getElementById(`bgThumb${deck}`);
        if (bgThumb) {
            bgThumb.style.backgroundImage = `url('${thumbUrl}')`;
            bgThumb.classList.remove('opacity-30');
            bgThumb.classList.add('opacity-50');
        }

        // Update Display Metadata
        const displayArtist = document.getElementById(`displayArtist${deck}`);
        const displayTitle = document.getElementById(`displayTitle${deck}`);

        if (displayArtist) displayArtist.innerText = info.artist || "ARTISTE INCONNU";
        if (displayTitle) displayTitle.innerText = info.title || info.artist || "PISTE CHARGÉE";

        // Reset Status Icon
        const statusIcon = deckInfo.querySelector(`#statusIcon${deck} i`);
        if (statusIcon) {
            statusIcon.className = "ph-fill ph-spinner-gap text-4xl animate-spin text-dj-neon";
            if (deck === 'B') statusIcon.classList.replace('text-dj-neon', 'text-dj-warning');
        }

        // Hide Live Indicator during priming
        const liveIndicator = document.getElementById(`liveIndicator${deck}`);
        if (liveIndicator) liveIndicator.classList.remove('opacity-100');
    }

    hidePrimingOverlay(deck) {
        if (this.isProjector) {
            logDebug(`Hiding Priming Overlay for ${deck}`);
            const projOverlay = document.getElementById(`projPriming${deck}`);
            if (projOverlay) {
                projOverlay.classList.add('hidden');
            }
            return;
        }

        // No longer "hiding" a cover, just updating the visual state of the deck info display
        const liveIndicator = document.getElementById(`liveIndicator${deck}`);
        if (liveIndicator) liveIndicator.classList.add('opacity-100');

        const statusIconNode = document.getElementById(`statusIcon${deck}`);
        const statusIcon = statusIconNode ? statusIconNode.querySelector('i') : null;
        if (statusIcon) {
            statusIcon.className = "ph-fill ph-disc text-4xl " + (deck === 'A' ? 'text-dj-neon animate-spin-slow' : 'text-dj-warning animate-spin-slow');
        }
    }

    // --- CROSSFADER & VOLUMES ---

    handleCrossfade(val) {
        const prev = this.state.crossfader;
        const next = parseInt(val);
        this.state.crossfader = next;

        // Exclusive Play Swapping & Fader Start
        if (!this.isProjector) {
            const isAnyPlaying = this.state.A.playing || this.state.B.playing;

            // If anything is playing, or if Fader Start is explicitly enabled
            if (isAnyPlaying || this.faderStartEnabled) {
                // Crossing from A to B
                if (prev <= 50 && next > 50) {
                    if (this.ready.B) {
                        this.players.B.playVideo();
                        this.broadcast({ type: 'PLAY', deck: 'B' });
                    }
                    if (!this.isAutoTransitioning && this.ready.A) {
                        this.players.A.pauseVideo();
                        this.broadcast({ type: 'PAUSE', deck: 'A' });
                    }
                }
                // Crossing from B to A
                if (prev >= 50 && next < 50) {
                    if (this.ready.A) {
                        this.players.A.playVideo();
                        this.broadcast({ type: 'PLAY', deck: 'A' });
                    }
                    if (!this.isAutoTransitioning && this.ready.B) {
                        this.players.B.pauseVideo();
                        this.broadcast({ type: 'PAUSE', deck: 'B' });
                    }
                }
            }
        }

        this.applyVolumes();
        this.broadcast({ type: 'CROSSFADE', val: next });
        this.updateDeckSwitchUI(next);
        this.updateOnAirGlow(next);
    }

    updateOnAirGlow(x) {
        if (this.isProjector) return;
        const deckA = document.getElementById('deckInfoA');
        const deckB = document.getElementById('deckInfoB');
        if (!deckA || !deckB) return;

        if (x <= 50) {
            deckA.classList.add('on-air-glow');
            deckB.classList.remove('on-air-glow');
        } else {
            deckA.classList.remove('on-air-glow');
            deckB.classList.add('on-air-glow');
        }
    }

    switchDeck(deck) {
        const val = (deck === 'A') ? 0 : 100;
        this.handleCrossfade(val);
    }

    updateDeckSwitchUI(val) {
        const btnA = document.getElementById('btnSwitchA');
        const btnB = document.getElementById('btnSwitchB');
        const slider = document.getElementById('deckSwitchSlider');
        if (!btnA || !btnB || !slider) return;

        if (val <= 50) {
            btnA.classList.add('active');
            btnB.classList.remove('active');
            slider.style.left = '4px';
        } else {
            btnA.classList.remove('active');
            btnB.classList.add('active');
            slider.style.left = 'calc(50% + 2px)';
        }
    }

    applyVolumes() {
        let fadeA = 1;
        let fadeB = 1;
        const x = this.state.crossfader;

        // Audio Fading (Power Curve)
        if (x < 50) {
            fadeB = (x / 50);
        } else {
            fadeA = (100 - x) / 50;
        }

        const targetVolA = this.state.A.priming ? 0 : (this.state.A.volume * fadeA);
        const targetVolB = this.state.B.priming ? 0 : (this.state.B.volume * fadeB);

        // Video Opacity (Asymmetrical Blend to prevent ghosting/dimming)
        // at x=0   -> A=1, B=0  (A is bottom, B is top)
        // at x=25  -> A=1, B=0.5
        // at x=50  -> A=1, B=1   (B is now top)
        // at x=75  -> A=0.5, B=1
        // at x=100 -> A=0, B=1

        const opA = (x <= 50) ? 1 : (100 - x) / 50;
        const opB = (x >= 50) ? 1 : x / 50;

        if (this.isProjector) {
            const elA = document.getElementById('pA');
            const elB = document.getElementById('pB');

            // Logic: A deck should only be visible if it has a video OR is priming
            const hasVideoA = this.state.A.videoId && this.state.A.videoId !== '';
            const hasVideoB = this.state.B.videoId && this.state.B.videoId !== '';

            if (elA) {
                const finalOpA = hasVideoA ? opA : 0;
                elA.style.opacity = finalOpA;
                elA.style.zIndex = (x <= 50) ? 20 : 10;
                elA.style.display = (finalOpA > 0.01) ? 'block' : 'none';

                if (finalOpA > 0.5 && !this.state.A.priming && this.state.A.playing) {
                    this.hidePrimingOverlay('A');
                }
            }
            if (elB) {
                const finalOpB = hasVideoB ? opB : 0;
                elB.style.opacity = finalOpB;
                elB.style.zIndex = (x > 50) ? 20 : 10;
                elB.style.display = (finalOpB > 0.01) ? 'block' : 'none';

                if (finalOpB > 0.5 && !this.state.B.priming && this.state.B.playing) {
                    this.hidePrimingOverlay('B');
                }
            }

            if (this.ready.A) this.players.A.setVolume(this.state.audioOutput === 'projector' ? targetVolA : 0);
            if (this.ready.B) this.players.B.setVolume(this.state.audioOutput === 'projector' ? targetVolB : 0);

        } else {
            if (this.ready.A) this.players.A.setVolume(this.state.audioOutput === 'local' ? targetVolA : 0);
            if (this.ready.B) this.players.B.setVolume(this.state.audioOutput === 'local' ? targetVolB : 0);
        }
    }

    // --- SYNC ---

    broadcast(msg) {
        // Projector only broadcasts REQUEST_STATE and TIME_UPDATE
        const allowedTypes = ['REQUEST_STATE', 'TIME_UPDATE'];
        if (this.isProjector && !allowedTypes.includes(msg.type)) return;
        this.syncChannel.postMessage(msg);
    }

    handleSyncMessage(msg) {
        logDebug("Sync Msg: " + msg.type);

        if (!this.isProjector) {
            if (msg.type === 'REQUEST_STATE') {
                logDebug("Projector requests sync. Sending state...");
                this.broadcast({
                    type: 'SYNC_STATE',
                    state: {
                        A: {
                            videoId: this.state.A.videoId,
                            time: (this.players.A && typeof this.players.A.getCurrentTime === 'function') ? this.players.A.getCurrentTime() : 0,
                            playing: this.state.A.playing
                        },
                        B: {
                            videoId: this.state.B.videoId,
                            time: (this.players.B && typeof this.players.B.getCurrentTime === 'function') ? this.players.B.getCurrentTime() : 0,
                            playing: this.state.B.playing
                        },
                        crossfader: this.state.crossfader,
                        audioOutput: this.state.audioOutput,
                        autoPlay: this.autoPlayEnabled,
                        zoomActive: this.state.zoomActive,
                        scrSyncVideo: this.state.scrSyncVideo
                    }
                });
            } else if (msg.type === 'TIME_UPDATE') {
                // Sync Controller UI to Projector time
                this.updateTimeUI(msg.deck, msg.current, msg.duration);
            }
            return;
        }

        // Projector Logic
        switch (msg.type) {
            case 'SYNC_STATE':
                logDebug("Projector: Received Full State Sync");
                if (this.handshakeInterval) {
                    clearInterval(this.handshakeInterval);
                    this.handshakeInterval = null;
                }
                this.state.audioOutput = msg.state.audioOutput || 'local';
                if (msg.state.A) this.state.A.videoId = msg.state.A.videoId;
                if (msg.state.B) this.state.B.videoId = msg.state.B.videoId;
                this.applyFullSync(msg.state);
                break;
            case 'LOAD':
                if (this.players[msg.deck]) {
                    this.state[msg.deck].videoId = msg.videoId;
                    this.state[msg.deck].title = msg.title || msg.videoId;
                    this.state[msg.deck].transitioning = false;
                    this.state[msg.deck].autoPlayNext = msg.autoPlayNext || false;

                    this.state[msg.deck].priming = true;
                    this.applyVolumes(); // Mute immediately
                    if (typeof this.players[msg.deck].setVolume === 'function') {
                        this.players[msg.deck].setVolume(0);
                    }

                    this.showPrimingOverlay(msg.deck, msg.videoId, this.state[msg.deck].title);
                    this.loadThumbnail(msg.deck, msg.videoId); // Pre-load thumbnail on projector
                    this.players[msg.deck].loadVideoById({
                        videoId: msg.videoId,
                        playerVars: {
                            playlist: msg.videoId,
                            loop: 1,
                            rel: 0,
                            modestbranding: 1
                        }
                    });
                }
                break;
            case 'AUTO_PLAY_TRIGGER':
                if (this.players[msg.deck]) {
                    this.state[msg.deck].videoId = msg.videoId;
                    this.state[msg.deck].title = msg.title || msg.videoId;
                    this.state[msg.deck].transitioning = false;
                    this.state[msg.deck].autoPlayNext = true;
                    this.state[msg.deck].priming = true;

                    this.applyVolumes(); // Mute immediately
                    if (typeof this.players[msg.deck].setVolume === 'function') {
                        this.players[msg.deck].setVolume(0);
                    }

                    this.showPrimingOverlay(msg.deck, msg.videoId, this.state[msg.deck].title);
                    this.loadThumbnail(msg.deck, msg.videoId); // Pre-load thumbnail on projector
                    this.players[msg.deck].loadVideoById({
                        videoId: msg.videoId,
                        playerVars: {
                            playlist: msg.videoId,
                            loop: 1,
                            rel: 0,
                            modestbranding: 1
                        }
                    });
                }
                break;
            case 'AUTO_TRANSITION_TRIGGER':
                logDebug(`Projector: Auto Transition received for Deck ${msg.targetDeck}`);
                if (this.players[msg.targetDeck]) {
                    this.state[msg.targetDeck].autoPlayNext = true;
                    // If already ready, start now
                    if (!this.state[msg.targetDeck].priming && this.ready[msg.targetDeck]) {
                        this.players[msg.targetDeck].playVideo();
                        this.hidePrimingOverlay(msg.targetDeck);
                    }
                    this.animateCrossfade(msg.targetX);
                }
                break;
            case 'PLAY':
                if (this.players[msg.deck]) {
                    if (this.primingTimeouts[msg.deck]) {
                        clearTimeout(this.primingTimeouts[msg.deck]);
                        this.primingTimeouts[msg.deck] = null;
                    }
                    this.state[msg.deck].priming = false;
                    this.players[msg.deck].playVideo();
                    this.hidePrimingOverlay(msg.deck);
                }
                break;
            case 'PAUSE':
                if (this.players[msg.deck]) {
                    if (this.primingTimeouts[msg.deck]) {
                        clearTimeout(this.primingTimeouts[msg.deck]);
                        this.primingTimeouts[msg.deck] = null;
                    }
                    this.players[msg.deck].pauseVideo();
                }
                break;
            case 'CUE':
                if (this.players[msg.deck]) {
                    if (this.primingTimeouts[msg.deck]) {
                        clearTimeout(this.primingTimeouts[msg.deck]);
                        this.primingTimeouts[msg.deck] = null;
                    }
                    this.state[msg.deck].priming = false;
                    this.players[msg.deck].pauseVideo();
                    this.players[msg.deck].seekTo(msg.val || 0);
                    this.updatePrimingOverlayStatus(msg.deck, "Prêt (Cue)");
                }
                break;
            case 'RESET_VIDEO':
                if (this.players[msg.deck]) {
                    this.players[msg.deck].stopVideo();
                    this.players[msg.deck].cueVideoById({
                        videoId: msg.videoId,
                        startSeconds: msg.val || 0
                    });
                }
                break;
            case 'SEEK':
                if (this.players[msg.deck]) {
                    this.players[msg.deck].seekTo(msg.time, true);
                }
                break;
            case 'SPEED':
                if (this.players[msg.deck]) this.players[msg.deck].setPlaybackRate(parseFloat(msg.val));
                break;
            case 'CROSSFADE':
                this.handleCrossfade(msg.val);
                break;
            case 'AUDIO_OUTPUT':
                this.state.audioOutput = msg.val;
                this.applyVolumes();
                break;
            case 'SYNC_TIME_FORCED':
                // Used for drift correction if needed
                if (this.players[msg.deck]) this.players[msg.deck].seekTo(msg.time, true);
                break;
            case 'THEME':
                this.applyTheme(msg.name);
                break;
            case 'TOGGLE_SCREENSAVER':
                this.toggleScreenSaver(true); // Forced from message
                break;
            case 'SET_SCREENSAVER_MODE':
                this.setScreenSaverMode(msg.mode);
                const modSelect = document.getElementById('screenSaverModeSelect');
                if (modSelect) modSelect.value = msg.mode;
                break;
            case 'SET_SCREENSAVER_TEXT':
                this.setScreenSaverText(msg.val);
                break;
            case 'SET_SCREENSAVER_FONT':
                this.setScreenSaverFont(msg.val);
                break;
            case 'SET_SCREENSAVER_COLOR':
                this.setScreenSaverColor(msg.val);
                break;
            case 'SET_SCREENSAVER_ANIM':
                this.setScreenSaverAnim(msg.val);
                break;
            case 'SET_SCREENSAVER_IMAGES':
                this.scrImages = msg.val.map(url => {
                    const img = new Image();
                    img.src = url;
                    return img;
                });
                const cEl = document.getElementById('scrImageCount');
                if (cEl) cEl.innerText = `${this.scrImages.length} images`;
                break;
            case 'SET_SCREENSAVER_SYNC_VIDEO':
                this.setScreenSaverSyncVideo(msg.val);
                break;
            case 'TOGGLE_ZOOM':
                this.state.zoomActive = msg.active;
                this.applyZoom();
                break;
        }
    }

    applyFullSync(state) {
        if (!this.ready.A || !this.ready.B) {
            this.pendingState = state;
            logDebug("Sync cached (waiting for players)");
            return;
        }
        if (state.A) this.syncDeckState('A', state.A);
        if (state.B) this.syncDeckState('B', state.B);
        if (state.crossfader !== undefined) this.handleCrossfade(state.crossfader);
        if (state.zoomActive !== undefined) {
            this.state.zoomActive = state.zoomActive;
            this.applyZoom();
        }
        if (state.scrSyncVideo !== undefined) {
            this.setScreenSaverSyncVideo(state.scrSyncVideo);
        }
    }

    syncDeckState(deck, stateData) {
        if (!stateData || !stateData.videoId) return;

        const player = this.players[deck];

        this.state[deck].priming = !stateData.playing; // Priming if not already playing

        if (this.state[deck].priming) {
            this.showPrimingOverlay(deck, stateData.videoId, stateData.title || stateData.videoId);
        }

        this.loadThumbnail(deck, stateData.videoId); // Load thumbnail on projector sync

        player.loadVideoById({
            videoId: stateData.videoId,
            startSeconds: stateData.time || 0
        });

        if (stateData.playing) {
            this.state[deck].priming = false;
            this.hidePrimingOverlay(deck);
            setTimeout(() => player.playVideo(), 200);
        } else {
            logDebug(`Projector: Priming ${deck} at ${stateData.time || 0}s`);
        }

        logDebug(`Projector: synced ${deck} at ${stateData.time || 0}s (Playing: ${stateData.playing})`);
    }

    openProjector() {
        console.log("DJMixer.openProjector() called");
        // Use Electron API to open a frameless window
        if (window.electronAPI && window.electronAPI.openProjector) {
            try {
                // Safer URL construction avoiding double slashes or missing ones
                let baseUrl = window.location.origin + window.location.pathname;
                if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
                if (!baseUrl.endsWith('index.html')) baseUrl += '/index.html';
                const url = baseUrl + '?mode=projector';

                console.log("Opening Projector via IPC:", url);
                window.electronAPI.openProjector(url);
                showToast("Lancement du projecteur...", 'info');
            } catch (err) {
                console.error("IPC openProjector error:", err);
                showToast("Erreur lancement projecteur (IPC)", 'error');
            }
        } else {
            console.log("Electronic API not found, using window.open fallback");
            // Fallback for standard browser
            window.open(
                window.location.origin + window.location.pathname + '?mode=projector',
                'DJProjector',
                'width=1280,height=720,location=no,menubar=no,toolbar=no,status=no,scrollbars=no'
            );
        }
    }

    // --- QUEUE MANAGEMENT ---

    async addToQueue(url) {
        const id = extractVideoID(url);
        if (!id) {
            showToast("Lien YouTube invalide", 'error');
            return;
        }

        // DUPLICATE CHECK
        if (this.queue.some(track => track.id === id)) {
            showToast("Cette vidéo est déjà dans la liste", 'warning');
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = "";
            return;
        }

        let title = `Piste ${id}`;

        try {
            const btn = document.getElementById('addToQueueBtn');
            if (btn) btn.innerText = "...";
            const response = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${id}`);
            const data = await response.json();
            if (data.title) title = data.title;
        } catch (e) {
            logDebug("Failed to fetch title: " + e.message);
        } finally {
            const btn = document.getElementById('addToQueueBtn');
            if (btn) btn.innerText = "Ajouter";
        }

        const track = {
            id: id,
            title: title,
            thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`
        };

        this.queue.push(track);
        this.renderQueue();
        this.saveQueues(); // Persistent save for all tabs

        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = "";

        showToast(`Ajouté à "${this.queueNames[this.activeQueueIndex]}"`, 'success');
    }

    // --- YOUTUBE SEARCH ---

    /**
     * Random Discovery: Pick a random term, search, and pick a random result.
     * @param {string} deck - Optional target deck (A or B), otherwise adds to queue
     */
    async discoverRandom(deck = null) {
        const term = DISCOVERY_TERMS[Math.floor(Math.random() * DISCOVERY_TERMS.length)];
        logDebug(`Discovery: Searching for "${term}"...`);
        showToast(`Découverte: ${term}...`, 'info');

        try {
            const results = await this.searchYouTube(term);
            if (!results || results.length === 0) {
                showToast("Désolé, rien trouvé pour cette découverte.", 'error');
                return;
            }

            // Pick a random result from the first 10
            const maxResults = Math.min(results.length, 10);
            const randomResult = results[Math.floor(Math.random() * maxResults)];

            if (deck) {
                this.loadTrack(deck, randomResult.id, randomResult.title);
            } else {
                this.queue.push({
                    id: randomResult.id,
                    title: randomResult.title,
                    thumbnail: randomResult.thumbnail
                });
                this.renderQueue();
                this.saveQueues();
                showToast(`Ajouté à la queue : ${randomResult.title}`, 'success');
            }
        } catch (e) {
            logDebug(`Discovery error: ${e.message}`);
            showToast("Erreur lors de la découverte musicale.", 'error');
        }
    }

    /**
     * Search YouTube with caching
     * @param {string} query - Search query
     * @returns {Array} Search results
     */
    async searchYouTube(query) {
        if (!query || query.trim().length < 2) return [];

        query = query.trim();
        logDebug(`Searching YouTube for: ${query}`);

        // Check cache first
        const cached = this.getFromSearchCache(query);
        if (cached) {
            logDebug(`Using cached results for: ${query}`);
            return cached;
        }

        try {
            const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=10&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`;

            const response = await fetch(url);

            if (!response.ok) {
                if (response.status === 403) {
                    showToast("Quota YouTube dépassé. Utilisez un lien direct.", 'error');
                    logDebug("YouTube API quota exceeded");
                    return [];
                }
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.items || data.items.length === 0) {
                logDebug("No results found");
                return [];
            }

            // Transform results
            const results = data.items.map(item => ({
                id: item.id.videoId,
                title: item.snippet.title,
                channel: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails.medium.url,
                publishedAt: item.snippet.publishedAt
            }));

            // Save to cache
            this.saveToSearchCache(query, results);

            logDebug(`Found ${results.length} results`);
            return results;

        } catch (e) {
            logDebug(`Search error: ${e.message}`);
            showToast("Erreur de recherche", 'error');
            return [];
        }
    }

    /**
     * Get results from cache
     * @param {string} query - Search query
     * @returns {Array|null} Cached results or null
     */
    getFromSearchCache(query) {
        try {
            const cache = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}');
            const entry = cache[query.toLowerCase()];

            if (!entry) return null;

            // Check expiry
            const now = Date.now();
            const age = now - entry.timestamp;
            const maxAge = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

            if (age > maxAge) {
                logDebug(`Cache expired for: ${query}`);
                return null;
            }

            // Increment hit counter
            entry.hits = (entry.hits || 0) + 1;
            cache[query.toLowerCase()] = entry;
            localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));

            return entry.results;
        } catch (e) {
            logDebug(`Cache read error: ${e.message}`);
            return null;
        }
    }

    /**
     * Save results to cache
     * @param {string} query - Search query
     * @param {Array} results - Search results
     */
    saveToSearchCache(query, results) {
        try {
            let cache = JSON.parse(localStorage.getItem(SEARCH_CACHE_KEY) || '{}');

            // Add new entry
            cache[query.toLowerCase()] = {
                query: query,
                timestamp: Date.now(),
                results: results,
                hits: 1
            };

            // Limit cache size (LRU - Least Recently Used)
            const entries = Object.entries(cache);
            if (entries.length > MAX_CACHE_ITEMS) {
                // Sort by hits (ascending) and timestamp (oldest first)
                entries.sort((a, b) => {
                    const hitsA = a[1].hits || 0;
                    const hitsB = b[1].hits || 0;
                    if (hitsA !== hitsB) return hitsA - hitsB;
                    return a[1].timestamp - b[1].timestamp;
                });

                // Remove oldest/least used entries
                const toKeep = entries.slice(-MAX_CACHE_ITEMS);
                cache = Object.fromEntries(toKeep);
            }

            localStorage.setItem(SEARCH_CACHE_KEY, JSON.stringify(cache));
            logDebug(`Cached results for: ${query}`);
        } catch (e) {
            logDebug(`Cache write error: ${e.message}`);
        }
    }

    /**
     * Render search results
     * @param {Array} results - Search results
     */
    renderSearchResults(results) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        if (!results || results.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.innerHTML = '';
        container.classList.remove('hidden');

        const query = document.getElementById('searchInput').value;

        results.forEach(result => {
            const item = document.createElement('div');
            item.className = 'search-result-item';

            item.innerHTML = `
                <img src="${result.thumbnail}" alt="${escapeHtml(result.title)}" class="search-result-thumbnail">
                <div class="search-result-info">
                    <div class="search-result-title">${highlightText(result.title, query)}</div>
                    <div class="search-result-channel">${highlightText(result.channel, query)}</div>
                </div>
                <div class="search-result-actions">
                    <button class="search-result-btn-queue" title="Ajouter à la queue">
                        <i class="ph-fill ph-plus"></i>
                    </button>
                    <button class="search-result-btn-deck-a" title="Charger sur Deck A">
                        <span class="text-xs font-bold">A</span>
                    </button>
                    <button class="search-result-btn-deck-b" title="Charger sur Deck B">
                        <span class="text-xs font-bold">B</span>
                    </button>
                </div>
            `;

            // Event listeners
            const btnQueue = item.querySelector('.search-result-btn-queue');
            const btnDeckA = item.querySelector('.search-result-btn-deck-a');
            const btnDeckB = item.querySelector('.search-result-btn-deck-b');

            btnQueue.onclick = () => {
                if (this.queue.some(t => t.id === result.id)) {
                    showToast("Cette vidéo est déjà dans la liste", 'warning');
                    return;
                }
                this.queue.push({
                    id: result.id,
                    title: result.title,
                    thumbnail: result.thumbnail
                });
                this.renderQueue();
                this.saveQueues(); // Changed to saveQueues
                showToast("Ajouté à la queue", 'success');
                container.classList.add('hidden');
            };

            btnDeckA.onclick = () => {
                this.loadTrack('A', result.id, result.title);
                container.classList.add('hidden');
            };

            btnDeckB.onclick = () => {
                this.loadTrack('B', result.id, result.title);
                container.classList.add('hidden');
            };

            container.appendChild(item);
        });
    }

    /**
     * Handle search input with debouncing
     * @param {string} value - Input value
     */
    handleSearchInput(value) {
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Check if it's a URL (any http link that yields a valid video ID)
        const videoId = extractVideoID(value);
        if (videoId && (value.includes('http') || value.includes('youtu'))) {
            // It's a URL, hide search results
            const container = document.getElementById('searchResults');
            if (container) container.classList.add('hidden');
            return;
        }

        // Debounce search
        this.searchTimeout = setTimeout(async () => {
            if (value.trim().length < 2) {
                const container = document.getElementById('searchResults');
                if (container) container.classList.add('hidden');
                return;
            }

            if (this.searchMode === 'playlists') {
                const results = await this.searchYouTubePlaylists(value);
                this.renderPlaylistResults(results);
            } else {
                const results = await this.searchYouTube(value);
                this.renderSearchResults(results);
            }
        }, 500); // Wait 500ms after user stops typing
    }

    async searchYouTube(query) {
        if (!query || query.trim().length < 2) return [];

        query = query.trim();
        logDebug(`Searching YouTube (Scraping) for: ${query}`);

        // Check cache first
        const cached = this.getFromSearchCache(query);
        if (cached) {
            logDebug(`Using cached results for: ${query}`);
            return cached;
        }

        try {
            const results = await window.electronAPI.youtubeSearch(query);

            if (!results || results.length === 0) {
                logDebug("No results found via scraping");
                return [];
            }

            // Transform results to match existing internal format
            const formattedResults = results.map(v => ({
                id: v.id,
                title: v.title,
                channel: v.author,
                thumbnail: v.thumbnail,
                publishedAt: new Date().toISOString()
            }));

            // Save to cache
            this.saveToSearchCache(query, formattedResults);

            logDebug(`Found ${formattedResults.length} results via scraping`);
            return formattedResults;

        } catch (e) {
            logDebug(`Scraping search error: ${e.message}`);
            showToast("Erreur de recherche (scraping)", 'error');
            return [];
        }
    }

    // --- PLAYLIST SEARCH ---

    /**
     * Search YouTube playlists
     * @param {string} query - Search query
     * @returns {Array} Playlist results
     */
    async searchYouTubePlaylists(query) {
        if (!query || query.trim().length < 2) return [];

        query = query.trim();
        logDebug(`Searching YouTube playlists (Scraping) for: ${query}`);

        // Check cache first
        const cacheKey = `playlist_${query}`;
        const cached = this.getFromSearchCache(cacheKey);
        if (cached) {
            logDebug(`Using cached playlist results for: ${query}`);
            return cached;
        }

        try {
            const results = await window.electronAPI.youtubePlaylist(query);

            if (!results || results.length === 0) {
                logDebug("No playlist results found via scraping");
                return [];
            }

            // Transform results
            const formattedResults = results.map(p => ({
                id: p.id,
                title: p.title,
                channel: p.author,
                thumbnail: p.thumbnail,
                description: `Pistes: ${p.count}`
            }));

            // Save to cache
            this.saveToSearchCache(cacheKey, formattedResults);

            logDebug(`Found ${formattedResults.length} playlists via scraping`);
            return formattedResults;

        } catch (e) {
            logDebug(`Playlist scraping error: ${e.message}`);
            showToast("Erreur de recherche de playlists", 'error');
            return [];
        }
    }

    /**
     * Get videos from a playlist
     * @param {string} playlistId - Playlist ID
     * @returns {Array} Video list
     */
    async getPlaylistVideos(playlistId) {
        logDebug(`Fetching videos from playlist (Scraping): ${playlistId}`);

        try {
            const results = await window.electronAPI.getPlaylistVideos(playlistId);

            if (!results || results.length === 0) {
                logDebug("No videos found in playlist via scraping");
                return [];
            }

            // Transform to queue format
            const videos = results.map(v => ({
                id: v.id,
                title: v.title,
                thumbnail: v.thumbnail
            }));

            logDebug(`Found ${videos.length} videos in playlist via scraping`);
            return videos;

        } catch (e) {
            logDebug(`getPlaylistVideos scraping error: ${e.message}`);
            showToast("Erreur lors de la récupération des vidéos", 'error');
            return [];
        }
    }

    /**
     * Import entire playlist to queue
     * @param {string} playlistId - Playlist ID
     * @param {string} playlistTitle - Playlist title
     */
    async importPlaylist(playlistId, playlistTitle) {
        showToast(`⏳ Importation de "${playlistTitle}"...`, 'info');

        const videos = await this.getPlaylistVideos(playlistId);

        if (videos.length === 0) {
            showToast("Aucune vidéo trouvée dans cette playlist", 'error');
            return;
        }

        // Add all videos to queue (avoiding duplicates)
        let addedCount = 0;
        videos.forEach(video => {
            if (!this.queue.some(t => t.id === video.id)) {
                this.queue.push(video);
                addedCount++;
            }
        });

        if (addedCount === 0) {
            showToast("Toutes les vidéos sont déjà présentes dans la liste", 'warning');
            return;
        }

        this.renderQueue();
        this.saveQueues();

        // Hide search results
        const container = document.getElementById('searchResults');
        if (container) container.classList.add('hidden');

        showToast(`✅ ${videos.length} pistes ajoutées depuis "${playlistTitle}"`, 'success');
        logDebug(`Imported ${videos.length} videos from playlist ${playlistId}`);
    }

    /**
     * Render playlist search results
     * @param {Array} playlists - Playlist results
     */
    renderPlaylistResults(playlists) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        if (!playlists || playlists.length === 0) {
            container.classList.add('hidden');
            return;
        }

        container.innerHTML = '';
        container.classList.remove('hidden');

        const query = document.getElementById('searchInput').value;

        playlists.forEach(playlist => {
            const item = document.createElement('div');
            item.className = 'search-result-item playlist-result-item';

            item.innerHTML = `
                <img src="${playlist.thumbnail}" alt="${escapeHtml(playlist.title)}" class="search-result-thumbnail">
                <div class="search-result-info">
                    <div class="search-result-title">
                        <i class="ph-fill ph-playlist text-dj-neon"></i>
                        ${highlightText(playlist.title, query)}
                    </div>
                    <div class="search-result-channel">${highlightText(playlist.channel, query)}</div>
                </div>
                <div class="search-result-actions">
                    <button class="search-result-btn-import" title="Importer toute la playlist">
                        <i class="ph-fill ph-download-simple"></i>
                    </button>
                </div>
            `;

            // Event listener for import
            const btnImport = item.querySelector('.search-result-btn-import');
            btnImport.onclick = () => {
                this.importPlaylist(playlist.id, playlist.title);
            };

            container.appendChild(item);
        });
    }

    /**
     * Toggle search mode between videos and playlists
     * @param {string} mode - 'videos' or 'playlists'
     */
    setSearchMode(mode) {
        this.searchMode = mode;
        const btnVideos = document.getElementById('searchModeVideos');
        const btnPlaylists = document.getElementById('searchModePlaylists');

        if (mode === 'videos') {
            if (btnVideos) btnVideos.classList.add('active');
            if (btnPlaylists) btnPlaylists.classList.remove('active');
            document.getElementById('searchInput').placeholder = "Rechercher sur YouTube ou coller un lien...";
        } else {
            if (btnVideos) btnVideos.classList.remove('active');
            if (btnPlaylists) btnPlaylists.classList.add('active');
            document.getElementById('searchInput').placeholder = "Rechercher une playlist YouTube...";
        }
        logDebug(`Search Mode: ${mode}`);

        // Clear search results
        const container = document.getElementById('searchResults');
        if (container) container.classList.add('hidden');

        // Clear search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.value = '';
    }

    // --- QUEUE MANAGEMENT (Multi-Tabs) ---

    renderQueueTabs() {
        const container = document.getElementById('queueTabs');
        if (!container) return;

        container.innerHTML = this.queueNames.map((name, i) => {
            // Special handling for empty queues: always show "LISTE X"
            const displayName = (this.queues[i] && this.queues[i].length > 0) ? name : `LISTE ${i + 1}`;

            return `
            <div class="queue-tab group flex items-center gap-2 ${i === this.activeQueueIndex ? 'active' : ''}" 
                 onclick="mixer.switchQueue(${i})"
                 ondblclick="mixer.editQueueName(${i})"
                 ondragover="event.preventDefault(); this.classList.add('drag-over')"
                 ondragleave="this.classList.remove('drag-over')"
                 ondrop="mixer.handleTabDrop(event, ${i})">
                <span class="truncate max-w-[80px]" id="queueNameText${i}">${displayName}</span>
                <i class="ph ph-pencil-simple text-[10px] opacity-0 group-hover:opacity-100 cursor-pointer hover:text-white"
                   onclick="event.stopPropagation(); mixer.editQueueName(${i})"></i>
            </div>
        `;
        }).join('');
    }

    switchQueue(index) {
        this.activeQueueIndex = index;
        this.queue = this.queues[index];
        this.queuePlayIndex = 0;
        this.renderQueueTabs();
        this.renderQueue();
    }

    editQueueName(index) {
        showPrompt("Renommer la liste", "Entrez le nouveau nom :", this.queueNames[index], (newName) => {
            if (newName && newName.trim()) {
                this.queueNames[index] = newName.trim();
                this.renderQueueTabs();
                this.saveQueues();
                showToast("Liste renommée", 'success');
            }
        });
    }

    saveQueues() {
        localStorage.setItem('dj_queues', JSON.stringify(this.queues));
        localStorage.setItem('dj_queue_names', JSON.stringify(this.queueNames));
    }

    removeQueue(index) {
        this.queue.splice(index, 1);
        this.renderQueue();
        this.saveQueues();
    }

    clearQueue() {
        showConfirm("Vider la liste", `Voulez-vous vraiment vider la liste "${this.queueNames[this.activeQueueIndex]}" ?`, [
            {
                label: "Oui, vider",
                primary: true,
                callback: () => {
                    this.queues[this.activeQueueIndex] = [];
                    this.queue = this.queues[this.activeQueueIndex];
                    this.queuePlayIndex = 0;
                    this.renderQueue();
                    this.saveQueues();
                    showToast("Liste vidée", 'success');
                }
            },
            { label: "Annuler", primary: false }
        ]);
    }

    handleTabDrop(e, targetQueueIndex) {
        e.preventDefault();
        const tab = e.target.closest('.queue-tab');
        if (tab) tab.classList.remove('drag-over');

        const trackIndex = parseInt(e.dataTransfer.getData('trackIndex'));
        const sourceQueueIndex = parseInt(e.dataTransfer.getData('sourceQueueIndex'));

        if (isNaN(trackIndex) || isNaN(sourceQueueIndex)) return;
        if (sourceQueueIndex === targetQueueIndex) return;

        // Move track
        const [movedTrack] = this.queues[sourceQueueIndex].splice(trackIndex, 1);
        this.queues[targetQueueIndex].push(movedTrack);

        // If we moved from current active queue, re-render
        if (sourceQueueIndex === this.activeQueueIndex) {
            this.renderQueue();
        }

        this.saveQueues();
        showToast(`Déplacé vers "${this.queueNames[targetQueueIndex]}"`, 'success');
    }

    /**
     * Initialize drag-to-resize for the queue panel
     */
    initQueueResize() {
        const handle = document.getElementById('queueResizeHandle');
        const section = document.getElementById('queueSection');
        if (!handle || !section) return;

        let startY, startHeight;

        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startY = e.clientY;
            startHeight = section.offsetHeight;
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';

            const onMouseMove = (e) => {
                const delta = startY - e.clientY; // dragging up = positive
                const newHeight = Math.max(100, Math.min(window.innerHeight * 0.6, startHeight + delta));
                section.style.height = newHeight + 'px';
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                localStorage.setItem('dj_queue_height', section.offsetHeight);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    }

    renderQueue() {
        const list = document.getElementById('queueList');
        const count = document.getElementById('queueCount');
        const searchInput = document.getElementById('queueSearchInput');
        if (!list) return;

        const filterText = searchInput ? searchInput.value.toLowerCase() : '';

        // Filter queue based on search input
        const filteredQueue = filterText
            ? this.queue.map((track, originalIndex) => ({ track, originalIndex }))
                .filter(({ track }) => {
                    const info = parseTrackInfo(track.title);
                    const titleStr = (info.title || track.title).toLowerCase();
                    const artistStr = (info.artist || '').toLowerCase();
                    return titleStr.includes(filterText) || artistStr.includes(filterText);
                })
            : this.queue.map((track, originalIndex) => ({ track, originalIndex }));

        if (count) count.innerText = `${filteredQueue.length} TITRES`;
        list.innerHTML = '';

        if (filteredQueue.length === 0) {
            list.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-zinc-600 opacity-50 space-y-2 py-8 min-w-[300px]">
                    <i class="ph ph-playlist text-4xl"></i>
                    <p class="text-xs italic">${filterText ? 'Aucun résultat' : 'La liste "' + this.queueNames[this.activeQueueIndex] + '" est vide'}</p>
                </div>
            `;
            return;
        }

        filteredQueue.forEach(({ track, originalIndex }) => {
            const info = parseTrackInfo(track.title);
            const isPlayed = originalIndex < this.queuePlayIndex;
            const item = document.createElement('div');
            item.className = `queue-track-item group flex items-center gap-3 p-2 bg-black/20 hover:bg-zinc-800/40 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-all cursor-pointer flex-shrink-0${isPlayed ? ' opacity-40' : ''}`;
            item.draggable = true;
            item.dataset.index = originalIndex;

            item.innerHTML = `
                <div class="relative w-16 h-16 rounded overflow-hidden flex-shrink-0 shadow queue-thumb-container">
                    <img src="${track.thumbnail}" class="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity">
                    <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                         <i class="ph ph-dots-six-vertical text-white text-sm"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-[100px] max-w-[200px] flex flex-col justify-center">
                    <div class="text-[11px] font-bold text-dj-neon uppercase tracking-wider truncate">${escapeHtml(info.artist)}</div>
                    <div class="text-sm text-white font-medium truncate leading-tight">${escapeHtml(info.title || track.title)}</div>
                </div>
                <div class="flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100">
                    <div class="flex gap-1">
                        <button data-action="load-a" data-id="${track.id}" data-title="${encodeURIComponent(track.title)}" 
                                class="w-6 h-6 rounded-full bg-dj-neon/20 text-dj-neon border border-dj-neon/30 flex items-center justify-center hover:bg-dj-neon hover:text-black transition-all">
                            <span class="text-[10px] font-bold">A</span>
                        </button>
                        <button data-action="load-b" data-id="${track.id}" data-title="${encodeURIComponent(track.title)}" 
                                class="w-6 h-6 rounded-full bg-dj-warning/20 text-dj-warning border border-dj-warning/30 flex items-center justify-center hover:bg-dj-warning hover:text-black transition-all">
                            <span class="text-[10px] font-bold">B</span>
                        </button>
                    </div>
                    <button data-action="remove" data-index="${originalIndex}" class="text-zinc-500 hover:text-red-500 text-xs">
                        <i class="ph ph-trash"></i>
                    </button>
                </div>
            `;

            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('trackIndex', originalIndex);
                e.dataTransfer.setData('sourceQueueIndex', this.activeQueueIndex);
                item.classList.add('opacity-50');
            });
            item.addEventListener('dragend', () => item.classList.remove('opacity-50'));
            list.appendChild(item);
        });

    }

    // --- PERSISTENCE ---

    exportQueue() {
        if (this.queue.length === 0) return showToast("File d'attente vide", 'error');
        const dataStr = JSON.stringify(this.queue, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;

        // Use the current display name (including LISTE X if empty, though export is blocked if empty)
        const fileName = (this.queues[this.activeQueueIndex].length > 0)
            ? this.queueNames[this.activeQueueIndex]
            : `LISTE ${this.activeQueueIndex + 1}`;

        link.download = `dj_queue_${fileName}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showToast("Export réussi", 'success');
    }

    importQueue() {
        setTimeout(() => {
            const fileInput = document.getElementById('importFile');
            if (fileInput) fileInput.click();
        }, 0);
    }

    handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        // Auto-rename tab to filename
        const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "");
        this.queueNames[this.activeQueueIndex] = fileNameNoExt;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let imported = JSON.parse(e.target.result);
                if (typeof imported === 'object' && !Array.isArray(imported)) {
                    const keys = Object.keys(imported);
                    if (keys.length > 0) {
                        let flattened = [];
                        keys.forEach(k => { if (Array.isArray(imported[k])) flattened = flattened.concat(imported[k]); });
                        imported = flattened;
                    }
                }
                if (!Array.isArray(imported)) throw new Error("Format invalide");

                showConfirm("Importer", "Remplacer ou ajouter à la fin ?", [
                    {
                        label: "Remplacer", primary: true, callback: () => {
                            this.queues[this.activeQueueIndex] = imported;
                            this.queue = this.queues[this.activeQueueIndex];
                            this.renderQueue();
                            this.saveQueues();
                            showToast("File remplacée", 'success');
                        }
                    },
                    {
                        label: "Ajouter", primary: false, callback: () => {
                            this.queues[this.activeQueueIndex] = this.queues[this.activeQueueIndex].concat(imported);
                            this.queue = this.queues[this.activeQueueIndex];
                            this.renderQueue();
                            this.saveQueues();
                            showToast("Titres ajoutés", 'success');
                        }
                    },
                    { label: "Annuler", primary: false }
                ]);
            } catch (err) { showToast(`Erreur: ${err.message}`, 'error'); }
            event.target.value = '';
        };
        reader.readAsText(file);
    }

    // --- SCREEN SAVER ---

    toggleScreenSaver(fromSync = false) {
        const scrBtn = document.querySelector('button[onclick="mixer.toggleScreenSaver()"]');

        this.screenSaverActive = !this.screenSaverActive;

        if (this.screenSaverActive) {
            // ONLY show the overlay if we are the projector
            if (this.isProjector) {
                const overlay = document.getElementById('screenSaverOverlay');
                if (overlay) overlay.classList.remove('hidden');
                this.initScreenSaver();
            }
            if (scrBtn) scrBtn.classList.add('text-dj-neon');

            logDebug("Screen Saver: Activated");
            if (!this.isProjector && !fromSync) showToast("Économiseur d'écran activé sur le projecteur", 'info');
        } else {
            if (this.isProjector) {
                const overlay = document.getElementById('screenSaverOverlay');
                if (overlay) overlay.classList.add('hidden');
            }
            if (this.scrAnimationId) {
                cancelAnimationFrame(this.scrAnimationId);
                this.scrAnimationId = null;
            }
            if (scrBtn) scrBtn.classList.remove('text-dj-neon');
            logDebug("Screen Saver: Deactivated");
        }

        // Sync mode select dropdown if on mixer
        const modeSelect = document.getElementById('screenSaverModeSelect');
        if (modeSelect) modeSelect.value = this.scrMode;

        // Broadcast if manually toggled
        if (!fromSync && !this.isProjector) {
            this.broadcast({ type: 'TOGGLE_SCREENSAVER' });
        }
    }

    initScreenSaver() {
        this.scrCanvas = document.getElementById('screenSaverCanvas');
        if (!this.scrCanvas) return;
        this.scrCtx = this.scrCanvas.getContext('2d');
        this.scrMode = this.scrMode || 'psychedelic';
        this.scrText = this.scrText || 'YT DJ MIXER';

        // Resize canvas
        this.resizeScrCanvas();
        window.addEventListener('resize', () => this.resizeScrCanvas());

        // Animation state reset
        this.scrParticles = [];
        this.scrFireworks = [];
        this.scrRain = [];
        this.scrRobots = [];
        this.scrImages = this.scrImages || [];
        this.scrCurrentImageIndex = 0;
        this.scrLastImageSwap = 0;
        this.scrFadeAlpha = 1.0;

        // Global Control Defaults
        this.scrSpeedMultiplier = parseFloat(localStorage.getItem('dj_scr_speed')) || 1.0;
        this.scrBeatReactivity = 1.0;

        // Customization defaults
        this.scrFont = this.scrFont || 'Orbitron';
        this.scrColor = this.scrColor || '#00f0ff';
        this.scrAnim = this.scrAnim || 'marquee';
        this.scrTextX = 0;
        this.scrTextY = 0;
        this.scrTextVelX = 2;
        this.scrTextVelY = 2;

        // Matrix Mode Setup
        this.scrMatrixDrops = [];
        const fontSize = 20;
        const columns = Math.ceil(this.scrCanvas.width / fontSize);
        for (let i = 0; i < columns; i++) {
            this.scrMatrixDrops[i] = Math.random() * -100;
        }

        // Space Mode Setup
        this.scrStars = [];
        for (let i = 0; i < 200; i++) {
            this.scrStars.push({
                x: Math.random() * this.scrCanvas.width,
                y: Math.random() * this.scrCanvas.height,
                z: Math.random() * this.scrCanvas.width,
                size: Math.random() * 2
            });
        }
        this.scrNebulae = [
            { x: 0.2, y: 0.3, color: 'rgba(255, 0, 255, 0.1)', pulse: 0 },
            { x: 0.8, y: 0.7, color: 'rgba(0, 255, 255, 0.1)', pulse: 0 }
        ];

        // Robots Mode Removed
        this.scrRobots = [];

        this.animateScreenSaver();
    }

    resizeScrCanvas() {
        if (this.scrCanvas) {
            this.scrCanvas.width = window.innerWidth;
            this.scrCanvas.height = window.innerHeight;
        }
    }

    setScreenSaverMode(mode) {
        this.scrMode = mode;

        // Update mixer dropdown
        const modeSelect = document.getElementById('screenSaverModeSelect');
        if (modeSelect) modeSelect.value = mode;

        const btns = document.querySelectorAll('.scr-mode-btn');
        btns.forEach(btn => {
            if (btn.dataset.mode === mode) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Toggle visibility of customization controls on projector
        if (this.isProjector) {
            const textControls = document.getElementById('scrTextControls');
            const imageControls = document.getElementById('scrImageControls');

            if (textControls) mode === 'text' ? textControls.classList.remove('hidden') : textControls.classList.add('hidden');
            if (imageControls) mode === 'images' ? imageControls.classList.remove('hidden') : imageControls.classList.add('hidden');
        }

        // Update Text UI classes (for backward compatibility if needed)
        const textCont = document.getElementById('screenSaverTextContainer');
        const textEl = document.getElementById('screenSaverText');

        if (textCont && textEl) {
            if (mode === 'text') {
                textEl.innerText = this.scrText;
                textEl.classList.remove('hidden');
                textEl.style.color = this.scrColor;
                textEl.style.fontFamily = this.scrFont;
            } else {
                textEl.innerText = "";
                textEl.classList.add('hidden');
            }
        }

        // Broadcast if manually changed
        if (!this.isProjector) {
            const modeSelect = document.getElementById('screenSaverModeSelect');
            if (modeSelect) modeSelect.value = mode;
            this.broadcast({ type: 'SET_SCREENSAVER_MODE', mode });
        }
    }

    setScreenSaverFont(val) {
        this.scrFont = val;
        const el = document.getElementById('screenSaverText');
        if (el) el.style.fontFamily = val;
        const modalEl = document.getElementById('modalScrFont');
        if (modalEl) modalEl.value = val;
        if (!this.isProjector) this.broadcast({ type: 'SET_SCREENSAVER_FONT', val });
    }

    setScreenSaverColor(val) {
        this.scrColor = val;
        const el = document.getElementById('screenSaverText');
        if (el) el.style.color = val;
        const modalEl = document.getElementById('modalScrColor');
        if (modalEl) modalEl.value = val;
        const modalHex = document.getElementById('modalScrColorHex');
        if (modalHex) modalHex.innerText = val.toUpperCase();
        if (!this.isProjector) this.broadcast({ type: 'SET_SCREENSAVER_COLOR', val });
    }

    setScreenSaverAnim(val) {
        this.scrAnim = val;
        const modalEl = document.getElementById('modalScrAnim');
        if (modalEl) modalEl.value = val;
        if (!this.isProjector) this.broadcast({ type: 'SET_SCREENSAVER_ANIM', val });
    }

    setScreenSaverSpeed(val) {
        this.scrSpeedMultiplier = parseFloat(val);
        const modalEl = document.getElementById('modalScrSpeed');
        if (modalEl) modalEl.value = val;
        const speedValEl = document.getElementById('modalScrSpeedVal');
        if (speedValEl) speedValEl.innerText = `${parseFloat(val).toFixed(1)}x`;

        if (!this.isProjector) {
            localStorage.setItem('dj_scr_speed', val);
            this.broadcast({ type: 'SET_SCREENSAVER_SPEED', val });
        }
    }

    openScrSettings() {
        const modal = document.getElementById('scrSettingsModal');
        if (modal) {
            modal.classList.remove('hidden');
            // Sync values to modal
            document.getElementById('modalScrInput').value = this.scrText || '';
            document.getElementById('modalScrFont').value = this.scrFont || 'Orbitron';
            document.getElementById('modalScrColor').value = this.scrColor || '#00f0ff';
            document.getElementById('modalScrColorHex').innerText = (this.scrColor || '#00f0ff').toUpperCase();
            document.getElementById('modalScrAnim').value = this.scrAnim || 'marquee';
            
            const countEl = document.getElementById('modalScrImageCount');
            if (countEl) countEl.innerText = `${this.scrImages ? this.scrImages.length : 0} images`;
            
            const speedInput = document.getElementById('modalScrSpeed');
            if (speedInput) {
                speedInput.value = this.scrSpeedMultiplier || 1.0;
                const speedValEl = document.getElementById('modalScrSpeedVal');
                if (speedValEl) speedValEl.innerText = `${(this.scrSpeedMultiplier || 1.0).toFixed(1)}x`;
            }
            const syncCheck = document.getElementById('modalScrSyncTitle');
            if (syncCheck) syncCheck.checked = this.state.scrSyncVideo;
        }
    }

    setScreenSaverSyncVideo(val) {
        this.state.scrSyncVideo = val;
        localStorage.setItem('dj_scr_sync_video', val);
        
        // Update quick toggle if exists
        const quickSync = document.getElementById('scrSyncTitleToggle');
        if (quickSync) quickSync.checked = val;

        if (!this.isProjector) {
            this.broadcast({ type: 'SET_SCREENSAVER_SYNC_VIDEO', val });
        }
    }

    closeScrSettings() {
        const modal = document.getElementById('scrSettingsModal');
        if (modal) modal.classList.add('hidden');
    }

    handleScrImages(event) {
        const files = Array.from(event.target.files);
        this.scrImages = []; // Store Image objects

        let loaded = 0;
        files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.scrImages.push(img);
                    loaded++;
                    if (loaded === files.length) {
                        const countEl = document.getElementById('scrImageCount');
                        if (countEl) countEl.innerText = `${this.scrImages.length} images`;
                        if (!this.isProjector) {
                            // Can't easily broadcast Image objects, so broadcast DataURLs
                            const dataUrls = this.scrImages.map(i => i.src);
                            this.broadcast({ type: 'SET_SCREENSAVER_IMAGES', val: dataUrls });
                        }
                    }
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    setScreenSaverText(val) {
        this.scrText = val || 'YT DJ MIXER';
        if (this.scrMode === 'text') {
            const el = document.getElementById('screenSaverText');
            if (el) el.innerText = this.scrText;
        }

        if (!this.isProjector) {
            this.broadcast({ type: 'SET_SCREENSAVER_TEXT', val: this.scrText });
        }
    }

    animateScreenSaver() {
        if (!this.screenSaverActive) return;

        const ctx = this.scrCtx;
        const w = this.scrCanvas.width;
        const h = this.scrCanvas.height;

        // Improved Beat Reactivity
        let beatLevel = 0.05;
        const bars = document.querySelectorAll('.waveform-bar');
        if (bars.length > 0) {
            let total = 0;
            bars.forEach(b => {
                const h = parseFloat(b.style.height) || 0;
                total += h * (h > 50 ? 1.5 : 1); // Weight higher peaks
            });
            beatLevel = Math.max(0.05, (total / (bars.length * 100 * 1.2)) || 0.05);
        }

        // Final effective multiplier
        const speed = this.scrSpeedMultiplier || 1.0;
        const isBeat = beatLevel > 0.4;

        ctx.save();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;

        // --- VIDEO VIGNETTE SYNC OVERRIDE ---
        if (this.state.scrSyncVideo) {
            const activeDeck = (this.state.crossfader <= 50) ? 'A' : 'B';
            const img = this.scrThumbnails[activeDeck];
            
            // Ensure DOM text is hidden if syncing video
            const textEl = document.getElementById('screenSaverText');
            if (textEl && !textEl.classList.contains('hidden')) textEl.classList.add('hidden');

            if (img) {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, w, h);
                
                const ratio = Math.min(w / img.width, h / img.height) * (1 + beatLevel * 0.1);
                const iw = img.width * ratio;
                const ih = img.height * ratio;
                
                // Add subtle glow
                ctx.shadowBlur = 40 * beatLevel;
                ctx.shadowColor = (activeDeck === 'A') ? '#00f0ff' : '#ffe600';
                
                ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);

                // --- TEXT OVERLAY ---
                ctx.shadowBlur = 0; // Disable blur for text
                const trackTitle = this.state[activeDeck].title || "Aucune piste";
                const info = parseTrackInfo(trackTitle);
                
                // Readability Gradient
                const gradH = h * 0.3;
                const grad = ctx.createLinearGradient(0, h - gradH, 0, h);
                grad.addColorStop(0, 'transparent');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
                ctx.fillStyle = grad;
                ctx.fillRect(0, h - gradH, w, gradH);

                ctx.textAlign = 'center';
                const baseScale = 1 + beatLevel * 0.2;

                // DRAW ARTIST
                ctx.font = `bold ${Math.floor(h * 0.05 * baseScale)}px Orbitron`;
                ctx.fillStyle = (activeDeck === 'A') ? '#00f0ff' : '#ffe600';
                ctx.fillText((info.artist || "ARTISTE").toUpperCase(), w / 2, h - (h * 0.12));

                // DRAW TITLE
                ctx.font = `${Math.floor(h * 0.035 * baseScale)}px Orbitron`;
                ctx.fillStyle = 'white';
                ctx.fillText((info.title || info.artist || "TITRE").toUpperCase(), w / 2, h - (h * 0.07));
                
                ctx.restore();
                this.scrAnimationId = requestAnimationFrame(() => this.animateScreenSaver());
                return;
            }
        } else {
            // Restore text visibility if not syncing video and mode is text
            if (this.scrMode === 'text') {
                const textEl = document.getElementById('screenSaverText');
                if (textEl && textEl.classList.contains('hidden')) textEl.classList.remove('hidden');
            }
        }

        if (this.scrMode === 'psychedelic') {
            ctx.fillStyle = `rgba(0, 0, 0, ${0.1 - beatLevel * 0.05})`;
            ctx.fillRect(0, 0, w, h);

            const centerX = w / 2;
            const centerY = h / 2;
            const maxRadius = Math.min(w, h) * 0.45;

            for (let i = 0; i < 6; i++) {
                const radius = (maxRadius * (i + 1) / 6) * (1 + beatLevel * 0.8);
                const hue = (Date.now() / (15 / speed) + i * 40) % 360;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${0.4 - i * 0.06})`;
                ctx.lineWidth = 3 + beatLevel * 40;
                ctx.stroke();
            }
            // Particle loop removed as requested

        } else if (this.scrMode === 'techno') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
            ctx.fillRect(0, 0, w, h);
            const gridSize = 60;
            const hue = (Date.now() / 30) % 360;
            ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${0.1 + beatLevel * 0.5})`;
            ctx.lineWidth = 1 + beatLevel * 2;

            // Horizontal lines with displacement
            for (let y = 0; y < h; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                for (let x = 0; x < w; x += 10) {
                    const noise = Math.sin(x / 50 + Date.now() / 200) * 15 * beatLevel;
                    ctx.lineTo(x, y + noise);
                }
                ctx.stroke();
            }
            // Vertical lines with displacement
            for (let x = 0; x < w; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                for (let y = 0; y < h; y += 10) {
                    const noise = Math.cos(y / 50 + Date.now() / 200) * 15 * beatLevel;
                    ctx.lineTo(x + noise, y);
                }
                ctx.stroke();
            }

        } else if (this.scrMode === 'fireworks') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, w, h);

            const launchChance = (isBeat ? 0.3 : 0.02) * speed;
            if (Math.random() < launchChance) {
                const fHue = Math.random() * 360;
                const fx = 100 + Math.random() * (w - 200);
                const fy = 100 + Math.random() * (h * 0.6);
                const particleCount = 40 + Math.floor(beatLevel * 60);
                for (let i = 0; i < particleCount; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = Math.random() * 6 + 1;
                    this.scrFireworks.push({
                        x: fx, y: fy,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        hue: fHue,
                        life: 1.0,
                        size: 1 + Math.random() * 2
                    });
                }
            }

            // Update & Draw fireworks
            for (let i = this.scrFireworks.length - 1; i >= 0; i--) {
                const f = this.scrFireworks[i];
                f.x += f.vx;
                f.y += f.vy;
                f.vy += 0.1; // Gravity
                f.life -= 0.02;
                if (f.life <= 0) {
                    this.scrFireworks.splice(i, 1);
                    continue;
                }
                ctx.beginPath();
                ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${f.hue}, 100%, ${50 + (1 - f.life) * 30}%, ${f.life})`;
                ctx.fill();

                // Add tiny trails
                if (Math.random() > 0.5) {
                    ctx.fillStyle = `hsla(${f.hue}, 100%, 50%, ${f.life * 0.5})`;
                    ctx.fillRect(f.x - f.vx, f.y - f.vy, 1, 1);
                }
            }

        } else if (this.scrMode === 'rain') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, w, h);

            // Draw & Update Ripples
            for (let i = this.scrRipples.length - 1; i >= 0; i--) {
                const rip = this.scrRipples[i];
                rip.radius += 2 * speed;
                rip.life -= 0.02 * speed;
                if (rip.life <= 0) {
                    this.scrRipples.splice(i, 1);
                    continue;
                }
                ctx.beginPath();
                ctx.arc(rip.x, rip.y, rip.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(173, 216, 230, ${rip.life * 0.5})`;
                ctx.lineWidth = 1;
                ctx.stroke();
            }

            ctx.strokeStyle = `rgba(173, 216, 230, ${0.3 + beatLevel * 0.4})`;
            ctx.lineWidth = 1;

            this.scrRain.forEach(r => {
                ctx.beginPath();
                ctx.moveTo(r.x, r.y);
                ctx.lineTo(r.x, r.y + r.length);
                ctx.stroke();

                r.y += r.speed * (1 + beatLevel * 1.5) * speed;
                if (r.y > h - 20) {
                    // Create ripple at "ground"
                    this.scrRipples.push({ x: r.x, y: h - 20, radius: 5, life: 1.0 });
                    r.y = -20;
                    r.x = Math.random() * w;
                }
            });

        } else if (this.scrMode === 'matrix') {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = isBeat ? '#00ff88' : '#00ff00';
            ctx.font = '20px monospace';
            const fontSize = 20;

            for (let i = 0; i < this.scrMatrixDrops.length; i++) {
                const text = String.fromCharCode(0x30A0 + Math.random() * 96);
                const x = i * fontSize;
                const y = this.scrMatrixDrops[i] * fontSize;

                ctx.fillText(text, x, y);

                if (y > h && Math.random() > 0.975) {
                    this.scrMatrixDrops[i] = 0;
                }
                this.scrMatrixDrops[i] += (1 + beatLevel * 2) * speed;
            }

        } else if (this.scrMode === 'space') {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, w, h);

            // Draw Nebulae
            this.scrNebulae.forEach(n => {
                const grad = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, (w / 3) * (1 + beatLevel));
                grad.addColorStop(0, n.color.replace('0.1', (0.1 + beatLevel * 0.2).toString()));
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.fillRect(0, 0, w, h);
            });

            // Draw Stars
            ctx.fillStyle = 'white';
            this.scrStars.forEach(s => {
                s.z -= 2 * speed * (1 + beatLevel * 5);
                if (s.z <= 0) s.z = w;

                const sx = (s.x - w / 2) * (w / s.z) + w / 2;
                const sy = (s.y - h / 2) * (w / s.z) + h / 2;
                const radius = (1 - s.z / w) * 3;

                if (sx > 0 && sx < w && sy > 0 && sy < h) {
                    ctx.beginPath();
                    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        } else if (this.scrMode === 'images') {
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, w, h);

            if (this.scrImages && this.scrImages.length > 0) {
                const now = Date.now();
                const interval = 5000;
                const fadeDuration = 1000;
                const timeSinceSwap = now - this.scrLastImageSwap;

                if (timeSinceSwap > interval) {
                    this.scrCurrentImageIndex = (this.scrCurrentImageIndex + 1) % this.scrImages.length;
                    this.scrLastImageSwap = now;
                    this.scrFadeAlpha = 0;
                }

                if (this.scrFadeAlpha < 1) this.scrFadeAlpha += 0.02 * speed;

                const img = this.scrImages[this.scrCurrentImageIndex];
                const prevIndex = (this.scrCurrentImageIndex - 1 + this.scrImages.length) % this.scrImages.length;
                const prevImg = this.scrImages[prevIndex];

                const drawImg = (i, alpha, isNew = false) => {
                    if (!i.complete) return;
                    ctx.globalAlpha = alpha;

                    // Transition Effects (Zoom / Slide)
                    let scale = 1.0;
                    let offsetX = 0;
                    let offsetY = 0;

                    if (isNew) {
                        scale = 1.0 + (this.scrFadeAlpha * 0.1); // Zoom in
                        offsetX = (1 - this.scrFadeAlpha) * 20; // Slide in
                    } else {
                        scale = 1.1 - (this.scrFadeAlpha * 0.1); // Zoom out
                        offsetX = -this.scrFadeAlpha * 20; // Slide out
                    }

                    const ratio = Math.min(w / i.width, h / i.height) * scale;
                    const iw = i.width * ratio;
                    const ih = i.height * ratio;
                    ctx.drawImage(i, (w - iw) / 2 + offsetX, (h - ih) / 2 + offsetY, iw, ih);
                };

                if (this.scrFadeAlpha < 1 && this.scrImages.length > 1) {
                    drawImg(prevImg, 1 - this.scrFadeAlpha, false);
                    drawImg(img, this.scrFadeAlpha, true);
                } else {
                    drawImg(img, 1, true);
                }
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = 'white';
                ctx.font = '20px Orbitron';
                ctx.textAlign = 'center';
                ctx.fillText("Aucune image chargée", w / 2, h / 2);
            }
        } else if (this.scrMode === 'text') {
            ctx.clearRect(0, 0, w, h);
            const textEl = document.getElementById('screenSaverText');
            if (textEl) {
                if (this.scrAnim === 'bounce') {
                    if (this.scrTextX === 0 && this.scrTextY === 0) {
                        this.scrTextX = Math.random() * (w * 0.5);
                        this.scrTextY = Math.random() * (h * 0.5);
                    }
                    this.scrTextX += this.scrTextVelX * (1 + beatLevel * 5);
                    this.scrTextY += this.scrTextVelY * (1 + beatLevel * 5);

                    const rect = textEl.getBoundingClientRect();
                    if (this.scrTextX <= 0 || (this.scrTextX + rect.width) >= w) this.scrTextVelX *= -1;
                    if (this.scrTextY <= 0 || (this.scrTextY + rect.height) >= h) this.scrTextVelY *= -1;

                    textEl.style.position = 'absolute';
                    textEl.style.left = `${this.scrTextX}px`;
                    textEl.style.top = `${this.scrTextY}px`;
                    textEl.style.transform = `scale(${1 + beatLevel * 0.2})`;
                    textEl.style.opacity = '1';
                } else if (this.scrAnim === 'pulse') {
                    textEl.style.position = 'static';
                    textEl.style.left = 'auto';
                    textEl.style.top = 'auto';
                    const scale = 1 + Math.sin(Date.now() / 500) * 0.2 + (beatLevel * 0.5);
                    textEl.style.transform = `scale(${scale})`;
                    textEl.style.opacity = 0.5 + beatLevel * 0.5;
                } else { // marquee
                    this.scrTextX -= 2 * (1 + beatLevel * 5);
                    const rect = textEl.getBoundingClientRect();
                    if (this.scrTextX < -rect.width) this.scrTextX = w;

                    textEl.style.position = 'absolute';
                    textEl.style.left = `${this.scrTextX}px`;
                    textEl.style.top = '50%';
                    textEl.style.transform = 'translateY(-50%)';
                    textEl.style.opacity = '0.8';
                }
            }
        } else {
            ctx.clearRect(0, 0, w, h);
        }

        this.scrAnimationId = requestAnimationFrame(() => this.animateScreenSaver());
        ctx.restore();
    }

    // --- THEMES & UI ---

    applyTheme(themeName) {
        const themes = {
            neon: { neon: '#00f0ff', accent: '#8b5cf6', warning: '#ff003c', panel: '#1a1a1e', bg: '#0f0f13', text: '#ffffff', textDim: 'rgba(255,255,255,0.6)' },
            emerald: { neon: '#10b981', accent: '#f59e0b', warning: '#ef4444', panel: '#064e3b', bg: '#022c22', text: '#ffffff', textDim: 'rgba(255,255,255,0.6)' },
            industrial: { neon: '#ff4400', accent: '#64748b', warning: '#b91c1c', panel: '#1e293b', bg: '#0f172a', text: '#ffffff', textDim: 'rgba(255,255,255,0.6)' },
            luxury: { neon: '#fbbf24', accent: '#ffffff', warning: '#991b1b', panel: '#18181b', bg: '#000000', text: '#ffffff', textDim: 'rgba(255,255,255,0.6)' },
            sunset: { neon: '#f97316', accent: '#ec4899', warning: '#dc2626', panel: '#431407', bg: '#2d0a05', text: '#ffffff', textDim: 'rgba(255,255,255,0.6)' },
            cream: { neon: '#b59300', accent: '#5a4632', warning: '#8b0000', panel: '#f0e6d6', bg: '#fdfbf7', text: '#2d241c', textDim: '#5a4632' },
            pink: { neon: '#ff0080', accent: '#7000ff', warning: '#ff4b2b', panel: '#2d0a25', bg: '#1a0515', text: '#ffffff', textDim: 'rgba(255,255,255,0.6)' },
            bw: { neon: '#ffffff', accent: '#808080', warning: '#ffffff', panel: '#000000', bg: '#000000', text: '#ffffff', textDim: '#cccccc' },
            nitro: { neon: '#ffff00', accent: '#0000ff', warning: '#ff0000', panel: '#c0c0c0', bg: '#008080', text: '#000000', textDim: '#444444' },
            pixel: { neon: '#00ff00', accent: '#ff00ff', warning: '#ff0000', panel: '#222222', bg: '#000000', text: '#00ff00', textDim: '#00aa00' }
        };

        const theme = themes[themeName] || themes.neon;
        const root = document.documentElement;

        // Apply body class for deep CSS overrides
        document.body.classList.forEach(cls => {
            if (cls.startsWith('theme-')) document.body.classList.remove(cls);
        });
        document.body.classList.add(`theme-${themeName}`);

        root.style.setProperty('--dj-neon', theme.neon);
        root.style.setProperty('--dj-accent', theme.accent);
        root.style.setProperty('--dj-warning', theme.warning);
        root.style.setProperty('--dj-panel', theme.panel);
        root.style.setProperty('--dj-bg', theme.bg);
        root.style.setProperty('--dj-text', theme.text);
        root.style.setProperty('--dj-text-dim', theme.textDim);

        if (!this.isProjector) {
            localStorage.setItem('dj_theme', themeName);
            this.broadcast({ type: 'THEME', name: themeName });
        }
    }

    cueDeck(deck) {
        if (!this.players[deck]) return;
        this.players[deck].pauseVideo();
        this.players[deck].seekTo(0);
        this.state[deck].playing = false;
        this.updateSafetyUI(deck, false);
        this.broadcast({ type: 'PAUSE', deck });
        this.syncState();
    }

    initQueueListeners() {

        const list = document.getElementById('queueList');
        if (!list) return;

        list.addEventListener('dragover', (e) => e.preventDefault());
        list.addEventListener('drop', (e) => {
            e.preventDefault();
            const fromIndex = parseInt(e.dataTransfer.getData('trackIndex'));
            const sourceQueue = parseInt(e.dataTransfer.getData('sourceQueueIndex'));

            // Only handle if same queue (reordering)
            if (sourceQueue !== this.activeQueueIndex) return;
            const targetItem = e.target.closest('.queue-track-item');
            if (targetItem) {
                const toIndex = parseInt(targetItem.dataset.index);
                if (fromIndex !== toIndex) {
                    const [movedItem] = this.queue.splice(fromIndex, 1);
                    this.queue.splice(toIndex, 0, movedItem);
                    this.renderQueue();
                    this.saveQueues();
                }
            }
        });

        // Delegated click handler for queue track buttons (load A/B, remove)
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            if (action === 'load-a') {
                this.loadTrack('A', btn.dataset.id, decodeURIComponent(btn.dataset.title));
            } else if (action === 'load-b') {
                this.loadTrack('B', btn.dataset.id, decodeURIComponent(btn.dataset.title));
            } else if (action === 'remove') {
                this.removeQueue(parseInt(btn.dataset.index));
            }
        });
    }

    syncState() {
        if (this.isProjector) return;
        this.broadcast({
            type: 'SYNC_STATE',
            state: {
                A: { videoId: this.state.A.videoId, time: (this.players.A && this.players.A.getCurrentTime) ? this.players.A.getCurrentTime() : 0, playing: this.state.A.playing },
                B: { videoId: this.state.B.videoId, time: (this.players.B && this.players.B.getCurrentTime) ? this.players.B.getCurrentTime() : 0, playing: this.state.B.playing },
                crossfader: this.state.crossfader,
                audioOutput: this.state.audioOutput,
                scrSyncWithTitle: this.state.scrSyncWithTitle
            }
        });
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// Global Instance (Explicitly attached to window for HTML event handlers)
window.mixer = new DJMixer();
const mixer = window.mixer;

// Initialize waveforms
if (document.getElementById('waveformA')) {
    document.getElementById('waveformA').innerHTML = generateWaveform();
}
if (document.getElementById('waveformB')) {
    document.getElementById('waveformB').innerHTML = generateWaveform();
}

// YouTube API Setup
var tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
var firstScriptTag = document.getElementsByTagName('script')[0];
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

function onYouTubeIframeAPIReady() {
    logDebug("API YOUTUBE CHARGEE");

    const commonVars = {
        'playsinline': 1,
        'controls': 0,
        'rel': 0,                    // Don't show related videos
        'iv_load_policy': 3,         // Disable annotations
        'modestbranding': 1,         // Minimal YouTube branding
        'disablekb': 1,              // Disable keyboard controls
        'fs': 0,                     // Disable fullscreen button
        'showinfo': 0,               // Hide video info
        'autohide': 0,               // Always hide controls (deprecated but set to 0 just in case)
        'cc_load_policy': 0,         // Disable captions by default
        'enablejsapi': 1             // Enable JavaScript API
    };

    function createPlayer(elementId, deckId) {
        try {
            return new YT.Player(elementId, {
                height: '100%',
                width: '100%',
                videoId: '',
                playerVars: commonVars,
                events: {
                    'onReady': () => mixer.onPlayerReady(deckId),
                    'onStateChange': (e) => mixer.onPlayerStateChange(deckId, e),
                    'onError': (e) => mixer.onPlayerError(deckId, e)
                }
            });
        } catch (e) {
            logDebug(`ERREUR CREATION PLAYER ${deckId}: ${e.message}`);
            showToast(`Erreur création player ${deckId}`, 'error');
        }
    }

    mixer.players.A = createPlayer('playerA', 'A');
    mixer.players.B = createPlayer('playerB', 'B');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    const addBtn = document.getElementById('addToQueueBtn');
    const searchInput = document.getElementById('searchInput');

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            if (searchInput.value) mixer.addToQueue(searchInput.value);
        });
    }

    if (searchInput) {
        // Handle input for search
        searchInput.addEventListener('input', (e) => {
            mixer.handleSearchInput(e.target.value);
        });

        // Show previous results on focus
        searchInput.addEventListener('focus', () => {
            const resultsContainer = document.getElementById('searchResults');
            if (resultsContainer && resultsContainer.innerHTML.trim() !== '') {
                resultsContainer.classList.remove('hidden');
            }
        });

        // Handle Enter key
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const value = e.target.value.trim();
                // If it's a URL, add directly
                if (extractVideoID(value) && (value.includes('youtube') || value.includes('youtu.be'))) {
                    mixer.addToQueue(value);
                }
                // Otherwise, search results are already shown via input event
            }
        });

        // Close search results on Escape
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const resultsContainer = document.getElementById('searchResults');
                if (resultsContainer) resultsContainer.classList.add('hidden');
                searchInput.blur();
            }
        });
    }

    const queueSearchInput = document.getElementById('queueSearchInput');
    if (queueSearchInput) {
        queueSearchInput.addEventListener('input', () => {
            mixer.renderQueue();
        });
    }

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
        const searchResults = document.getElementById('searchResults');
        const searchInputElem = document.getElementById('searchInput');

        if (searchResults && searchInput) {
            if (!searchResults.contains(e.target) && e.target !== searchInput) {
                searchResults.classList.add('hidden');
            }
        }
    });
});
