require('./instrument');
const express = require('express');
//const Sentry = require('./sentry-javascript/sentry-javascript/packages/node');
const Sentry = require('@sentry/node')
const app = express();
const SPAN_LIMIT = 1000;
const port = 3000; // You can change this po jrt number if needed
const SpanManager = require('./SpanManager')

const spanManager = new SpanManager();

Sentry.setupExpressErrorHandler(app);

// Middleware to parse incoming JSON data
app.use(express.json());

app.post('/', (req, res) => {
  print("called");
  res.send("called")
})

// Sample route
app.get('/', (req, res) => {
  console.log("===================")
  console.log(Sentry.getCurrentScope().getPropagationContext())
  console.log("===================")
  res.send('Hello, Express!');
});


app.get("/expensive-function", (req, res) => {
  //console.log(req)
  /*for (let x = 0; x < 10; x++) {
    spanManager.createSpan('processing');  // Reuse the createSpan method for each iteration
  };*/
  
  for (let x = 0; x < 1400; x++) {
    const span = Sentry.startInactiveSpan({name: "processing"});
    span.end()
  }
  
  res.send("hello world")
})

// Sample route with a parameter
app.get('/greet/:name', (req, res) => {
  const name = req.params.name;
  res.send(`Hello, ${name}!`);
});

app.post('/webhook', (req, res) => {
    console.log("webhook callled");
})

app.get('/test-spans', (req, res) => {
  for (let x = 0; x < 500; x++){
    console.log('running for: ', x);
    const result = Sentry.startSpan({name: "Important Function"}, () => {
      return doMath();
    })
  }
  res.send(`Hello`);
})


// Run the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

doMath = () => {
  return 2 + 2;
}