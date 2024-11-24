function sendEventPayload(url, requestOptions){
    return fetch(url, requestOptions).then(async response => {
      return {
          statusCode: response.status,
          headers: {
            'x-sentry-rate-limits': response.headers.get('X-Sentry-Rate-Limits'),
            'retry-after': response.headers.get('Retry-After'),
          },
      };
  })
}

module.exports = sendEventPayload