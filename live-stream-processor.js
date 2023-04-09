// live-stream-processor.js
import EventEmitter from './event-emitter.js';

class LiveStreamProcessor extends EventEmitter {
    constructor() {
        super();
    }

    processLine(match) {
        try {
            const data = JSON.parse(match[1].trim());
            this.emit('output', data?.choices[0]?.delta?.content.replace(/undefined/, ''));
        } catch (error) {
            if (JSON.stringify(match).includes('stop')) {
                this.emit('complete');
            }
        }
    }
}

export default LiveStreamProcessor;