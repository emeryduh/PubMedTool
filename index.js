/**
This is a single-threaded, single-core program that will not leverage any
of the benefits of multithreading as is the nature of Node.js.  In order
to make full use of these benefits you must implement it through clusters
or another method.

Please keep in mind that the performance of this program will greatly depend
on various factors such as background processes, environment, operating system,
hardware, and antimalware/antivirus protection measures.
*/

const fs = require('fs');
const request = require('request');
const XmlStream = require('xml-stream');

// JSON files
const vars = require('./vars.json');

// Default values for requests
const base_url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed';
var options = {
  uri: base_url,
  method: 'POST',
  timeout: 10000,
  followRedirect: true,
  maxRedirects: 10
};

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

// Where it all begins...
// Begin by parsing the XML
var stream = fs.createReadStream('data/4020a1-datasets');
var xml = new XmlStream(stream);

// Create a queue to store our titles and ids
var titleQueue = [];
var idQueue = [];

// Extract only the article titles
xml.preserve('ArticleTitle', true);

// Gather the contents inside the tag
xml.collect('subitem');

// Output it once we've found the closing title tag
// Grab the '$text' subitem from the array
xml.on('endElement: ArticleTitle', (item) => {
  // Push each new ArticleTitle found to the back of the queue
  titleQueue.push(item['$text']);
});

/*
Now that all XML information has been gathered we can move onto requesting the IDs
from the PubMed server.
*/
// Grab the next item from the front of the queue
var title = titleQueue.shift();
//options.uri = base_url + "&term=" + title + "[title]";

// This method of string concatenation will perform faster when needing to execute thousands of times
var temp = [];
temp.push(base_url);
temp.push("&term=");
temp.push(title);
temp.push("[title]");
options.uri = temp.join('');

request(options, (error, response, body) => {
  // The body will contain the returned XML.  Parse it to get the ID
  console.log(body);
});
