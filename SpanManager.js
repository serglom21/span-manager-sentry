const Sentry = require('@sentry/node');

class SpanManager {

    constructor(spanLimit = 1000) {
      this.spanLimit = spanLimit;
      this.numOfSpans = 0;
      this.rootSpan = null;
    }
  
    initializeRootSpan() {
      this.numOfSpans = 0;
      Sentry.startNewTrace(() => {
        Sentry.startSpan({ name: `root_span` }, (span) => {
          this.rootSpan = span;
          this.numOfSpans++;
        });
      });
    }
  
    createSpan(spanName) {
      if (!this.rootSpan || this.numOfSpans === this.spanLimit) {
        this.initializeRootSpan();
      }
  
      Sentry.withActiveSpan(this.rootSpan, () => {
        Sentry.startSpan({ name: `${spanName}_${this.numOfSpans}` }, () => {
          this.numOfSpans++;
        });
      });
    }
  }

  module.exports = SpanManager;