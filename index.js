/**
TODO:
- What is our group ID?  Update the output file name to match the ID.
- Further testing to see the limits the Pubmed server can be pushed to
  - Current runtime @ 44 requests/sec takes ~125seconds or just over 2 minutes.

Please keep in mind that the performance of this program will greatly depend
on various factors such as background processes, environment, operating system,
hardware, antimalware/antivirus protection measures, and server load of the remote
server.

However, the main bottleneck for this program will always be the rate at which
PubMed server requests can be made.  Changing the variable 'r' below to a
higher number will give out requests much more quickly.

MULTI-THREAD THOUGHTS
==================
This assignment can be decomposed into 4 primary tasks that need to be completed.
1. Read titles from a file
2. Send a request to a server (and receive a response)
3. Parse the response (body) that is sent back
4. Write responses to a file

Each of these tasks can be represented as their own worker to independently
perform their tasks.  They do not need to be run sequentially, thus to allow faster
processing a cluster can be started to allow parallel processing.
*/

// Needed to create a ReadStream of the data file
const fs = require('fs');

// Needed to send requests to a remote server
const request = require('request');

// Needed to read in XML
const XmlStream = require('xml-stream');

// Needed to create XML Documents
const xmlbuilder = require('xmlbuilder');

// Needed to leverage multiple cores
const cluster = require('cluster');
const cpuCount = require('os').cpus().length;

// JSON
const vars = require('./vars.json');

// Default values for requests
const base_url = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&field=title';
var options = {
  uri: base_url,
  method: 'POST',
  timeout: 10000,
  followRedirect: true,
  maxRedirects: 10
};

// This will determine the rate of requests to the server
// (1 / r) * 1000, where r is the the number of requests per second
let r = 44;
let speed = (1 / r) * 1000;

// The will be the name of the file created
// This will reside in the /output/ folder
let fileName = "group1_result";

// Data Variables
// Create a queue to store our titles
let titleQueue = [];

// Queue of XML Body and Titles to be parsed
let parseQueue = [];

// Holds the title with it's corresponding ID to be stored in xml
let outputQueue = [];

console.log('Starting...\n');
// Functions
/*
Used to read in all the titles from our provided dataset
*/
const readFile = () => {
  return new Promise((resolve, reject) => {
    // Begin by parsing the XML
    let stream = fs.createReadStream('data/4020a1-datasets');
    let xml = new XmlStream(stream);

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

    // When the EOF has been reached, output the size
    xml.on('end', () => {
      resolve("Read complete!");
    });
  });
}

/*
Dequeue the next title from the list and send the request to the server
MAX LIMIT: 10requests/s with API Key, 3requests/s without
These limits are what are documented, however you can get up to about
~50 req/s without any issue.
*/
const sendNextRequest = () => {
  return new Promise((resolve, reject) => {
    // Grab the next item from the front of the queue
    let title = titleQueue.shift();
    //options.uri = base_url + "&term=" + title + "[title]";

    if (title) {
      // This method of string concatenation will perform faster when needing to execute thousands of times
      let temp = [];
      temp.push(base_url);
      temp.push("&term=");
      temp.push(title);
      //temp.push("[title]");
      options.uri = temp.join('');

      request(options, (error, response, body) => {
        // The body will contain the returned XML.  Parse it to get the ID
        resolve({title, body});
      });
    } else {
      reject(null, 'All titles exhausted.');
    }
  });
}

/*
Parse the xml returned from the server
*/
const parseXml = (data) => {
  return new Promise((resolve, reject) => {
    let body = data.body;
    let title = data.title;

    // Create a readableStream from the string
    let Readable = require('stream').Readable;
    let stream = new Readable();
    stream.push(body);
    stream.push(null);
    let xml = new XmlStream(stream);

    // Gather the IdList from the body
    xml.preserve('IdList', true);

    // Gather the contents inside the tag
    xml.collect('subitem');

    // Output it once we've found the closing IdList tag
    xml.on('endElement: IdList', (item) => {
      // Gather the id text from the inner structure
      let id = ((item['$children'])[1])['$text'];

      // Store the data as a pair in the outputQueue
      outputQueue.push({title, id});
    });

    // When the EOF has been reached, resolve
    xml.on('end', () => {
      resolve("Finished Parsing body");
    });
  });
}

/*
Begin writing the IDs to a file
*/
const updateXML = (data) => {
  return new Promise((resolve, reject) => {
    // Grab the builder that was passed
    let xmlFile = data;

    // Update it with elements in the queue
    while(outputQueue.length > 0) {
      let element = outputQueue.shift();
      // Create a node to store each article
      let article = xmlFile.ele('PubmedArticle');
      article.ele('PMID', element.id);
      article.ele('ArticleTitle', element.title);
    }
  });
}


// Setup environment for multicore processing
// Exit operations
const clusterExitOp = (clsReader, clsRequests, clsXmlParser, clsWriter) => {
  clsReader.on('exit', (worker, code, signal) => {
    console.log('[clsReader] Worker disconnected.');
    //clsReader = cluster.fork({WorkerName: 'clsReader'});
  });

  clsRequests.on('exit', (worker, code, signal) => {
    console.log('[clsRequests] Worker disconnected.');
    //clsRequests = cluster.fork({WorkerName: 'clsRequests'});
  });

  clsXmlParser.on('exit', (worker, code, signal) => {
    console.log('[clsXmlParser] Worker disconnected.');
    //clsXmlParser = cluster.fork({WorkerName: 'clsXmlParser'});
  });

  clsWriter.on('exit', (worker, code, signal) => {
    console.log('[clsWriter] Worker disconnected.');
    //clsWriter = cluster.fork({WorkerName: 'clsWriter'});
  });
};

// Split logic based on which process is running this file
if (cluster.isMaster) {
  // Begin timer
  let startTime = process.hrtime();
  console.time('runtime');
  console.log('Master ${process.pid} is running');

  let clsReader = cluster.fork({WorkerName: 'clsReader'});
  let clsRequests = cluster.fork({WorkerName: 'clsRequests'});
  let clsXmlParser = cluster.fork({WorkerName: 'clsXmlParser'});
  let clsWriter = cluster.fork({WorkerName: 'clsWriter'});

  // Setup our exit operations to restart the workers
  clusterExitOp(clsReader, clsRequests, clsXmlParser, clsWriter);

  /**
  These message handlers are only evaluated when a process.send() is called within
  it's own context.  That is process.send() is called within clsReader then clsRead.on()
  will handle it.
  */
  clsReader.on('message', (data) => {
    //console.log('[Reader] Data updated from the reader, passing to Requests...', data.length);
    titleQueue = titleQueue.concat(data);
    console.log('[Reader] Size:', titleQueue.length);
    clsRequests.send({'mode': 0, 'queue': data});
  });

  clsRequests.on('message', (data) => {
    //console.log('[Requests] Data received, passing to XmlParser...');
    parseQueue = parseQueue.concat(data);
    clsXmlParser.send(data)
  });

  clsXmlParser.on('message', (data) => {
    //console.log('[XmlParser] Data received, passing to Writer');
    outputQueue = outputQueue.concat(data);
    clsWriter.send(data);
  });

  clsWriter.on('message', (data) => {
    console.timeEnd('runtime');
    console.log('Run time: ' + (process.hrtime(startTime))[0] + ' seconds');

    for(const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });

  // Master Exit operations
  /*cluster.on('exit', (worker, code, signal) => {
    console.warn('Worker crashed!');
    console.log('Code: ', code);
    console.log('Signal: ', signal);

    if(worker === 'clsReader') {
      //clsReader = cluster.fork({WorkerName: 'clsReader'});
    } else if (worker === 'clsRequests') {
      //clsRequests = cluster.fork({WorkerName: 'clsRequests'});
    } else if (worker === 'clsXmlParser') {
      //clsXmlParser = cluster.fork({WorkerName: 'clsXmlParser'});
    } else if (worker === 'clsWriter') {
      //clsWriter = cluster.fork({WorkerName: 'clsWriter'});
    }
  });*/
}
else if (process.env.WorkerName == "clsReader") {
  console.log('[Reader] Started\n');
  // Once per second attempt to update the Requests Thread on titles to be queued
  setInterval(() => {
    if(titleQueue.length > 0) {
      process.send(titleQueue);
      // Reset titleQueue after passing current values
      titleQueue = [];
    }
  }, 1000);
  readFile().then((out) => {
    console.log('[Reader] ' + out);
  }).catch((err) => {
    console.log(err);
  });
}
else if (process.env.WorkerName == "clsRequests") {
  console.log('[Requests] Started\n');

  // Once per second attempt to update the XmlParser Thread on strings to be queued
  setInterval(() => {
    if(parseQueue.length > 0) {
      process.send(parseQueue);
      // Reset parserQueue after passing current values
      parseQueue = [];
    }
  }, 1000);

  // Periodically update the console with the remaining titles
  setInterval(() => {
    console.log("[Requests] Remaining Titles:", titleQueue.length);
  }, 1000);

  // Periodically send requests to the server as long as there are elements in the queue
  setInterval(() => {
    if(titleQueue.length > 0) {
      // Returns data.title and data.body
      sendNextRequest().then((data) => {
        //console.log("Received response from server!");
        //console.log(data.title);
        //console.log(data.body);

        parseQueue.push(data);
      }).catch((err) => {
        console.log("Issue requesting data from server...");
      });
    }
  }, speed);

  // Take in new data that is sent from workers
  process.on('message', async (data) => {
    if(data.mode == 0) { // Receiving data mode
      titleQueue = titleQueue.concat(data.queue);
    } else if (data.mode == 1) { // Sending data mode
      console.log('Sending data mode');
    }
  });
}
else if (process.env.WorkerName == "clsXmlParser") {
  console.log('[clsXmlParser] Started\n');

  // Once per second attempt to update the clsWriter Thread on data needing to be written
  setInterval(() => {
    if(outputQueue.length > 0) {
      process.send(outputQueue);
      // Reset parserQueue after passing current values
      outputQueue = [];
    }
  }, 1000);

  // Periodically update the console with the remaining xml to be parsed
  setInterval(() => {
    console.log("[XmlParser] Remaining Parses:", parseQueue.length);
  }, 1000);

  // Periodically check if there is more in the queue
  setInterval(() => {
    while(parseQueue.length > 0) {
      parseXml(parseQueue.shift()).then((out) => {

      }).catch((err) => {
        console.log(err);
      });
    }
  }, 1000);


  // Take in new data that is sent from workers
  process.on('message', async (data) => {
    parseQueue = parseQueue.concat(data);
  });
}
else if (process.env.WorkerName == "clsWriter") {
  console.log('[clsWriter] Started\n');
  let noWriteCount = 0;

  // Create the base XML node to start the file
  let xmlFile = xmlbuilder.create('PubmedArticleSet', {encoding: 'utf-8'});

  // Periodically update the console with the remaining data to be written
  setInterval(() => {
    console.log("\n\n[Writer] Remaining Writes:", outputQueue.length);
  }, 1000);

  // Periodically check if there is more in the queue
  setInterval(() => {
    if(outputQueue.length > 0) {
      updateXML(xmlFile).then((out) => {
        // Nothing
      }).catch((err) => {
        console.log(err);
      });
      noWriteCount = 0;
    }
    noWriteCount++;
    // If 10 seconds pass without anymore writes, assume program is done
    if(noWriteCount == 5) {
      // Close the xml file and report the runtime
      let outputString = xmlFile.end({pretty: true});
      fs.writeFile(
        fileName,
        outputString,
        (err) => {
          if (err) throw err;
          console.log("File saved!");
        }
      );
      process.send(process.hrtime());
    }
  }, 1000);

  // Take in new data that is sent from workers
  process.on('message', async (data) => {
    outputQueue = outputQueue.concat(data);
  });
}
