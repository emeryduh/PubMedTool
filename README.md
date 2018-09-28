# Installation
Install [Node.js](https://nodejs.org/en/)
Navigate to the project directory and run `npm install`
Run `node index.js`

# Common Problems
If you have used Node before but haven't updated in a long time you will need to update it.

Run the following:
```
npm install -g node
npm install -g npm
npm install -g node-gyp
```

This project leverages libraries that make use of Python/C/C++.  You will need to update your environment's build tools in order to successfully run this application. Go to https://github.com/nodejs/node-gyp#installation for more details on what to do for each platform.
