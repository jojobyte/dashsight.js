#!/usr/bin/env node

"use strict";

require("dotenv").config({ path: ".env" });
require("dotenv").config({ path: ".env.secret" });

//let Https = require("https");

let Ws = require("../ws/");

let baseUrl = `https://insight.dash.org`;

function help() {
  console.info(``);
  console.info(`Usage:`);
  //console.info(`        insight-websocket [eventname1,eventname2,]`);
  console.info(`        insight-websocket # listens for 'inv' events`);
  console.info(``);
  /*
  console.info(`Example:`);
  console.info(`        insight-websocket inv,addresstxid`);
  console.info(``);
  */

  // TODO Ws.waitForVout()
}

async function main() {
  // ex: inv,dashd/addresstxid
  let eventnames = (process.argv[2] || "inv").split(",");

  if (["help", "--help", "-h"].includes(eventnames[0])) {
    help();
    process.exit(0);
    return;
  }

  // TODO check validity
  if (!eventnames.length) {
    help();
    process.exit(1);
    return;
  }

  // TODO pass eventnames
  await Ws.listen(
    baseUrl,
    function finder(evname, data) {
      console.log(evname, data);
    },
    { debug: true },
  );
}

main().catch(function (err) {
  console.error("Fail:");
  console.error(err.stack || err);
});
