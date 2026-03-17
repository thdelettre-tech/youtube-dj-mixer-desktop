$path = "C:\Users\thdel\.gemini\antigravity\scratch\youtube-dj-mixer-desktop\app.js"
$lines = Get-Content -Path $path
$count = $lines.Count
Write-Host "Initial count: $count"

# Precise stay ranges based on previous view_file calls
# Part A: Lines 1-874 (indices 0..873)
$partA = $lines[0..873]

# Part B: Lines 971-1540 (indices 970..1539)
$partB = $lines[970..1539]

# Part C: Lines 1565 to 1921 (indices 1564..1920)
$partC = $lines[1564..1920]

# Part D: Correct generateAISongs implementation
$correctAI = @'
    async generateAISongs() {
        if (!window.electronAPI) {
            showToast("Erreur: API Electron non disponible.", "error");
            return;
        }

        const style = document.getElementById('aiStyleInput').value;
        const year = document.getElementById('aiYearInput').value;
        const artist = document.getElementById('aiArtistInput').value;

        const resultsContainer = document.getElementById('aiResultsList');
        const statusEl = document.getElementById('aiStatus');
        const btn = document.getElementById('aiGenerateBtn');

        // UI Loading State
        resultsContainer.innerHTML = '';
        statusEl.classList.remove('hidden');
        statusEl.innerHTML = '<i class="ph-fill ph-spinner animate-spin mr-1"></i> Chargement du modèle IA (peut être long au 1er lancement)...';
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');

        try {
            // Construct Prompt - Specific for Qwen
            let prompt = `List 20 songs compatible with Style: ${style}`;
            if (year) prompt += `, Year: ${year}`;
            if (artist) prompt += `, similar to Artist: ${artist}`;
            prompt += ". Format: Artist - Title. One song per line. Give only the list.";

            logDebug(`AI Request: ${prompt}`);

            // Call AI via IPC
            const response = await window.electronAPI.generateAI(prompt);

            if (response.success) {
                logDebug("AI Response received");
                let text = response.data;
                
                // Parse Line by Line
                let songs = [];
                const lines = text.split('\n');
                
                lines.forEach(line => {
                    // Clean line
                    line = line.replace(/^\d+[\.\)]\s*/, '').trim(); 
                    if (line.length < 5) return; 

                    // Match "Artist - Title" or "Artist: Title"
                    const match = line.match(/^(.+?)\s*[-–:]\s*(.+)$/);
                    if (match) {
                        songs.push({
                            artist: match[1].trim(),
                            title: match[2].trim()
                        });
                    } else {
                        // Fallback: search for " by "
                        const byMatch = line.match(/^(.+?)\s+by\s+(.+)$/i);
                        if (byMatch) {
                            songs.push({
                                artist: byMatch[2].trim(),
                                title: byMatch[1].trim()
                            });
                        }
                    }
                });

                // Render Songs
                if (songs.length > 0) {
                    songs.forEach(song => {
                        const el = document.createElement('div');
                        el.className = "flex-shrink-0 w-32 group cursor-pointer hover:scale-105 transition-transform";
                        el.onclick = () => {
                             const query = `${song.artist} ${song.title}`;
                             document.getElementById('searchInput').value = query;
                             mixer.searchYouTube(query);
                        };
                        el.innerHTML = `
                            <div class="h-24 w-full bg-zinc-800 rounded-lg flex items-center justify-center mb-2 border border-zinc-700 group-hover:border-dj-neon relative overflow-hidden">
                                <div class="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black opacity-50"></div>
                                <i class="ph-fill ph-music-note text-3xl text-zinc-600 group-hover:text-dj-neon relative z-10 transition-colors"></i>
                            </div>
                            <div class="text-[10px] font-bold text-zinc-300 truncate group-hover:text-white">${escapeHtml(song.title)}</div>
                            <div class="text-[9px] text-zinc-500 truncate">${escapeHtml(song.artist)}</div>
                        `;
                        resultsContainer.appendChild(el);
                    });
                    statusEl.classList.add('hidden');
                } else {
                    console.warn("AI Parsing failed. Raw text:", text);
                    statusEl.innerHTML = "Aucun résultat lisible.";
                    showToast("L'IA n'a pas respecté le format.", "warning");
                }

            } else {
                showToast(`Erreur IA: ${response.error}`, "error");
                statusEl.innerHTML = "Erreur lors de la génération.";
            }

        } catch (e) {
            console.error(e);
            showToast("Erreur inattendue", "error");
            statusEl.innerHTML = "Erreur système.";
        } finally {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }
'@

# Find the end of Part D (the existing block at 1922)
# Step 315 says line 2013 was the end of finally. 2014 was }. 2015 was end of class DJMixer.
# So Part E starts at 2015 (index 2014) to end.
$partE = $lines[2014..($count-1)]

$final = $partA + $partB + $partC + $correctAI + $partE
$final | Set-Content -Path $path
Write-Host "app.js cleaned and modernized successfully"
