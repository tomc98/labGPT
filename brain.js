// main.js
import LiveStreamProcessor from './live-stream-processor.js';

let apiKey = 'api-key';

async function fetchApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get("OPENAIKEY", (result) => {
            resolve(result.OPENAIKEY);
        });
    });
}

(async () => {
    apiKey = await fetchApiKey();
})();


const custom = async (
    query = 'Classify the sentiment in these tweets',
    item = "I can't stand homework",
    examples = [],
) => {
    const processor = new LiveStreamProcessor();

    function onOutput(callback) {
        processor.on('output', callback);
    }

    function onComplete(callback) {
        processor.on('complete', callback);
    }

    try {
        const processedExamples = [];
        if (examples.length > 0) {
            examples.forEach((example) => {
                processedExamples.push({ role: 'user', content: example.item });
                processedExamples.push({ role: 'assistant', content: example.answer });
            });
        }

        const postData = {
            model: 'gpt-4-0314',
            messages: [
                { role: 'system', content: query },
                ...processedExamples,
                { role: 'user', content: item },
            ],
            temperature: 0.85,
            max_tokens: 500,
            stream: true,
        };

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'post',
            body: JSON.stringify(postData),
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
                Accept: 'text/event-stream',
            },
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        async function readStream() {
            reader.read().then(({ done, value }) => {
                if (!done) {
                    const text = decoder.decode(value, { stream: true });
                    const re = /^data:(.*)$/gm;
                    let match;
                    while ((match = re.exec(text)) !== null) {
                        processor.processLine(match);
                    }
                    readStream();
                } else {
                    processor.emit('complete');
                }
            });
        }

        await readStream();
    } catch (error) {
        console.log(error);
    }

    return { onOutput, onComplete };
};

const taggedBagged = async (textIn) => {
    return await custom(
        'Tag the user text as any of the following: claim, googleable, phrase, question, personal, location',
        textIn,
    );
};

const conversation = async (textIn, history, system) => {
    return new Promise(async (resolve) => {
        try {
            const { onOutput, onComplete } = await custom(system, textIn, history);
            let output = '';

            const liveOut = document.getElementById('liveOut');
            const debugOut = document.getElementById('debugOut');

            let sayHolder = '';
            let sayCommandActive = false;
            let mouthful = '';
            let lastsaid = '';
            onOutput((partial) => {
                if (sayHolder.includes('SAY{{{"') || sayHolder.includes('SHOUT{{{"')) {
                    sayHolder = '';
                    sayCommandActive = true;
                }
                if (sayCommandActive) {
                    mouthful += partial;
                    if (sayHolder.includes('"}}}')) {
                        sayCommandActive = false;
                        sayHolder = '';

                    } else {
                        liveOut.innerHTML = sayHolder;
                        if (sayHolder.slice(-1) === '"') {
                            liveOut.innerHTML = sayHolder.slice(0, -1);
                        } else if (sayHolder.slice(-3) === '"}}') {
                            liveOut.innerHTML = sayHolder.slice(0, -3);
                        } else if (sayHolder.slice(-2) === '"}') {
                            liveOut.innerHTML = sayHolder.slice(0, -2);
                        }
                        liveOut.scrollTop = liveOut.scrollHeight;
                        liveOut.innerHTML = liveOut.innerHTML.replace(/\\n/g, '\n');
                    }
                }
                output += partial;
                sayHolder += partial;

                debugOut.innerHTML += partial;
                debugOut.scrollTop = debugOut.scrollHeight;

                if (mouthful.split(' ').length > 7 && mouthful.split(', ').length > 1) {
                    const split = mouthful.split(',');
                    const utter = split.slice(0, split.length - 1).join(',');
                    lastsaid = utter;
                    speakText(utter);
                    mouthful = split[split.length - 1];
                } else if (mouthful.split(' ').length > 3 && mouthful.split('. ').length > 1) {
                    const split = mouthful.split('.');
                    const utter = split.slice(0, split.length - 1).join(' ');
                    lastsaid = utter;
                    speakText(utter);
                    mouthful = split[split.length - 1];
                } else if (mouthful.split(' ').length > 20) {
                    const split = mouthful.split(' ');
                    const utter = split.slice(0, split.length - 1).join(' ');
                    lastsaid = utter;
                    speakText(utter);
                    mouthful = split[split.length - 1];
                }
            });

            onComplete(async () => {
                if (mouthful !== lastsaid || mouthful === '') {
                    lastsaid = mouthful;
                    await speakText(mouthful);
                    resolve(output);
                }
            });
        } catch (error) {
            resolve('Error');
            console.log(error);
        }
    });
};



//tts
async function speakText(text) {
    return new Promise((resolve, reject) => {
        let preProcess = text.replace(new RegExp('(SAY{{{")', "gm"), "");
        preProcess = preProcess.replace(new RegExp('(SHOUT{{{")', "gm"), "");
        preProcess = preProcess.replace(new RegExp('("}}})', "gm"), "");
        preProcess = preProcess.replace(new RegExp('("}}})', "gm"), "");
        preProcess = preProcess.replace(/\\n/g, '\n')

        chrome.tts.speak(preProcess, {
            rate: 1.0, // Speed of speech, 1.0 is the default
            pitch: 1.0, // Pitch modification, 1.0 is the default
            volume: 1.0, // Volume level, 1.0 is the default
            lang: 'en-US', // Language of TTS, default is English language
            enqueue: true, // if true, queues the synthesis behind any other pending utterances
            onEvent: (event) => {
                if (event.type === 'end') {
                    resolve();
                } else if (event.type === 'error') {
                    reject(new Error('TTS Error'));
                }
            }
        });
    });
}

export default { conversation, custom };