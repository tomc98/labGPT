chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    chrome.runtime.sendMessage({ type: "contentScriptReady" });
    if (request.type === "extractBodyText") {
        sendResponse(getTextBlocks());
    }
});

function getTextBlocks() {
    const contentElements = ['P', 'BLOCKQUOTE', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    const allElements = document.querySelectorAll('body *');
    const textBlocks = [];

    function addTextBlock(textNode) {
        const textContent = textNode.textContent.trim();
        const words = textContent.split(/\s+/);
        textBlocks.push(words);
    }

    for (const element of allElements) {
        if (contentElements.includes(element.tagName) && element.textContent.trim() !== '') {
            addTextBlock(element);
        }
    }

    return textBlocks.join('\n\n');
}