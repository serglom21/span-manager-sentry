const Sentry = require('@sentry/node');
const { SpanBatchTransport } = require('./sentry-span-batch-processor');
const { TransportWrapper, SpanTransport } = require('./TransportWrapper');
const Logger = require('./logger');

class SentryWrapper {
    spanMap = null;

    init(options){
        const transportWrapper = new TransportWrapper(this);
        this.client = Sentry.init({...options, transport: transportWrapper });
        //this.client = Sentry.init(options);
        this.spanMap = new Map();
        this.client.on("spanEnd", (span) => {
            this.onSpanEnd(this.getSpanMap(), span)
        })
    }

    onSpanEnd(spanMap, span) {
        if (span) {
            const parentID = span["parentSpanId"]

            if (parentID) {
                let spans = []
                if (spanMap.has(parentID)) {
                    spans = spanMap.get(parentID);
                }
                
                spans.push(span)
                spanMap.set(parentID, spans)
            }
        }
    }

    getSpanMap() {
        return this.spanMap;
    }

    getChildSpans(parentID) {
        for (const [key, value] of this.spanMap.entries()) {
            if (key == parentID) {
                return value;
            }
        }
        return null;
    }

    printSpanMap(){
        for (const [key, value] of this.spanMap.entries()) {
            for (const span of value) {
                console.log(span)
            }
        }
    }
}

module.exports = { SentryWrapper }