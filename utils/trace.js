const { spanTimeInputToSeconds } = require("@sentry/core");

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

function replaceParentSpanID(event, parent_span_id) {
    const lines = event.split('\n');
    let jsonString = '';
    for (const [index, line] of lines.entries()) {
      const jsonData = JSON.parse(line);

      if (jsonData.contexts && jsonData.contexts.trace) {
        jsonData.contexts.trace.span_id = parent_span_id;
      }

      if (jsonData.spans) {
        for (let span of jsonData.spans) {
          span.parent_span_id = parent_span_id;
        }
      }

      jsonString +=  JSON.stringify(jsonData);
      if (index < lines.length-1) {
        jsonString += '\n';
      }
    }

    return jsonString;
}

function normalizedSpanForTrace(spans) {
  let normalizedSpans = [];
  //console.log(spans)
  for (let span of spans) {
    try {
      normalizedSpans.push(normalizeSpan(span));
    } catch (error) {
      console.log(error);
    }
  }
  return normalizedSpans;
}

function normalizeSpan(span) {
  let newSpan = {};
  newSpan.span_id = span["_spanContext"]["spanId"];
  newSpan.trace_id = span["_spanContext"]["traceId"];
  newSpan.start_timestamp = spanTimeInputToSeconds(span["startTime"])
  newSpan.timestamp = spanTimeInputToSeconds(span["endTime"])
  newSpan.description = span["name"]
  newSpan.status = "ok"
  newSpan.op = span["attributes"]["sentry.op"]
  newSpan.origin = span["attributes"]["sentry.origin"]
  newSpan.data = span["attributes"]
  newSpan.parent_span_id = span["parentSpanId"]
  return newSpan
}

function createEnvelopeFromBatch(batch, event){
  const spans = normalizedSpanForTrace(batch)
  let envelope = ''
  const lines = event.split('\n');
  for (let line of lines) {
    const jsonData = JSON.parse(line);
    if (!jsonData.contexts) {
      if (jsonData.event_id) {
        delete jsonData.event_id;
        line = JSON.stringify(jsonData)
      }
      envelope += `${line}\n`;
    } else {
      let contextObject = {}
      for (const property in jsonData){
        if (property == "spans") {
          contextObject[property] = spans;
        } else if (!["event_id", "breadcrumbs", "request", "modules"].includes(property)) {
          contextObject[property] = jsonData[property];
        }
      }
      envelope += JSON.stringify(contextObject);
    }
  }
  return envelope;
  
}


module.exports =  {extractTraceContext, replaceParentSpanID, createEnvelopeFromBatch };