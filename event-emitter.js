// event-emitter.js
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (this.events[event]) {
            this.events[event].push(listener);
        } else {
            this.events[event] = [listener];
        }
    }

    emit(event, arg) {
        if (this.events[event]) {
            this.events[event].forEach((listener) => listener(arg));
        }
    }
}

export default EventEmitter;