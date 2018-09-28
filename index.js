/**
This is a single-threaded, single-core program that will not leverage any
of the benefits of multithreading as is the nature of Node.js.  In order
to make full use of these benefits you must implement it through clusters
or another method.

Please keep in mind that the performance of this program will greatly depend
on various factors such as background processes, environment, operating system,
hardware, and antimalware/antivirus protection measures.
*/

//const http = require('http');
const fs = require('fs');
//const moment = require('moment');
const request = require('request');
const XmlStream = require('xml-stream');

// JSON files
const vars = require('./vars.json');

console.log('Starting...\n');

// Setup environment for multicore processing
// *For now we won't use.  Implement later if speed requirements are rigorous
/*
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log('Master ${process.pid} is running');

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log('Worker ${worker.process.pid} died');
  });
} else {
  console.log('Worker ${process.pid} started');
}
*/

// Default values for requests
const base_url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed';
var options = {
  uri: base_url,
  method: 'POST',
  timeout: 10000,
  followRedirect: true,
  maxRedirects: 10
};

// Where it all begins...
// Begin by parsing the XML
var stream = fs.createReadStream('data/4020a1-datasets');
var xml = new XmlStream(stream);

// Extract only the article titles
xml.preserve('ArticleTitle', true);

// Gather the contents inside the tag
xml.collect('subitem');

// Output it once we've found the closing title tag
// Grab the '$text' snowflake from the array
xml.on('endElement: ArticleTitle', (item) => {
  console.log(item['$text']);
});

/*
Now that all XML information has been gather we can move onto requesting the IDs
from the PubMed server.
*/
/*
request(options, (error, response, body) => {
  logger.info(body);
});
*/
