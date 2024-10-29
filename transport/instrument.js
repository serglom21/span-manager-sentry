const Sentry = require('@sentry/node');

Sentry.init({
    dsn: "",
    tracesSampleRate: 1.0,
    //debug: true,
    release: "4.0",
  })
