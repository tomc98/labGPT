import gcse from './gcse.js';
import brain from './brain.js';

const convoHistory = [];

let name = 'John';

async function fetchName() {
    return new Promise((resolve) => {
        chrome.storage.local.get("name", (result) => {
            resolve(result.name);
        });
    });
}

(async () => {
    name = await fetchName();
})();



document.addEventListener("DOMContentLoaded", () => {
    const converter = new showdown.Converter();
    const markdownToggle = document.querySelector('#markdown-toggle');
    const listenToggle = document.querySelector('#listen-toggle');
    const notesSection = document.querySelector('#notes-section');
    const markdownDisplay = document.querySelector('#markdown-display');
    const debugOut = document.getElementById('debugOut');
    const convoHistoryDisplay = document.getElementById('convoHistory');

    chrome.storage.local.get("notes", (data) => {
        document.querySelector("#notes-section").value = data.notes || "";
        updateMarkdownDisplay()
    });

    document.querySelector("#markdown-toggle").addEventListener("click", () => {
        toggleMarkdown()
    });

    document.querySelector("#debug-toggle").addEventListener("click", () => {
        toggleDebug()
    });


    document.getElementById("notes-section").addEventListener("input", function () {
        const notes = document.querySelector("#notes-section").value;
        chrome.runtime.sendMessage({ type: "setNotes", notes: notes });
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === "updateNotes") {
            chrome.storage.local.get("notes", (data) => {
                document.querySelector("#notes-section").value = data.notes || "";
                updateMarkdownDisplay()
            });

        }
    });



    function toggleDebug() {
        if (debugOut.style.display === 'none') {
            debugOut.style.display = 'flex';
            convoHistoryDisplay.style.display = 'flex';
            markdownDisplay.style.height = 'calc(100% - 15em)';
            notesSection.style.height = 'calc(100% - 15em)';
        } else {
            debugOut.style.display = 'none';
            convoHistoryDisplay.style.display = 'none';
            markdownDisplay.style.height = 'calc(100% - 5em)';
            notesSection.style.height = 'calc(100% - 5em)';
        }
    }

    function toggleMarkdown() {
        if (markdownDisplay.style.display === 'none') {
            notesSection.style.display = 'none';
            updateMarkdownDisplay()
            markdownDisplay.style.display = 'block';
            markdownToggle.innerText = 'Toggle Edit';
        } else {
            notesSection.style.display = 'block';
            markdownDisplay.style.display = 'none';
            markdownToggle.innerText = 'Toggle Markdown';
        }
    }

    function updateMarkdownDisplay() {
        const html = converter.makeHtml(notesSection.value);
        markdownDisplay.innerHTML = html;
    }


    // Speech Recognition
    document.querySelector("#listen-toggle").addEventListener("click", () => {
        toggleListen()
    });


    let recognition;
    let isListening = false;
    let shouldListen = false;

    function startRecognition() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();

            recognition.onstart = () => {
                listenToggle.innerText = "Listening...";
                listenToggle.style.backgroundColor = "green";
            };

            recognition.onerror = (event) => {
                console.error("SpeechRecognition error", event.error);

                // Restart speech recognition on error, if needed
                if (event.error === "no-speech") {
                    recognition.start();
                }
            };

            recognition.onend = () => {
                // Restart speech recognition if it ends without providing any results
                if (listenToggle.innerText === "Listening...") {
                    recognition.start();
                }
            };

            recognition.onresult = async (event) => {
                stopRecognition();
                const transcript = event.results[event.results.length - 1][0].transcript;
                listenToggle.style.backgroundColor = "red";
                listenToggle.innerText = "Processing...";

                runAI(transcript);
            };

            recognition.start();
        } catch (error) {
            listenToggle.innerText = "SpeechRecognition not supported in this browser";
        }
    }


    function stopRecognition() {
        if (recognition) {
            recognition.stop();
        }
    }

    function toggleListen() {

        if (isListening) {
            stopRecognition();
            listenToggle.style.backgroundColor = "";
            listenToggle.innerText = "Listen";
        } else {
            startRecognition();
        }
        isListening = !isListening;
        shouldListen = isListening;
    }

    //tts
    async function speakText(text) {
        return new Promise((resolve, reject) => {
            chrome.tts.speak(text, {
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

    //Notes
    async function readFromFile() {
        return new Promise((resolve) => {
            chrome.storage.local.get("notes", (result) => {
                resolve(result.notes);
            });
        });
    }

    async function writeToFile(text) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ notes: text }, () => {
                chrome.storage.local.get("notes", (data) => {
                    document.querySelector("#notes-section").value = data.notes || "";
                    updateMarkdownDisplay()
                    resolve();
                });
            });
        });
    }

    async function runAI(transcript) {
        let rerun = false;

        const labsystemMessage = `You are LabGPT, a helpful large language model tuned to assist the user (${name}) in his lab work.
        ${name} talks about what he's doing out loud, you are to act as a lab partner and scribe.
        The user is located on the Gold Coast of Australia. The date is ${new Date().toDateString()}.
        You can only respond with commands, never with plain text.
        
        Example Response:
        SAY{{{"I am LabGPT, how may I assist you?"}}}
        
        
        ---Commands---
        
        Here are the commands you can use:
        
        SAY{{{"text to say"}}} this command will use tts to communicate with the user
        NOTESPLICE{{{line, deleteCount, "optional text"}}} Works like javascript splice but for each line of the notes file (Add/Insert/delete from file). The notes are viewed in markdown, so remember to add in markdown as nessesary. Pay careful attention to the line numbers given by the preprocessor when editing or inserting.
        SEARCH{{{"Search Query"}}} This will run a google search and return a few results to you. You will then have another turn to decide what to do with the results.
        BROWSER{{{"URL"}}} Use this to open a new browser window to the specified URL.
        SKIP{{{}}} Used when no other command should be run, i.e no action is needed.
        CLEAR{{{}}} This will remove conversation history from the context, but you will keep but you will have access to the updated notes file.


        The notes have a prepended line number attached in this format: "i|". This is to make it easier to splice the notes file. You can ignore this when editing and reading the notes file.
        
        ---Note Start---
        ${notesSection.value.split('\n').map((line, i) => `i|${line}`).join('\n')}
        ---Note End---`.replace(/  +/g, '');;

        const response = await brain.conversation(transcript, convoHistory, labsystemMessage)
        console.log('response: ', response)
        //Parse command
        const commands = splitCommands(response);
        await Promise.all(
            commands.map(async (thiscommand) => {
                return new Promise(async (resolve) => {
                    const [command, content] = thiscommand;
                    console.log('command: ', command);
                    console.log('content: ', content);

                    switch (command) {
                        case 'SAY':
                            convoHistory.push({ item: transcript, answer: response });
                            break;
                        case 'SHOUT':
                            await espeak(content);
                            convoHistory.push({ item: transcript, answer: response });
                            break;
                        case 'NOTEADD':
                            await writeToFile(
                                (readFromFile() + content.replace(/^"(.+(?="$))"$/, '$1'))
                                    .split('\n')
                                    .map((line) => {
                                        return `\n${line.trim(' ').trim('"')}`;
                                    })
                                    .join('\n'),
                            );
                            convoHistory.push({ item: transcript, answer: response });

                            break;
                        case 'NOTESPLICE':
                            //split content into array
                            const contentArray = content.split(',');
                            const tempNote = await readFromFile();
                            const tempNoteArray = tempNote.split('\n');
                            if (contentArray[2] == undefined) contentArray[2] = '';
                            tempNoteArray.splice(
                                Number(contentArray[0].trim()),
                                Number(contentArray[1].trim()),
                                contentArray.slice(2).join(',').trim().replace(/\\n/g, '\n').slice(1, -1),
                            );
                            await writeToFile(tempNoteArray.join('\n').replace(/\\n/g, '\n')
                            );
                            convoHistory.push({ item: transcript, answer: response });

                            break;
                        case 'SEARCH':
                            const res = await search(content);
                            convoHistory.push({ item: transcript, answer: `${response}\n${res}` });
                            rerun = true;
                            break;
                        case 'BROWSER':
                            let url = content.slice(1, -1).trim();
                            window.open(url, '_blank');
                        // case 'CMD':
                        //     const { exec } = require('child_process');
                        //     espeak('Running command');
                        //     exec(content, (error, stdout, stderr) => {
                        //         convoHistory.push({ item: transcript, answer: ` ${response} >> ${stdout}` });
                        //         if (error) {
                        //             console.log(`error: ${error.message}`);
                        //         }
                        //         if (stderr) {
                        //             console.log(`stderr: ${stderr}`);
                        //         }
                        //         console.log(`stdout: ${stdout}`);
                        //     });
                        //     rerun = true;
                        //     break;
                        case 'SKIP':
                            convoHistory.push({ item: transcript, answer: response });
                            break;
                        case 'CLEAR':
                            //Remove all conversation history
                            for (let i = 0; i < convoHistory.length; i++) {
                                convoHistory.pop();
                            }
                            break;
                        default:
                            convoHistory.push({ item: transcript, answer: response });
                            break;
                    }
                    convoHistoryDisplay.innerHTML = JSON.stringify(convoHistory);
                    convoHistoryDisplay.scrollTop = convoHistoryDisplay.scrollHeight;

                    return resolve('Done');
                });
            }),
        );

        if (rerun) {
            return runAI('SKIPPED');
        }

        if (shouldListen) {
            return startRecognition();
        }
    }
});


//Commands
const splitCommands = (commandsString) => {
    const commandsArray = commandsString.match(/([A-Z]+\d*\s*\{\{\{[^}]*\}\}\})+/g);
    commandsArray;
    let commands = [];
    if (commandsArray == null) return [];
    commandsArray.forEach((command) => {
        commands.push(parseCommand(command));
    });
    return commands;
};

function parseCommand(input) {
    const cmdRegex = /^(\w+)\{{{(.*)\}}}$/;

    const matches = cmdRegex.exec(input);

    if (matches) {
        return [matches[1], matches[2]];
    } else {
        return `nullOpenAI: API Response was: Error aborted More information about this error: https://www.codegpt.co/docs/tutorial-basics/api_errors`;
    }
}

function extractCommandAndContent(inputString) {
    const commandRegex = /^(\w+)\{{{(.*)\}}}$/;
    const matched = inputString.match(commandRegex);
    if (matched) {
        const [, command, content] = matched;
        return [command, content];
    }
    return [];
}


const search = async (query) => {
    return new Promise(async (resolve) => {
        const sources = await gcse.search(query);
        let formattedSources = 'Search Snippets:';


        if (sources?.length && sources?.length > 0) {
            sources.forEach((source) => {
                formattedSources += `\n${source.link} -> ${source.snippet}`;
            });
        } else {
            formattedSources += `\nNo results found, try anoter search query or open a tab that would be useful for the user if it makes sense to do so, otherwise tell the user that no results were found.`;
        }
        return resolve(formattedSources);
    });
};