//@ts-check
'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment');
const js2xmlparser = require('js2xmlparser');
const fs = require('fs');
const path = require('path');
const validation = require('./validation');
const ftp = require('ftp');
const client = require('./client');
const rpn = require('./client/api/rpn');
const config = require('./config');
const RpnResponse = require('./models/RpnResponse');
const RpnFileLog = require('./models/RpnFileLog');

function getNewRpns() {
  return new Promise((resolve, reject) => {
    let today = moment()
      .startOf('day')
      .toDate();

    let newFileLog = new RpnFileLog({
      year: moment().year(),
      dateImported: Date.now(),
      fromDate: today,
      toDate: today,
      fileName: moment().format('YYYYMMDD'),
      rpnCount: 0
    });

    // Get the most recent RpnLogFile in the database
    RpnFileLog.findOne({}, {}, { sort: { toDate: -1 } }, (err, lastFileLog) => {
      if (err) {
        reject(err.message);
        return;
      }

      if (!validation.isEmpty(lastFileLog)) {
        // Set the new fromDate to match the most recent toDate
        newFileLog.fromDate = lastFileLog.toDate;

        let lastFromDate = moment(lastFileLog.fromDate);

        if (lastFromDate.isSame(today)) {
          // We are rerunning the current day, so remove the earlier file
          RpnResponse.findOneAndRemove(
            { fileName: lastFileLog.fileName },
            err => {
              if (err) {
                reject(err.message);
                return;
              }
            }
          );
        }
      }

      // Get the file contents
      client
        .get(
          rpn.lookUpRpnByEmployer(
            moment(newFileLog.fromDate).format('YYYY-MM-DD')
          )
        )
        .then(response => {
          let rpnResponse = new RpnResponse(JSON.parse(response));
          rpnResponse.fileName = newFileLog.fileName;
          newFileLog.rpnCount = rpnResponse.totalRPNCount;

          // Save the new RpnFileLog
          newFileLog.save(err => {
            if (err) {
              reject(err.message);
              return;
            }
          });

          // Save the new RpnResponse
          rpnResponse.save(err => {
            if (err) {
              reject(err.message);
              return;
            }
          });

          // Now we need to create the file on the payroll server
          let xmlBody = js2xmlparser.parse('root', JSON.parse(response));
          let xmlFileName = `RPN_${newFileLog.fileName}.XML`;
          let xmlPath = path.join(__dirname, '../src/uploads/') + xmlFileName;

          // Create the xml version of the file on local machine
          fs.writeFile(xmlPath, xmlBody, err => {
            if (err) {
              reject(err.message);
              return;
            }
          });

          // FTP the file to payrolls server
          let c = new ftp();
          c.on('ready', function() {
            c.put(xmlBody, config.ftpDirectory + xmlFileName, function(err) {
              if (err) throw err;
              c.end();
            });
          });

          // connect to payroll server and transfer file
          c.connect({
            host: config.ftpHost,
            user: config.ftpUser,
            password: config.ftpPassword
          });

          // Delete the local copy of the file
          fs.unlink(xmlPath + xmlFileName, err => {
            if (err) {
              reject(err.message);
              return;
            }
          });

          resolve(xmlFileName);
          return;
        })
        .catch(err => {
          reject(err.message);
          return;
        });
    });
  });
}

module.exports = { getNewRpns };
