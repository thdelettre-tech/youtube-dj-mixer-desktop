$path = "C:\Users\thdel\.gemini\antigravity\scratch\youtube-dj-mixer-desktop\app.js"
$lines = Get-Content -Path $path
$count = $lines.Count
Write-Host "Current line count: $count"

# Start index: Find "async generateAISongs"
$startIndex = -1
for ($i = 0; $i -lt $count; $i++) {
    if ($lines[$i] -match "async generateAISongs") {
        Write-Host "Found method at line $($i+1)"
        for ($j = $i; $j -lt $i + 15; $j++) {
             if ($lines[$j] -match "try\s*\{") {
                 $startIndex = $j
                 Write-Host "Found try block at line $($j+1)"
                 break
             }
        }
        break
    }
}

if ($startIndex -eq -1) {
    Write-Error "Could not find start index (try block)"
    exit
}

# End index: Find the finally block closing brace
$endIndex = -1
for ($i = $startIndex; $i -lt $count; $i++) {
    if ($lines[$i] -match "btn\.classList\.remove") {
         # The next few lines should be the end of finally and end of method
         for ($k = $i; $k -lt $i + 5; $k++) {
             if ($lines[$k] -match "^\s*\}\s*$") {
                 # This is likely the end of finally
                 # The one after should be the end of method
                 if ($lines[$k+1] -match "^\s*\}\s*$") {
                     $endIndex = $k + 1
                     Write-Host "Found end of method at line $($endIndex+1)"
                     break
                 }
                 # Fallback: if we just find one closing brace after btn.classList.remove
                 $endIndex = $k
                 break
             }
         }
         if ($endIndex -ne -1) { break }
    }
}

if ($endIndex -eq -1) {
    # Fallback search for end of method
    for ($i = $startIndex; $i -lt $startIndex + 100; $i++) {
        if ($lines[$i] -match "^\s*\}\s*$" -and $lines[$i-1] -match "^\s*\}\s*$") {
             $endIndex = $i
             break
        }
    }
}

if ($endIndex -eq -1) {
    Write-Error "Could not find end index"
    exit
}

Write-Host "Replacing lines $($startIndex+1) to $($endIndex+1)"

$part1 = $lines[0..($startIndex-1)]
$part2 = $lines[($endIndex+1)..($count-1)]

$newContent = @'
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
                    line = line.replace(/^\d+[\.\)]\s*/, '').trim(); // Remove numbering "1. "
                    if (line.length < 5) return; // Skip too short lines

                    // Regex to match "Artist - Title" or "Artist: Title"
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
                             // Search and Load
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
                    statusEl.innerHTML = "Format invalide. Essayez d'être plus précis.";
                    showToast("L'IA n'a pas respecté le format.", "warning");
                }

            } else {
                showToast(`Erreur IA: ${response.error}`, "error");
                statusEl.innerHTML = "Erreur lors de la génération.";
            }

        } catch (e) {
            console.error(e);
            showToast("Erreur inattendue.", "error");
            statusEl.innerHTML = "Erreur système.";
        } finally {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
'@

$final = $part1 + $newContent + $part2
$final | Set-Content -Path $path
Write-Host "Successfully patched app.js"
