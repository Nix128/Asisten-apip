const serverless = require('serverless-http');
// Point to the main app file inside the src directory
const app = require('../src/index');

module.exports.handler = serverless(app);
