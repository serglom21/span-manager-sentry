const express = require('express');
const Sentry = require('@sentry/node');

const app = express();
app.use(express.json());

const MAX_SPANS_PER_TRACE = 1000;
const traceSpanCounts = new Map();

// Endpoint to receive Sentry events from other services
app.post('/collect-spans', async (req, res) => {
  const { traceId, numOfSpans } = req.body;
  console.log(traceId, numOfSpans)

   // Check for valid input
  if (!traceId || typeof numOfSpans !== 'number') {
    return res.status(400).send("Invalid request payload");
  }
  // Initialize span count if traceId is new
  if (!traceSpanCounts.has(traceId)) {
    traceSpanCounts.set(traceId, 0);
  }
  console.log(traceSpanCounts)

  // Update the span count for this trace
  const currentSpanCount = traceSpanCounts.get(traceId);
  const updatedSpanCount = currentSpanCount + numOfSpans;

  // Check if the updated count exceeds the max allowed spans
  if (updatedSpanCount > MAX_SPANS_PER_TRACE) {
      traceSpanCounts.set(traceId, MAX_SPANS_PER_TRACE); // Cap the count at max limit
      traceSpanCounts.delete(traceId);
      return res.json({ spanLimitReached: true, numOfSpansExceeded: updatedSpanCount - MAX_SPANS_PER_TRACE});
  } else {
      traceSpanCounts.set(traceId, updatedSpanCount); // Update the count
      return res.json({ spanLimitReached: false });
  }

});

// Start the transport service
app.listen(4000, () => {
  console.log('Sentry Transport Service listening on port 4000');
});