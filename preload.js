const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    openProjector: (url) => ipcRenderer.send('open-projector', url),
    toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
    closeApp: () => ipcRenderer.send('close-app'),
    youtubeSearch: (query) => ipcRenderer.invoke('youtube-search', query),
    youtubePlaylist: (query) => ipcRenderer.invoke('youtube-playlist', query),
    getPlaylistVideos: (playlistId) => ipcRenderer.invoke('youtube-playlist-videos', playlistId)
});


// Note: YouTube UI Cleaning is now handled via main process (main.js)
// using webRequest blocking and global insertCSS for better reliability.

