// Global Session Variables
let allAssignedVideos = []; 
let currentIndex = 0;
let currentUser = "";
let currentUid = ""; // Tracks the 10-digit database look-up key

window.addEventListener('DOMContentLoaded', initializeApplication);

// Keyboard Listener for "Enter" key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !document.getElementById('playerSection').classList.contains('hidden')) {
        submitResult();
    }
    if (event.key === 'Enter' && !document.getElementById('loginSection').classList.contains('hidden')) {
        attemptLogin();
    }
});

function initializeApplication() {
    const savedUser = localStorage.getItem("currentUser");
    const savedUid = localStorage.getItem("currentUid");
    const savedVideos = localStorage.getItem("assignedVideos");
    const savedIndex = localStorage.getItem("currentIndex"); 

    if (savedUser && savedVideos && savedUid) {
        currentUser = savedUser;
        currentUid = savedUid;
        allAssignedVideos = JSON.parse(savedVideos);
        currentIndex = savedIndex ? parseInt(savedIndex) : 0; 

        // AUTO-LOGOUT GATEKEEPER:
        // If they refresh while on the finished screen or have no assignments, log out immediately
        if (currentIndex >= allAssignedVideos.length || allAssignedVideos.length === 0) {
            localStorage.clear();
            document.getElementById("loginSection").classList.remove("hidden");
            document.getElementById("characterDisplay").classList.remove("hidden");
            document.getElementById("finishedSection").classList.add("hidden");
        } else {
            document.getElementById("loginSection").classList.add("hidden");
            document.getElementById("characterDisplay").classList.add("hidden");
            document.getElementById("playerSection").classList.remove("hidden");
            document.getElementById("totalCount").innerText = allAssignedVideos.length;
            loadVideo(currentIndex);
        }
    } else {
        localStorage.clear();
        document.getElementById("loginSection").classList.remove("hidden");
        document.getElementById("characterDisplay").classList.remove("hidden");
    }
    
    document.getElementById("loadingMsg").classList.add("hidden");
}

async function attemptLogin() {
    const uid = document.getElementById("uidInput").value.trim();
    const password = document.getElementById("passwordInput").value.trim();
    const loginError = document.getElementById("loginError");
    const loginBtn = document.getElementById("loginBtn");

    if (!uid || !password) {
        if (loginError) {
            loginError.innerText = "Please enter both UID and Password.";
            loginError.classList.remove("hidden");
        } else {
            alert("Please enter both UID and Password.");
        }
        return;
    }

    loginBtn.innerText = "Verifying...";
    loginBtn.disabled = true;
    if (loginError) loginError.classList.add("hidden");

    // 1. Show loading screen, hide the login section and the character image
    document.getElementById("loadingMsg").classList.remove("hidden");
    document.getElementById("loginSection").classList.add("hidden");
    document.getElementById("characterDisplay").classList.add("hidden");

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: uid, password: password })
        });
        
        const result = await response.json();

        // 2. Hide the loading screen once the server responds
        document.getElementById("loadingMsg").classList.add("hidden");

        if (response.ok && result.success) {
            currentUser = result.username;
            currentUid = uid; // Save the 10-digit ID used to log in
            allAssignedVideos = result.assignedVideos;
            currentIndex = 0;
            
            if (allAssignedVideos.length > 0) {
                // Save complete active session properties
                localStorage.setItem("currentUser", currentUser);
                localStorage.setItem("currentUid", currentUid);
                localStorage.setItem("assignedVideos", JSON.stringify(allAssignedVideos));
                localStorage.setItem("currentIndex", currentIndex);

                document.getElementById("playerSection").classList.remove("hidden");
                document.getElementById("totalCount").innerText = allAssignedVideos.length;
                loadVideo(currentIndex);
            } else {
                // Instantly wipe memory so refreshing this empty state triggers a login fallback
                localStorage.clear();
                document.getElementById("finishedSection").classList.remove("hidden");
            }
        } else {
            // 3. If login fails, bring the character and form back
            document.getElementById("loginSection").classList.remove("hidden");
            document.getElementById("characterDisplay").classList.remove("hidden");
            
            if (loginError) {
                loginError.innerText = result.message || "Invalid UID or Password.";
                loginError.classList.remove("hidden");
            } else {
                alert(result.message || "Invalid UID or Password.");
            }
            loginBtn.innerText = "Log In";
            loginBtn.disabled = false;
        }
    } catch (error) {
        console.error("Login error details:", error);
        
        // 4. Catch network crashes and bring the form and character back
        document.getElementById("loadingMsg").classList.add("hidden");
        document.getElementById("loginSection").classList.remove("hidden");
        document.getElementById("characterDisplay").classList.remove("hidden");

        if (loginError) {
            loginError.innerText = "Error: " + error.message; 
            loginError.classList.remove("hidden");
        } else {
            alert("Error: " + error.message);
        }
        loginBtn.innerText = "Log In";
        loginBtn.disabled = false;
    }
}

async function loadVideo(index) {
    document.getElementById("currentCount").innerText = index + 1;
    document.getElementById("totalCount").innerText = allAssignedVideos.length; 

    // ETA CALCULATION
    let totalRemainingSeconds = 0;
    for (let i = index; i < allAssignedVideos.length; i++) {
        totalRemainingSeconds += parseDurationToSeconds(allAssignedVideos[i].duration);
    }
    document.getElementById("etaDisplay").innerText = formatSecondsToETA(totalRemainingSeconds);
    document.getElementById("topInfo").classList.remove("hidden");

    const videoData = allAssignedVideos[index];
    const iframe = document.getElementById("videoFrame");
    const directLink = document.getElementById("directOpenLink");
    const platformLabel = document.getElementById("platformLabel");

    let embedUrl = "";
    const rawUrl = (videoData.url || "").trim();
    const platform = (videoData.platform || "").toLowerCase().trim();

    platformLabel.textContent = formatPlatformName(platform);
    directLink.href = rawUrl;

    if (rawUrl.includes("youtu") || platform === "youtube") {
        const ytRegEx = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|\/shorts\/)([^#\&\?]*).*/;
        const match = rawUrl.match(ytRegEx);
        if (match && match[2].length === 11) {
            embedUrl = `https://www.youtube-nocookie.com/embed/${match[2]}`;
        } else {
            embedUrl = rawUrl;
        }
    } else if (platform === "instagram" || rawUrl.includes("instagram.com")) {
        let cleanUrl = rawUrl.split('?')[0]; 
        if (!cleanUrl.endsWith('/')) { cleanUrl += '/'; }
        embedUrl = `${cleanUrl}embed`; 
    } else if (platform === "tiktok" || rawUrl.includes("tiktok.com")) {
        let finalTikTokUrl = rawUrl;
        let embedHtml = null;

        if (isTikTokShortUrl(rawUrl)) {
            embedHtml = await getTikTokOEmbedHtml(rawUrl);
            if (!embedHtml) {
                finalTikTokUrl = await resolveTikTokShortUrl(rawUrl);
            }
        }

        const tiktokId = getTikTokVideoId(finalTikTokUrl);
        if (embedHtml) {
            renderTikTokEmbedHtml(embedHtml);
        } else {
            renderTikTokEmbed(finalTikTokUrl, tiktokId);
        }
        embedUrl = "";
    } else {
        embedUrl = rawUrl; 
    }

    if (embedUrl) {
        iframe.style.display = "block";
        iframe.src = embedUrl;
        document.getElementById("tiktokEmbedWrapper").style.display = "none";
        document.getElementById("videoContainer").style.display = "block";
    } else if (!rawUrl.includes("tiktok.com")) {
        hideVideoFrames();
    }
    
    document.getElementById("judgement").value = "";
    document.getElementById("notes").value = "";

    // Reset skip area to collapsed state
    document.getElementById("skipReasonSection").classList.add("hidden");
    document.getElementById("skipReason").value = "";
}

function getTikTokVideoId(url) {
    const longMatch = url.match(/(?:\/video\/)(\d+)/);
    if (longMatch && longMatch[1]) {
        return longMatch[1];
    }

    return null;
}

function isTikTokShortUrl(url) {
    return /(vt|vm|t)\.tiktok\.com\/[A-Za-z0-9]+/.test(url);
}

async function resolveTikTokShortUrl(shortUrl) {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(shortUrl)}`;
    try {
        const response = await fetch(proxyUrl);
        const html = await response.text();

        const metaMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
        if (metaMatch && metaMatch[1]) {
            return metaMatch[1];
        }

        const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
        if (canonicalMatch && canonicalMatch[1]) {
            return canonicalMatch[1];
        }

        const redirectMatch = html.match(/href=["'](https?:\\/\\/www\.tiktok\.com\\/[^"']+)["']/i);
        if (redirectMatch && redirectMatch[1]) {
            return redirectMatch[1];
        }
    } catch (error) {
        console.warn('TikTok short URL resolution failed:', error);
    }
    return shortUrl;
}

function hideVideoFrames() {
    const iframe = document.getElementById("videoFrame");
    const tiktokWrapper = document.getElementById("tiktokEmbedWrapper");
    iframe.src = "";
    iframe.style.display = "none";
    tiktokWrapper.style.display = "none";
    document.getElementById("videoContainer").style.display = "none";
}

function renderTikTokEmbed(rawUrl, tiktokId) {
    const iframe = document.getElementById("videoFrame");
    const wrapper = document.getElementById("tiktokEmbedWrapper");
    iframe.style.display = "none";
    iframe.src = "";
    wrapper.style.display = "flex";
    wrapper.innerHTML = "";

    const blockquote = document.createElement("blockquote");
    blockquote.className = "tiktok-embed";
    blockquote.setAttribute("cite", rawUrl);
    blockquote.setAttribute("style", "max-width:605px;min-width:325px;width:100%;");
    if (tiktokId) {
        blockquote.setAttribute("data-video-id", tiktokId);
    }

    const section = document.createElement("section");
    const anchor = document.createElement("a");
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noreferrer noopener");
    anchor.setAttribute("href", rawUrl);
    anchor.textContent = "View on TikTok";
    section.appendChild(anchor);
    blockquote.appendChild(section);
    wrapper.appendChild(blockquote);

    const existing = document.getElementById("tiktokEmbedScript");
    if (existing) {
        existing.remove();
    }

    const script = document.createElement("script");
    script.id = "tiktokEmbedScript";
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    wrapper.appendChild(script);

    appendTikTokFallbackButton(wrapper, rawUrl);
    document.getElementById("videoContainer").style.display = "block";
}

function renderTikTokFallback(rawUrl) {
    const wrapper = document.getElementById("tiktokEmbedWrapper");
    wrapper.style.display = "flex";
    wrapper.innerHTML = "";

    const message = document.createElement("div");
    message.textContent = "TikTok video failed to embed. Open directly instead:";
    message.style.color = "var(--text-muted)";
    message.style.textAlign = "center";
    message.style.marginBottom = "12px";
    wrapper.appendChild(message);

    appendTikTokFallbackButton(wrapper, rawUrl);

    document.getElementById("videoContainer").style.display = "block";
}

function appendTikTokFallbackButton(wrapper, rawUrl) {
    const fallbackLink = document.createElement("a");
    fallbackLink.href = rawUrl;
    fallbackLink.target = "_blank";
    fallbackLink.rel = "noreferrer noopener";
    fallbackLink.className = "tiktok-fallback-button";
    fallbackLink.innerHTML = `Open directly <span>↗</span>`;
    wrapper.appendChild(fallbackLink);
}

function renderTikTokEmbedHtml(embedHtml) {
    const iframe = document.getElementById("videoFrame");
    const wrapper = document.getElementById("tiktokEmbedWrapper");
    iframe.style.display = "none";
    iframe.src = "";
    wrapper.style.display = "block";
    wrapper.innerHTML = embedHtml;

    const existing = document.getElementById("tiktokEmbedScript");
    if (existing) {
        existing.remove();
    }

    const script = document.createElement("script");
    script.id = "tiktokEmbedScript";
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    wrapper.appendChild(script);

    document.getElementById("videoContainer").style.display = "block";
}

function formatPlatformName(rawPlatform) {
    const p = (rawPlatform || "").toLowerCase().trim();
    if (p === "youtube") return "YouTube";
    if (p === "tiktok") return "TikTok";
    if (p === "instagram") return "Instagram";
    if (p === "twitter" || p === "x") return "X (Twitter)";
    return p ? (p.charAt(0).toUpperCase() + p.slice(1)) : "Unknown Platform";
}

async function submitResult() {
    const judgement = document.getElementById("judgement").value;
    const notes = document.getElementById("notes").value;
    
    if (!judgement) {
        alert("Please select a judgement outcome before proceeding.");
        return;
    }
    executeSave(judgement, notes);
}

// Toggles the skip reason panel open/closed
function toggleSkip() {
    const skipSection = document.getElementById("skipReasonSection");
    skipSection.classList.toggle("hidden");
    if (!skipSection.classList.contains("hidden")) {
        document.getElementById("skipReason").value = "";
    }
}

function skipResult() {
    const reason = document.getElementById("skipReason").value;
    if (!reason) {
        alert("Please select a reason for skipping.");
        return;
    }
    executeSave("Skipped", reason);
}

async function executeSave(judgement, notes) {
    document.getElementById("playerSection").classList.add("hidden");
    const progressSection = document.getElementById("progressSection");
    
    // Videos remaining after this one
    const remaining = allAssignedVideos.length - (currentIndex + 1);
    document.getElementById("videosLeftText").innerText = `${remaining} video(s) remaining to review`;

    progressSection.classList.remove("hidden");
    
    const currentVideo = allAssignedVideos[currentIndex];
    
    const payload = {
        rowId: currentVideo.id,
        username: currentUser,
        url: currentVideo.url,
        platform: currentVideo.platform || "Unknown",
        judgement: judgement,
        notes: notes
    };

    try {
        const response = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            moveNext();
        } else {
            const errorData = await response.json();
            alert("Save Failed: " + (errorData.message || "Unknown error"));
            progressSection.classList.add("hidden");
            document.getElementById("playerSection").classList.remove("hidden");
        }
    } catch (error) {
        alert("Transmission error. Check console.");
        progressSection.classList.add("hidden");
        document.getElementById("playerSection").classList.remove("hidden");
    }
}

function moveNext() {
    currentIndex++;
    localStorage.setItem("currentIndex", currentIndex);
    const progressSection = document.getElementById("progressSection");
    
    setTimeout(() => {
        progressSection.classList.add("hidden");
        
        if (currentIndex < allAssignedVideos.length) {
            document.getElementById("playerSection").classList.remove("hidden");
            loadVideo(currentIndex);
        } else {
            // FINISHED ALL VIDEOS
            // Clear local cache completely so page refresh causes automatic logout
            localStorage.clear();

            document.getElementById("playerSection").classList.add("hidden");
            document.getElementById("finishedSection").classList.remove("hidden");
        }
    }, 300); 
}

async function fetchAssignedVideos(uid, showLoading = true) {
    // If cache was wiped, check our active runtime variable fallback
    const lookupUid = uid || currentUid;
    
    if (!lookupUid) {
        alert("Session context missing. Refreshing to return to login screen.");
        localStorage.clear();
        location.reload();
        return;
    }

    if (showLoading) {
        document.getElementById("loadingMsg").innerHTML = `<div class="spinner"></div><h3>Syncing</h3><p>Checking database entries...</p>`;
        document.getElementById("loadingMsg").classList.remove("hidden");
    }
    
    try {
        const response = await fetch('/api/get-videos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: lookupUid })
        });
        
        const result = await response.json();
        
        if (result.success) {
            allAssignedVideos = result.assignedVideos;
            document.getElementById("loadingMsg").classList.add("hidden");
            
            if (allAssignedVideos.length > 0) {
                // Re-establish session values to protect against page refreshes
                localStorage.setItem("currentUser", currentUser);
                localStorage.setItem("currentUid", currentUid);
                localStorage.setItem("assignedVideos", JSON.stringify(allAssignedVideos));
                
                currentIndex = 0;
                localStorage.setItem("currentIndex", currentIndex);

                document.getElementById("finishedSection").classList.add("hidden");
                document.getElementById("playerSection").classList.remove("hidden");
                document.getElementById("totalCount").innerText = allAssignedVideos.length;
                loadVideo(currentIndex);
                alert(`Sync complete! Loaded ${allAssignedVideos.length} new video(s).`);
            } else {
                // Keep things locked out if array remains empty
                localStorage.clear();
                document.getElementById("finishedSection").classList.remove("hidden");
                document.getElementById("playerSection").classList.add("hidden");
                alert("No new items assigned yet.");
            }
        }
    } catch (err) {
        alert("Sync failed: " + err.message);
        document.getElementById("loadingMsg").classList.add("hidden");
    }
}

function parseDurationToSeconds(durationStr) {
    if (!durationStr) return 0;
    const parts = String(durationStr).trim().split(':').map(Number);
    if (parts.some(isNaN)) return 0;
    
    if (parts.length === 2) {
        return (parts[0] * 60) + parts[1];
    } else if (parts.length === 3) {
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    }
    return 0;
}

function formatSecondsToETA(totalSeconds) {
    if (totalSeconds <= 0) return "0m";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60); 
    
    if (hours > 0) {
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
}