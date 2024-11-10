const { SpanBatchTransport } = require('sentry-span-batch-processor');
const { SentryWrapper } = require('./SentryWrapper');
const Sentry = require('@sentry/node')

const sentryOptions = {
  dsn: "",
  tracesSampleRate: 1.0,
  //debug: true,
  release: "7.6",
}
const sentryWrapper = new SentryWrapper();
sentryWrapper.init(sentryOptions)
