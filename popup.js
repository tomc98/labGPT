document.getElementById("openLabPage").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.runtime.sendMessage({ type: "openLabPage" }, (response) => {
            // In case we get a response from the background script, close the popup
            if (response && response.success) {
                window.close();
            }
        });
    });
});

document.getElementById("settingsButton").addEventListener("click", () => {
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal.style.display === "block") {
        settingsModal.style.display = "none";
        resizePopup(200, 100);
    } else {
        settingsModal.style.display = "block";
        resizePopup(600, 400);
    }
});

document.getElementById("closeModal").addEventListener("click", () => {
    const settingsModal = document.getElementById("settingsModal");
    settingsModal.style.display = "none";
    resizePopup(200, 30);
});

document.getElementById("saveAPIKey").addEventListener("click", () => {
    const apiKey = document.getElementById("openAIKey").value;
    chrome.storage.local.set({ OPENAIKEY: apiKey }, () => {
        const savedAPIKey = document.getElementById("savedAPIKey");
        savedAPIKey.textContent = `API Key saved: ${obfuscateKey(apiKey)}`;
    });
});

document.getElementById("saveName").addEventListener("click", () => {
    const name = document.getElementById("name").value;
    chrome.storage.local.set({ name }, () => {
        const savedName = document.getElementById("savedName");
        savedName.textContent = `Name saved: ${name}`;
    });
});

function obfuscateKey(key) {
    if (!key || key.length < 6) return key;
    const middleAsterisks = "*".repeat(key.length - 6);
    return key.substr(0, 3) + middleAsterisks + key.substr(-3);
}

window.addEventListener("click", (event) => {
    const settingsModal = document.getElementById("settingsModal");
    if (event.target === settingsModal) {
        settingsModal.style.display = "none";
        resizePopup(200, 30);
    }
});

function resizePopup(width, height) {
    const popupBody = document.getElementsByTagName("body")[0];
    popupBody.style.minWidth = `${width}px`;
    popupBody.style.minHeight = `${height}px`;
}

chrome.storage.local.get("OPENAIKEY", (result) => {
    const savedAPIKey = document.getElementById("savedAPIKey");
    if (result.OPENAIKEY) {
        savedAPIKey.textContent = `Saved API Key: ${obfuscateKey(result.OPENAIKEY)}`;
    }
});

chrome.storage.local.get("name", (result) => {
    const savedName = document.getElementById("savedName");
    if (result.name) {
        savedName.textContent = `Your name: ${result.name}`;
    }
});