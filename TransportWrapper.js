const { 
    extractTraceContext, 
    replaceParentSpanID, 
    createEnvelopeFromBatch
} = require("./sentry-span-batch-processor/utils/trace");
const sendEventPayload = require("./sentry-span-batch-processor/utils/request");
const Sentry = require('@sentry/node');
const { suppressTracing } = require("@sentry/core")

const SPAN_LIMIT = 1000;

class TransportWrapper {
    sentryWrapper = null;

    constructor(sentryWrapper){
        this.sentryWrapper = sentryWrapper;
        return this.SpanTransport.bind(this);
    }

    SpanTransport(options){
        const self = this;

        function getRequestOptions(body, headers) {
            return {
                body,
                method: 'POST',
                headers
            }
        }

        function makeRequest(request){
            const contexts = extractTraceContext(request.body);
            if (contexts.type !== "transaction") {
                return sendEventPayload(
                    options.url,
                    getRequestOptions(request.body, options.headers)
                )
            }
            const traceSpans = self.sentryWrapper.getChildSpans(contexts.traceContext.span_id);

            try {
                return suppressTracing(async () => {
                    let requestPayload = {};
                    requestPayload = getRequestOptions(request.body, options.headers);
                    if (traceSpans.length <= SPAN_LIMIT) {
                        return sendEventPayload(
                            options.url,
                            requestPayload
                        )
                    } else {
                        let spansBatched = 0;
                        let transactionEnvelope = '';
                        while (spansBatched < traceSpans.length) {
                            try {
                                let batch = traceSpans.slice(spansBatched, spansBatched + SPAN_LIMIT);
                                spansBatched += batch.length;
                                let parent_span_id = null;
                                transactionEnvelope = createEnvelopeFromBatch(batch, request.body);
                                Sentry.startNewTrace(() => {
                                    parent_span_id = Sentry.getCurrentScope().getPropagationContext().spanId;
                                })
                                transactionEnvelope = replaceParentSpanID(transactionEnvelope, parent_span_id)
                                requestPayload = getRequestOptions(transactionEnvelope, options.headers);
                                if (spansBatched < traceSpans.length) {
                                    sendEventPayload(
                                        options.url,
                                        requestPayload
                                    );
                                }
                            } catch (error) {
                                console.log(error);
                            }      
                        }

                        requestPayload = getRequestOptions(transactionEnvelope, options.headers);
                        return sendEventPayload(
                            options.url,
                            requestPayload
                        )
                    }
                })
            } catch (error) {
                console.log(error);
            }
        }

        return Sentry.createTransport(options, makeRequest)
    }
    
}

module.exports = { TransportWrapper }