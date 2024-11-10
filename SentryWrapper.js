const Sentry = require('@sentry/node');
const { SpanBatchTransport } = require('./sentry-span-batch-processor');
const { TransportWrapper, SpanTransport } = require('./TransportWrapper');
const Logger = require('./logger');

class SentryWrapper {
    traceMap = null;

    init(options){
        const transportWrapper = new TransportWrapper(this);
        this.client = Sentry.init({...options, transport: transportWrapper });
        //this.client = Sentry.init(options);
        this.traceMap = new Map();
        this.client.on("spanEnd", (span) => {
            this.onSpanEnd(this.getTraceMap(), span)
        })
    }

    onSpanEnd(traceMap, span) {
        // This will also store an additional span which is the trace span itself
        // Maybe consider removing the first index of this Map
        const activeSpan = Sentry.getActiveSpan();
        
        if (activeSpan) {
            const context = activeSpan.spanContext();
            const traceId = context.traceId;

            if (traceId) {
                let spans = []
                if (traceMap.has(traceId)) {
                    spans = traceMap.get(traceId);
                }
                
                spans.push(span)
                traceMap.set(traceId, spans)
            }
        }
    }

    getTraceMap() {
        return this.traceMap;
    }

    getSpansByTraceID(traceID) {
        for (const [key, value] of this.traceMap.entries()) {
            if (key == traceID) {
                return value;
            }
        }
        return null;
    }

    printTraceMap(){
        for (const [key, value] of this.traceMap.entries()) {
            for (const span of value) {
                console.log(span)
            }
        }
    }
}

module.exports = { SentryWrapper }