const { 
    extractTraceContext, 
    replaceTraceID, 
    correctSpansForTrace
} = require("./sentry-span-batch-processor/utils/trace");
const sendEventPayload = require("./sentry-span-batch-processor/utils/request");
const Sentry = require('@sentry/node');
const { suppressTracing } = require("@sentry/core")
const fs = require('node:fs');

const SPAN_TRACKING_SERVICE_URL = process.env.SPAN_TRACKING_SERVICE_URL;

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
            const traceSpans = self.sentryWrapper.getSpansByTraceID(contexts.traceContext.trace_id);
  
            const requestOptions = getRequestOptions(
                JSON.stringify({
                    traceId: contexts.traceContext.trace_id,
                    numOfSpans: traceSpans.length
                }),
                {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            )

            try {
                return suppressTracing(() => {
                    return fetch(SPAN_TRACKING_SERVICE_URL, requestOptions).then(response => {
                        return response.json().then(jsonResponse => {
                            //console.log(jsonResponse)
                            if (!jsonResponse.spanLimitReached) {
                                return sendEventPayload(
                                    options.url, 
                                    getRequestOptions(request.body, options.headers)
                                );
                            } else {
                                let traces = {}
                                if (jsonResponse.numOfSpansExceeded > 0) {
                                    try {
                                        traces = correctSpansForTrace(request.body, traceSpans, jsonResponse.numOfSpansExceeded);
                                    } catch (e){
                                        console.log(e)
                                    }
                                    //console.log(traces.currentTrace)
                                    sendEventPayload(
                                        options.url, 
                                        getRequestOptions(traces.currentTrace, options.headers)
                                    )
                                }

                                let trace_id = null;
                                let parent_span_id = null;

                                //console.log("old trace id: ", Sentry.getCurrentScope().getPropagationContext().traceId);

                                Sentry.startNewTrace(() => {
                                    trace_id = Sentry.getCurrentScope().getPropagationContext().traceId;
                                    parent_span_id = Sentry.getCurrentScope().getPropagationContext().spanId;
                                });

                                //console.log("new trace id: ", trace_id);

                                const body = replaceTraceID(
                                    traces.newTrace,
                                    trace_id,
                                    parent_span_id
                                );

                                //console.log(body)
                                return sendEventPayload(
                                    options.url,
                                    getRequestOptions(body, options.headers)
                                )
                            }
                        })
                    })
                })
            } catch (error) {
                console.error(error);
            }

        }

        return Sentry.createTransport(options, makeRequest)
    }
    
}

module.exports = { TransportWrapper }