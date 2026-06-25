// Embedded Deployed Google Apps Script Endpoint
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyFFWOMrRFHRycKvIBiUIB4bTuFyucyskoAjlQCeNW0pI77MRWdvElTGgValte2Orv3YQ/exec'; 

let allDataMaster = [];
let allAssignedVideos = []; 
let currentIndex = 0;
let currentUser = "";

window.addEventListener('DOMContentLoaded', initializeApplication);

// Keyboard Listener for "Enter" key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !document.getElementById('playerSection').classList.contains('hidden')) {
        submitResult();
    }
});

async function initializeApplication() {
    const selectElement = document.getElementById("usernameSelect");
    const loadingMsg = document.getElementById("loadingMsg");
    const loginSection = document.getElementById("loginSection");

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        allDataMaster = await response.json(); 
        
        const uniqueUsers = [...new Set(allDataMaster.map(item => item.username).filter(Boolean))];
        
        uniqueUsers.forEach(user => {
            const opt = document.createElement("option");
            opt.value = user;
            opt.textContent = user;
            selectElement.appendChild(opt);
        });

        loadingMsg.classList.add("hidden");
        loginSection.classList.remove("hidden");

    } catch (error) {
        console.error("Initialization error:", error);
        loadingMsg.innerHTML = '<h3 style="color:#ef4444;">Connection Error</h3><p>Could not load the database. Verify backend configuration.</p>';
    }
}

function startSession() {
    const selectElement = document.getElementById("usernameSelect");
    currentUser = selectElement.value;

    if (!currentUser) return; 

    allAssignedVideos = allDataMaster.filter(row => row.username === currentUser);

    if (allAssignedVideos.length > 0) {
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("playerSection").classList.remove("hidden");
        document.getElementById("totalCount").innerText = allAssignedVideos.length;
        loadVideo(currentIndex);
    } else {
        document.getElementById("loginSection").classList.add("hidden");
        document.getElementById("finishedSection").classList.remove("hidden");
    }
}

function formatPlatformName(rawPlatform) {
    const p = (rawPlatform || "").toLowerCase().trim();
    if (p === "youtube") return "YouTube";
    if (p === "tiktok") return "TikTok";
    if (p === "instagram") return "Instagram";
    if (p === "twitter" || p === "x") return "X (Twitter)";
    return p ? (p.charAt(0).toUpperCase() + p.slice(1)) : "Unknown Platform";
}

function loadVideo(index) {
    document.getElementById("currentCount").innerText = index + 1;
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
        const tiktokRegEx = /\/video\/(\d+)/;
        const match = rawUrl.match(tiktokRegEx);
        if (match && match[1]) {
            embedUrl = `https://www.tiktok.com/embed/v2/${match[1]}`;
        } else {
            embedUrl = rawUrl; 
        }
    } else {
        embedUrl = rawUrl; 
    }

    iframe.src = embedUrl;
    document.getElementById("videoContainer").style.display = "block";
    
    document.getElementById("judgement").value = "";
    document.getElementById("notes").value = "";
    document.getElementById("skipReasonSection").classList.add("hidden");
    document.getElementById("skipReason").value = "";
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

function skipResult() {
    const skipSection = document.getElementById("skipReasonSection");

    if (skipSection.classList.contains("hidden")) {
        skipSection.classList.remove("hidden");
        return;
    }

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
    progressSection.classList.remove("hidden");
    
    document.getElementById("progressText").innerText = 
        `Logging review ${currentIndex + 1} of ${allAssignedVideos.length}...`;

    const currentVideo = allAssignedVideos[currentIndex];
    const payload = {
        username: currentUser,
        url: currentVideo.url,
        platform: currentVideo.platform || "", 
        judgement: judgement,
        notes: notes,
        skipped: judgement === "Skipped"
    };

    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        moveNext();

    } catch (error) {
        console.error("Transmission error:", error);
        alert("Submission failed to save.");
        progressSection.classList.add("hidden");
        document.getElementById("playerSection").classList.remove("hidden");
    }
}

function moveNext() {
    currentIndex++;
    const progressSection = document.getElementById("progressSection");

    setTimeout(() => {
        progressSection.classList.add("hidden");
        if (currentIndex < allAssignedVideos.length) {
            document.getElementById("playerSection").classList.remove("hidden");
            loadVideo(currentIndex);
        } else {
            document.getElementById("finishedSection").classList.remove("hidden");
        }
    }, 300); 
}