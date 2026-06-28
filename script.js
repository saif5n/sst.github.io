// Global Session Variables
let allAssignedVideos = []; 
let currentIndex = 0;
let currentUser = "";
let currentUid = "";
let videoDrafts = {};

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

// ── Logout button visibility helpers ──
function showLogoutButton() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.classList.remove('hidden');
}

function hideLogoutButton() {
    const btn = document.getElementById('logoutBtn');
    if (btn) btn.classList.add('hidden');
}

// ── Direct link icon ──
function showDirectLink(url) {
    const link = document.getElementById('directOpenLink');
    if (!link) return;
    link.href = url || '#';
    link.classList.remove('hidden');
}

function hideDirectLink() {
    const link = document.getElementById('directOpenLink');
    if (link) link.classList.add('hidden');
}

// ── Progress bar ──
function updateProgressBar(current, total) {
    const container = document.getElementById('progressBarContainer');
    const fill = document.getElementById('progressBarFill');
    if (!container || !fill || total === 0) return;
    container.classList.remove('hidden');
    fill.style.width = ((current / total) * 100) + '%';
}

function hideProgressBar() {
    const container = document.getElementById('progressBarContainer');
    if (container) container.classList.add('hidden');
}

function initializeApplication() {
    const urlParams = new URLSearchParams(window.location.search);
    const previewMode = urlParams.get("preview") === "true";
    const savedUser = localStorage.getItem("currentUser");
    const savedUid = localStorage.getItem("currentUid");
    const savedVideos = localStorage.getItem("assignedVideos");
    const savedIndex = localStorage.getItem("currentIndex"); 

    if (previewMode) {
        currentUser = "Preview";
        currentUid = "0000000000";
        currentIndex = 0;
        allAssignedVideos = [
            { id: 1, url: "https://www.tiktok.com/@scout2015/video/7183715007844314117", platform: "tiktok", duration: "00:15" },
            { id: 2, url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", platform: "youtube", duration: "00:30" }
        ];

        videoDrafts = {};
        localStorage.setItem("currentUser", currentUser);
        localStorage.setItem("currentUid", currentUid);
        localStorage.setItem("assignedVideos", JSON.stringify(allAssignedVideos));
        localStorage.setItem("videoDrafts", JSON.stringify(videoDrafts));
        localStorage.setItem("currentIndex", currentIndex);

        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("characterDisplay").classList.add("hidden");
        document.getElementById("playerSection").classList.remove("hidden");
        document.getElementById("totalCount").innerText = allAssignedVideos.length;
        showLogoutButton();
        loadVideo(currentIndex);
    } else if (savedUser && savedVideos && savedUid) {
        currentUser = savedUser;
        currentUid = savedUid;
        allAssignedVideos = JSON.parse(savedVideos);
        videoDrafts = JSON.parse(localStorage.getItem("videoDrafts") || "{}");
        currentIndex = savedIndex ? parseInt(savedIndex) : 0; 

        // AUTO-LOGOUT GATEKEEPER
        if (currentIndex >= allAssignedVideos.length || allAssignedVideos.length === 0) {
            localStorage.clear();
            document.getElementById("loginSection").classList.remove("hidden");
            document.getElementById("characterDisplay").classList.remove("hidden");
            document.getElementById("finishedSection").classList.add("hidden");
            hideLogoutButton();
        } else {
            document.getElementById("loginSection").classList.add("hidden");
            document.getElementById("characterDisplay").classList.add("hidden");
            document.getElementById("playerSection").classList.remove("hidden");
            document.getElementById("totalCount").innerText = allAssignedVideos.length;
            showLogoutButton();
            loadVideo(currentIndex);
        }
    } else {
        localStorage.clear();
        document.getElementById("loginSection").classList.remove("hidden");
        document.getElementById("characterDisplay").classList.remove("hidden");
        hideLogoutButton();
    }
    
    document.getElementById("loadingMsg").classList.add("hidden");
}

// Center the Content Review header only when the login view is visible
function updateHeaderAlignment() {
    const loginVisible = !document.getElementById('loginSection').classList.contains('hidden');
    const headerRow = document.querySelector('.review-header-row');
    if (!headerRow) return;
    if (loginVisible) {
        headerRow.classList.add('center-login-header');
    } else {
        headerRow.classList.remove('center-login-header');
    }
}

window.addEventListener('DOMContentLoaded', updateHeaderAlignment);
const observer = new MutationObserver(updateHeaderAlignment);
const loginSection = document.getElementById('loginSection');
if (loginSection) observer.observe(loginSection, { attributes: true, attributeFilter: ['class'] });

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
        document.getElementById("loadingMsg").classList.add("hidden");

        if (response.ok && result.success) {
            currentUser = result.username;
            currentUid = uid;
            allAssignedVideos = result.assignedVideos;
            currentIndex = 0;
            videoDrafts = {};
            
            if (allAssignedVideos.length > 0) {
                localStorage.setItem("currentUser", currentUser);
                localStorage.setItem("currentUid", currentUid);
                localStorage.setItem("assignedVideos", JSON.stringify(allAssignedVideos));
                localStorage.setItem("videoDrafts", JSON.stringify(videoDrafts));
                localStorage.setItem("currentIndex", currentIndex);

                document.getElementById("playerSection").classList.remove("hidden");
                document.getElementById("totalCount").innerText = allAssignedVideos.length;
                showLogoutButton();
                loadVideo(currentIndex);
            } else {
                localStorage.clear();
                document.getElementById("finishedSection").classList.remove("hidden");
                const topInfoEl = document.getElementById('topInfo');
                if (topInfoEl) topInfoEl.classList.add('hidden');
                hideProgressBar();
                hideDirectLink();
                hideLogoutButton();
            }
        } else {
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
            hideLogoutButton();
        }
    } catch (error) {
        console.error("Login error details:", error);
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
        hideLogoutButton();
    }
}

async function loadVideo(index) {
    const finishedSection = document.getElementById('finishedSection');
    if (finishedSection && !finishedSection.classList.contains('hidden')) {
        finishedSection.classList.add('hidden');
        const playerSection = document.getElementById('playerSection');
        if (playerSection) playerSection.classList.remove('hidden');
    }

    document.getElementById("currentCount").innerText = index + 1;
    document.getElementById("totalCount").innerText = allAssignedVideos.length;

    // Progress bar
    updateProgressBar(index, allAssignedVideos.length);

    // ETA
    let totalRemainingSeconds = 0;
    for (let i = index; i < allAssignedVideos.length; i++) {
        totalRemainingSeconds += parseDurationToSeconds(allAssignedVideos[i].duration);
    }
    document.getElementById("etaDisplay").innerText = formatSecondsToETA(totalRemainingSeconds);
    document.getElementById("topInfo").classList.remove("hidden");

    const videoData = allAssignedVideos[index];
    const iframe = document.getElementById("videoFrame");
    const prevButton = document.getElementById("prevVideoBtn");

    let embedUrl = "";
    const rawUrl = normalizeUrl((videoData.url || "").trim());
    const platform = (videoData.platform || "").toLowerCase().trim();

    // Update the direct link icon in the header
    showDirectLink(rawUrl);

    prevButton.classList.remove("hidden");
    prevButton.disabled = index === 0;

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
            const resolved = await resolveTikTokShortUrl(rawUrl);
            finalTikTokUrl = resolved.url || rawUrl;
            embedHtml = resolved.html;
        }

        const tiktokId = getTikTokVideoId(finalTikTokUrl);
        if (embedHtml) {
            renderTikTokEmbedHtml(embedHtml, finalTikTokUrl);
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
    
    const draftKey = getVideoDraftKey(videoData);
    const draft = videoDrafts[draftKey] || {};
    document.getElementById("judgement").value = draft.judgement || "";
    document.getElementById("notes").value = draft.notes || "";

    const skipSection = document.getElementById("skipReasonSection");
    const skipReasonInput = document.getElementById("skipReason");
    skipReasonInput.value = draft.skipReason || "";
    if (draft.skipReason && String(draft.skipReason).trim() !== "") {
        skipSection.classList.remove("hidden");
    } else {
        skipSection.classList.add("hidden");
    }
}

function persistDrafts() {
    localStorage.setItem("videoDrafts", JSON.stringify(videoDrafts));
}

function saveCurrentVideoState() {
    const currentVideo = allAssignedVideos[currentIndex];
    if (!currentVideo) return;

    const draftKey = getVideoDraftKey(currentVideo);
    videoDrafts[draftKey] = {
        judgement: document.getElementById("judgement").value,
        notes: document.getElementById("notes").value,
        skipReason: document.getElementById("skipReason").value || ""
    };

    persistDrafts();
}

function getVideoDraftKey(videoData) {
    return String(videoData.id ?? videoData.url ?? currentIndex);
}

function getTikTokVideoId(url) {
    const longMatch = url.match(/(?:\/video\/)(\d+)/);
    if (longMatch && longMatch[1]) return longMatch[1];
    return null;
}

function isTikTokShortUrl(url) {
    return /(vt|vm|t)\.tiktok\.com\/[A-Za-z0-9]+/.test(url);
}

async function getTikTokOEmbedHtml(rawUrl) {
    try {
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.tiktok.com/oembed?url=${rawUrl}`)}`;
        const response = await fetch(proxyUrl);
        if (!response.ok) return null;
        const data = await response.json();
        return data.html || null;
    } catch (error) {
        console.warn('TikTok oEmbed resolution failed:', error);
        return null;
    }
}

async function resolveTikTokShortUrl(shortUrl) {
    try {
        const response = await fetch(`/api/resolve-tiktok?url=${encodeURIComponent(shortUrl)}`);
        if (!response.ok) return { url: shortUrl, html: null };
        const json = await response.json();
        return { url: json.url || shortUrl, html: json.html || null };
    } catch (error) {
        console.warn('TikTok short URL resolution failed:', error);
        return { url: shortUrl, html: null };
    }
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
    wrapper.style.flexDirection = "column";
    wrapper.innerHTML = "";

    const blockquote = document.createElement("blockquote");
    blockquote.className = "tiktok-embed";
    blockquote.setAttribute("cite", rawUrl);
    blockquote.setAttribute("style", "width:100%;max-width:605px;");
    if (tiktokId) blockquote.setAttribute("data-video-id", tiktokId);

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
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "tiktokEmbedScript";
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    wrapper.appendChild(script);
    document.getElementById("videoContainer").style.display = "block";
}

function goToPreviousVideo() {
    if (currentIndex > 0) {
        currentIndex -= 1;
        localStorage.setItem("currentIndex", currentIndex);
        loadVideo(currentIndex);
    }
}

function renderTikTokEmbedHtml(embedHtml, rawUrl) {
    const iframe = document.getElementById("videoFrame");
    const wrapper = document.getElementById("tiktokEmbedWrapper");
    iframe.style.display = "none";
    iframe.src = "";
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.innerHTML = embedHtml;

    const existing = document.getElementById("tiktokEmbedScript");
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.id = "tiktokEmbedScript";
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    wrapper.appendChild(script);
    document.getElementById("videoContainer").style.display = "block";
}

function normalizeUrl(raw) {
    const markdownLinkMatch = raw.match(/\[([^\]]+)\]\((https?:\/\/[^")]+)\)/i);
    if (markdownLinkMatch && markdownLinkMatch[2]) return markdownLinkMatch[2].trim();
    return raw;
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

    saveCurrentVideoState();

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
            currentIndex = allAssignedVideos.length;
            localStorage.setItem("currentIndex", currentIndex);

            updateProgressBar(allAssignedVideos.length, allAssignedVideos.length);

            document.getElementById("playerSection").classList.add("hidden");
            document.getElementById("finishedSection").classList.remove("hidden");
            const topInfoFinished = document.getElementById('topInfo');
            if (topInfoFinished) topInfoFinished.classList.add('hidden');
            hideProgressBar();
            hideDirectLink();
            hideLogoutButton();

            const prevBtn = document.getElementById('prevVideoBtn');
            if (prevBtn) prevBtn.classList.add('hidden');
        }
    }, 300); 
}

async function fetchAssignedVideos(uid, showLoading = true) {
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
                videoDrafts = {};
                localStorage.setItem("currentUser", currentUser);
                localStorage.setItem("currentUid", currentUid);
                localStorage.setItem("assignedVideos", JSON.stringify(allAssignedVideos));
                localStorage.setItem("videoDrafts", JSON.stringify(videoDrafts));
                
                currentIndex = 0;
                localStorage.setItem("currentIndex", currentIndex);

                document.getElementById("finishedSection").classList.add("hidden");
                document.getElementById("playerSection").classList.remove("hidden");
                document.getElementById("totalCount").innerText = allAssignedVideos.length;
                showLogoutButton();
                loadVideo(currentIndex);
                alert(`Sync complete! Loaded ${allAssignedVideos.length} new video(s).`);
            } else {
                localStorage.clear();
                document.getElementById("finishedSection").classList.remove("hidden");
                document.getElementById("playerSection").classList.add("hidden");
                const topInfo = document.getElementById('topInfo');
                if (topInfo) topInfo.classList.add('hidden');
                hideProgressBar();
                hideDirectLink();
                hideLogoutButton();
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
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    return 0;
}

function formatSecondsToETA(totalSeconds) {
    if (totalSeconds <= 0) return "0m";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.ceil((totalSeconds % 3600) / 60); 
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
}

function handleLogout() {
    localStorage.clear();

    allAssignedVideos = [];
    currentIndex = 0;
    currentUser = "";
    currentUid = "";
    videoDrafts = {};

    document.getElementById('playerSection').classList.add('hidden');
    document.getElementById('finishedSection').classList.add('hidden');
    document.getElementById('progressSection').classList.add('hidden');
    document.getElementById('topInfo').classList.add('hidden');
    document.getElementById('loadingMsg').classList.add('hidden');
    document.getElementById('prevVideoBtn').classList.add('hidden');
    hideProgressBar();
    hideDirectLink();

    document.getElementById('characterDisplay').classList.remove('hidden');
    document.getElementById('loginSection').classList.remove('hidden');

    document.getElementById('uidInput').value = '';
    document.getElementById('passwordInput').value = '';
    document.getElementById('loginError').classList.add('hidden');

    const loginBtn = document.getElementById('loginBtn');
    if (loginBtn) {
        loginBtn.innerText = 'Log In';
        loginBtn.disabled = false;
    }

    hideLogoutButton();
}