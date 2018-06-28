//@ts-check
'use strict';

var request = require('request');
var https = require('https');

var certs = require('../test/certs');
var Cert = require('./cert');
var config = require('../config/config');
var Message = require('./message');

var getPayrollRun = require('../test/requests/payroll/getPayrollRun');
var getRpn = require('../test/requests/rpn/getRpn');
var postPayrollSubmission = require('../test/requests/payroll/postPayrollSubmission');
var postPayrollSubmissionPayload = require('../test/requests/payroll/postPayrollSubmissionPayload');

// Get config for the test environment
var conf = config.find(x => x.env === 'test');

// Fetch the digital certificate from the certs array
var cer = certs.find(c => c.id == 999963666); // or 999963665

// Create the Cert object
var cert = new Cert(cer.id, cer.epn, cer.name, cer.password);

// Create a test message. Construct the options from our test/requests folder

// GET Look up RPN by Employer
//var options = getRpn(conf, cert);

// GET Check Payroll Run
// var options = getPayrollRun(conf, cert);

// POST Payroll Submission
var options = postPayrollSubmission(conf, cert, postPayrollSubmissionPayload());

// Create the message object
var message = new Message(options, cert);

//console.log(message.signingString);
//console.log(message.headerString);

// Create headers

options.headers.Signature = message.httpSignatureHeader;

//console.log(signatureHeader);
console.log(options);
/*
request()
  .then(function(res) {
    // Handle the response
  })
  .catch(function(err) {
    // Deal with the error
  });
*/

// console.log(options);

if (options.method === 'GET') {
  https
    .get(options, res => {
      let data = '';
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      // A chunk of data has been recieved.
      res.on('data', chunk => {
        data += chunk;
      });

      // The whole response has been received. Print out the result.
      res.on('end', () => {
        console.log(data);
      });
    })
    .on('error', err => {
      console.log('Error: ' + err.message);
    });
} else if (options.method === 'POST') {
}
