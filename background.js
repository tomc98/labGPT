chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "openLabPage") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tabId = tabs[0].id;
            const url = tabs[0].url;

            if (url.startsWith("chrome://") || url.startsWith("chrome-extension://")) {
                sendResponse({ success: false, message: "Cannot access a chrome:// or chrome-extension:// URL" });
                return;
            }

            chrome.scripting.executeScript(
                {
                    target: { tabId: tabId },
                    files: ["content.js"],
                },
                () => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                        sendResponse({ success: false });
                        return;
                    }

                    chrome.tabs.sendMessage(tabId, { type: "extractBodyText" }, (response) => {
                        const markdownNotes = collectMarkdownNotes(response);
                        openCustomLabPage('');
                        saveDataToUserComputer(markdownNotes);
                        sendResponse({ success: true });
                    });
                }
            );
        });

        return true;
    } else if (request.type === "setNotes") {
        chrome.storage.local.set({ notes: request.notes });
    }
});

// // Add this listener
// chrome.runtime.onMessage.addListener((request, sender) => {
//     if (request.type === "contentScriptReady") {
//         onTabFocused(sender.tab.id);
//     }
// });

// function onTabFocused(tabId) {
//     // Inject content script
//     chrome.scripting.executeScript(
//         {
//             target: { tabId: tabId },
//             files: ['content.js']

//         },
//         () => {
//             console.log('Content script injected');
//         }
//     );
//     chrome.tabs.sendMessage(tabId, { type: "extractBodyText" }, (response) => {
//         const markdownNotes = collectMarkdownNotes(response);
//     })
// }


// // Listen to chrome.tabs.onActivated
// chrome.tabs.onActivated.addListener((activeInfo) => {
//     onTabFocused(activeInfo.tabId);
// });

// // Listen to chrome.windows.onFocusChanged
// chrome.windows.onFocusChanged.addListener((windowId) => {
//     if (windowId !== chrome.windows.WINDOW_ID_NONE) {
//         chrome.tabs.query({ active: true, windowId: windowId }, (tabs) => {
//             if (tabs && tabs.length > 0) {
//                 onTabFocused(tabs[0].id);
//             }
//         });
//     }
// });



function collectMarkdownNotes(bodyText) {
    // Modify this function to collect markdown notes from the given bodyText.
    // Example: const notes = bodyText.match(/#.+|##.+/g).join('\n');
    // Use your own logic to filter desired elements.

    return bodyText;
}

function getTextBlocks() {
    const contentElements = ['P', 'BLOCKQUOTE', 'LI'];
    const allElements = document.querySelectorAll('body *');
    const textBlocks = [];

    function addTextBlock(textNode) {
        const textContent = textNode.textContent.trim();
        const words = textContent.split(/\s+/);
        if (words.length > 3) {
            textBlocks.push(textNode);
        }
    }

    for (const element of allElements) {
        if (contentElements.includes(element.tagName) && element.textContent.trim() !== '') {
            addTextBlock(element);
        }
    }

    return textBlocks;
}

function openCustomLabPage(notes) {
    const labPageURL = chrome.runtime.getURL("lab_page.html");

    chrome.tabs.query({ url: labPageURL }, function (tabs) {
        if (tabs.length === 0) {
            chrome.windows.create({ url: labPageURL, type: "popup" });
        }
    });
}



function saveDataToUserComputer(page) {
    // Save data to the user's computer using the storage API.
    chrome.storage.local.set({ page });
}