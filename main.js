// --- POLYFILLS FOR ELECTRON / NODE COMPATIBILITY ---
// Fixes ReferenceError: File is not defined in undici (dependency of yt-search)
if (typeof global.File === 'undefined') {
    const { File, Blob } = require('node:buffer');
    global.File = File;
    global.Blob = Blob;
}

const { app, BrowserWindow, screen, ipcMain, session, webFrameMain } = require('electron');
const express = require('express');
const path = require('path');
const yts = require('yt-search');

// --- AGGRESSIVE CSS FOR YOUTUBE CLEANING ---
const YOUTUBE_CLEANER_CSS = `
    .ytp-ce-element,
    .ytp-ce-video,
    .ytp-ce-playlist,
    .ytp-ce-channel,
    .ytp-ce-covering-overlay,
    .ytp-ce-expanding-overlay,
    .ytp-ce-element-shadow,
    .ytp-ce-covering-image,
    .ytp-cards-teaser,
    .ytp-cards-button,
    .ytp-endscreen-content,
    .ytp-endscreen-previous,
    .ytp-endscreen-next,
    .ytp-pause-overlay,
    .ytp-suggested-video-ads,
    .ytp-scroll-min,
    .ytp-show-cards-title,
    .ytp-watermark,
    .ytp-cued-thumbnail-overlay,
    .ytp-suggested-action,
    .html5-endscreen,
    [class*="ytp-ce-"] { 
        display: none !important; 
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        width: 0 !important;
        height: 0 !important;
    }
`;

let mainWindow;
let projectorWindow;
let server;
const PORT = 3000;

function startServer() {
    const expressApp = express();
    // Serve static files from the current directory
    expressApp.use(express.static(path.join(__dirname)));

    return new Promise((resolve, reject) => {
        server = expressApp.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            resolve(PORT);
        });
    });
}

function createWindow(port) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        width: Math.min(1400, width),
        height: Math.min(900, height),
        title: "YouTube DJ Mixer",
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            nodeIntegrationInSubFrames: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true
    });

    mainWindow.loadURL(`http://localhost:${port}/index.html`);

    mainWindow.on('closed', function () {
        mainWindow = null;
        app.quit(); // Force quit all windows (including projector)
    });
}

// App lifecycle
app.whenReady().then(async () => {
    try {
        const port = await startServer();
        createWindow(port);

        // --- NETWORK BLOCKING (SESSION) ---
        // Block YouTube's endscreen API to prevent data from even loading
        session.defaultSession.webRequest.onBeforeRequest(
            { urls: ['*://*.youtube.com/get_endscreen*'] },
            (details, callback) => {
                console.log("Blocking YouTube Endscreen Request:", details.url);
                callback({ cancel: true });
            }
        );

        // --- GLOBAL CSS INJECTION ---
        // Safely force CSS into all frames using Electron 28's webFrameMain API
        app.on('web-contents-created', (event, contents) => {
            if (contents.getType() === 'window' || contents.getType() === 'webview') {
                contents.on('did-frame-finish-load', (e, isMainFrame, frameProcessId, frameRoutingId) => {
                    try {
                        const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
                        if (frame && frame.url && frame.url.includes('youtube.com')) {
                            frame.insertCSS(YOUTUBE_CLEANER_CSS, { cssOrigin: 'user' }).catch(() => { });
                        }
                    } catch (err) {
                        // Suppress frame access errors silently
                    }
                });
            }
        });

        // AUTO-LAUNCH PROJECTOR after a small delay
        setTimeout(() => {
            if (mainWindow && !projectorWindow) {
                const projectorUrl = `http://localhost:${port}/index.html?mode=projector`;
                console.log("Auto-launching projector...");
                app.emit('request-projector-launch', projectorUrl);
            }
        }, 3000);

        // Handle Projector Window
        ipcMain.on('open-projector', (event, url) => {
            app.emit('request-projector-launch', url);
        });

        // Handle App Close
        ipcMain.on('close-app', () => {
            app.quit();
        });

        // YouTube Search Scraping Handler
        ipcMain.handle('youtube-search', async (event, query) => {
            try {
                const r = await yts(query);
                return r.videos.slice(0, 20).map(v => ({
                    id: v.videoId,
                    title: v.title,
                    thumbnail: v.thumbnail || v.image,
                    duration: v.timestamp,
                    author: v.author.name
                }));
            } catch (err) {
                console.error('YouTube search error:', err);
                throw err;
            }
        });

        // YouTube Playlist Search Handler
        ipcMain.handle('youtube-playlist', async (event, query) => {
            try {
                const r = await yts(query);
                const playlists = r.playlists.slice(0, 10);
                return playlists.map(p => ({
                    id: p.listId,
                    title: p.title,
                    thumbnail: p.thumbnail || p.image,
                    count: p.videoCount,
                    author: p.author.name
                }));
            } catch (err) {
                console.error('YouTube playlist search error:', err);
                throw err;
            }
        });

        // YouTube Playlist Detail Handler (fetch videos in playlist)
        ipcMain.handle('youtube-playlist-videos', async (event, playlistId) => {
            try {
                const r = await yts({ listId: playlistId });
                return r.videos.map(v => ({
                    id: v.videoId,
                    title: v.title,
                    thumbnail: v.thumbnail || v.image,
                    duration: v.duration.timestamp || v.timestamp,
                    author: v.author.name
                }));
            } catch (err) {
                console.error('YouTube playlist videos error:', err);
                throw err;
            }
        });

        app.on('request-projector-launch', (url) => {
            console.log("Projector Launch Request received for:", url);

            if (projectorWindow) {
                console.log("Projector window already exists. Toggling fullscreen/bringing to front.");
                const wasFS = projectorWindow.isFullScreen();
                projectorWindow.setFullScreen(!wasFS);

                if (wasFS) {
                    setTimeout(() => {
                        projectorWindow.setHasShadow(true);
                        projectorWindow.setSize(1280, 720);
                        projectorWindow.center();
                        projectorWindow.show();
                    }, 100);
                } else {
                    projectorWindow.show();
                }
                projectorWindow.focus();
                return;
            }

            // DETECT DISPLAYS
            const allDisplays = screen.getAllDisplays();
            const primaryDisplay = screen.getPrimaryDisplay();

            const externalDisplay = allDisplays.find(d => d.id !== primaryDisplay.id);

            let windowOptions = {
                width: 1280,
                height: 720,
                title: "YT-DJ Projector",
                backgroundColor: '#000000',
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    nodeIntegrationInSubFrames: true,
                    preload: path.join(__dirname, 'preload.js')
                },
                autoHideMenuBar: true,
                show: true,
                skipTaskbar: false,
                focusable: true
            };

            if (externalDisplay) {
                windowOptions.x = externalDisplay.bounds.x;
                windowOptions.y = externalDisplay.bounds.y;
                windowOptions.fullscreen = true;
                windowOptions.frame = false;
            } else {
                windowOptions.fullscreen = false;
                windowOptions.frame = true;
                windowOptions.center = true;
                windowOptions.resizable = true;
            }

            try {
                projectorWindow = new BrowserWindow(windowOptions);
                projectorWindow.setMenu(null);
                projectorWindow.setMenuBarVisibility(false);
                projectorWindow.loadURL(url);

                projectorWindow.once('ready-to-show', () => {
                    projectorWindow.show();
                    projectorWindow.focus();
                });

                projectorWindow.on('closed', () => {
                    projectorWindow = null;
                });

                projectorWindow.on('maximize', () => {
                    projectorWindow.setFullScreen(true);
                });
            } catch (err) {
                console.error("FATAL ERROR creating projector window:", err);
            }
        });

        ipcMain.on('toggle-fullscreen', (event) => {
            const win = BrowserWindow.fromWebContents(event.sender);
            if (win) {
                const isNowFS = !win.isFullScreen();
                win.setFullScreen(isNowFS);

                if (isNowFS) {
                    win.setMenuBarVisibility(false);
                    win.autoHideMenuBar = true;
                    win.setMenu(null);
                } else {
                    win.setMenuBarVisibility(false);
                    win.setHasShadow(true);
                }
            }
        });

        app.on('activate', function () {
            if (mainWindow === null) createWindow(port);
        });
    } catch (err) {
        console.error("Failed to start server/app:", err);
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
    if (server) {
        server.close();
    }
});
