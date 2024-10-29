const Sentry = require('@sentry/node');
const { SpanTransportForwarder } = require('./SpanTransportForwarder');

Sentry.init({
    dsn: "",
    tracesSampleRate: 1.0,
    //debug: true,
    release: "5.8",
    transport: SpanTransportForwarder
  })
