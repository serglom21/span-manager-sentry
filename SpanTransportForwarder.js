const Sentry = require('@sentry/node');
const { rejectedSyncPromise } = require('@sentry/utils');

// TODO: new JSON for traces generated have an extra '\n' + characters that make the payload invalid
// figure out why that is
// i.e  '{"type":"transaction"}\n' + '{"spans":...} - get rid of '\n' +

function SpanTransportForwarder(options) {
    function sendEventPayload(url, requestOptions){
      return fetch(url, requestOptions).then(response => {
        return {
            statusCode: response.status,
            headers: {
              'x-sentry-rate-limits': response.headers.get('X-Sentry-Rate-Limits'),
              'retry-after': response.headers.get('Retry-After'),
            },
        };
    });
    }

    function makeRequest(request) {
        const contexts = extractTraceContext(request.body)
        if (contexts.type !== "transaction") return;
        const requestOptions = {
            body: JSON.stringify({
                traceId: contexts.traceContext.trace_id,
                numOfSpans: contexts.spans.length
            }),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
        };

        try {
            return fetch("http://localhost:4000/collect-spans", requestOptions).then(response => {
                return response.json().then(jsonResponse => {
                    if (!jsonResponse.spanLimitReached) {
                        const sentryRequestOptions = {
                            body: request.body,
                            method: 'POST',
                            headers: options.headers
                        }
                        
                        return sendEventPayload(options.url, sentryRequestOptions);
                    } else {
                      try {
                        let traces = {}
                        if (jsonResponse.numOfSpansExceeded > 0) {
                          traces = correctSpansForTrace(request.body, jsonResponse.numOfSpansExceeded);
                          const requestOptions = {
                            body: traces.currentTrace,
                            method: 'POST',
                            headers: options.headers
                          }
                          console.log("Sending trace: ", traces.currentTrace);
                          //console.log(typeof requestOptions.body)
                          console.log("URL: ", options.url);
                          console.log("=======================\n")
                          sendEventPayload(options.url, requestOptions)
                        }

                        
                        let trace_id = null;
                        let parent_span_id = null;
                        Sentry.startNewTrace((trace) => {
                          console.log("trace: ", trace)
                          trace_id = Sentry.getCurrentScope().getPropagationContext().traceId;
                          parent_span_id = Sentry.getCurrentScope().getPropagationContext().spanId;
                        });

                        
                        const body = replaceTraceID(traces.newTrace, trace_id, parent_span_id);
                        const sentryRequestOptions = {
                          body: body,
                          method: 'POST',
                          headers: options.headers
                        }
                        console.log("Sending trace: ", body);
                        console.log("URL: ", options.url);
                        console.log("=======================")
                        return sendEventPayload(options.url, sentryRequestOptions);
                      } catch (error) {
                        console.log(error)
                      }
                    }
                })
            })
        } catch (e) {
          console.log(e);
          return rejectedSyncPromise(e);
        }
    }

    return Sentry.createTransport(options, makeRequest);
}

function correctSpansForTrace(event, numOfSpansExceeded) {
  const lines = event.split('\n');
  let newTrace = '';
  let currentTrace = '';
  for (let line of lines) {
    const jsonData = JSON.parse(line);
    if (!jsonData.contexts) {
      if (jsonData.event_id) {
        delete jsonData.event_id;
        line = JSON.stringify(jsonData)
      }
      console.log(line)
      newTrace += `${line}\n`;
      currentTrace += `${line}\n`
    } else {
      let propertiesNewJSON = {}
      let propertiesCurrentJSON = {}
      for (const property in jsonData){
        if (property == "spans") {
          let spansForCurrentTrace = jsonData[property].slice(0, numOfSpansExceeded);
          let spansForNewTrace = jsonData[property].slice(numOfSpansExceeded);
          propertiesNewJSON[property] = spansForNewTrace;
          propertiesCurrentJSON[property] = spansForCurrentTrace;
          //contexts = { ...jsonData[property] };
          //newTrace += JSON.stringify({ contexts , spans: spansForNewTrace })
        } else {
          //if (property == "event_id") continue;
          propertiesNewJSON[property] = jsonData[property];
          propertiesCurrentJSON[property] = jsonData[property];
        }
      }
      newTrace += JSON.stringify(propertiesNewJSON);
      currentTrace += JSON.stringify(propertiesCurrentJSON);
    }
  }
  return { newTrace, currentTrace }
}

function replaceTraceID(event, trace_id, parent_span_id) {
    const lines = event.split('\n');
    let jsonString = '';
    for (const line of lines) {
      const jsonData = JSON.parse(line);
      if (jsonData.trace) {
        jsonData.trace.trace_id = trace_id;
      }

      if (jsonData.contexts && jsonData.contexts.trace) {
        jsonData.contexts.trace.trace_id = trace_id;
        jsonData.contexts.trace.span_id = parent_span_id;
      }

      if (jsonData.spans) {
        for (let span of jsonData.spans) {
          span.trace_id = trace_id;
          span.parent_span_id = parent_span_id;
        }
      }

      jsonString +=  JSON.stringify(jsonData) + '\n';
    }

    return jsonString;
}


function extractTraceContext(jsonString) {
    // Split by newlines to process each potential JSON string separately
    const lines = jsonString.split('\n');

    for (const line of lines) {
      try {
        const jsonData = JSON.parse(line);
  
        // Check if the parsed object contains `contexts.trace`
        if (jsonData.contexts && jsonData.contexts.trace) {
          const traceContext = jsonData.contexts.trace;

          const spans = jsonData.spans ? jsonData.spans : [];
          const type = jsonData.type;
          return { traceContext, spans, type };
        }
      } catch (error) {
        continue;
      }
    }
  
    return "No trace context found in the provided JSON.";
  }

function mapSpan(span, json, traceId){
  for (attribute in json) {
    span[attribute] = json[attribute];
  }
  //span["trace_id"] = traceId;
  return span;
}

module.exports = { SpanTransportForwarder };
