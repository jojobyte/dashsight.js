#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: ".env" });

let dashsightBaseUrl =
  process.env.INSIGHT_BASE_URL || "https://insight.dash.org";

let Dashsight = require("../");
let printTx = require("./_print-tx.js");

let dashsight = Dashsight.create({
  baseUrl: dashsightBaseUrl,
});

async function main() {
  let json = removeItem(process.argv, "--json");
  let txids = process.argv.slice(2);

  if (!txids.length) {
    console.error(`Usage: tx <txid> [txid,...]`);
    process.exit(1);
    return;
  }

  console.info();
  if (json) {
    console.info("[");
  } else {
    console.info(`Transaction Details...`);
  }

  await txids.reduce(async function (promise, txid, i) {
    await promise;
    let tx = await dashsight.getTx(txid);
    if (!json) {
      console.info();
      printTx(tx);
      return;
    }

    let jsonStr = JSON.stringify(tx, null, 2)
      .split(/\n/g)
      .map(function (line) {
        return `  ${line}`;
      })
      .join("\n");

    let comma = ",";
    if (i === txids.length - 1) {
      comma = "";
    }

    console.info(jsonStr + comma);
  }, Promise.resolve());

  if (json) {
    console.info("]");
  }
  console.info();
}

/**
 * @param {Array<any>} arr
 * @param {any} item
 */
function removeItem(arr, item) {
  let index = arr.indexOf(item);
  if (index >= 0) {
    return arr.splice(index, 1)[0];
  }
  return null;
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
