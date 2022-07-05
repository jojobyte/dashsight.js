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
  let maxPages = parseInt(removeArg(process.argv, "--max-pages"), 10) || 10;
  let addrs = process.argv.slice(2);

  if (!addrs.length) {
    console.error(`Usage: txs <address> [address,...]`);
    process.exit(1);
    return;
  }

  console.info();
  if (json) {
    console.info(`[`);
  } else {
    console.info(`Transactions:`);
  }

  let hasTxs = false;
  await addrs.reduce(async function (promise, addr, i) {
    await promise;

    let info = await dashsight.getTxs(addr, maxPages);
    if (!json) {
      if (!hasTxs) {
        hasTxs = info.txs.length > 0;
      }

      info.txs.forEach(function (tx) {
        if (!json) {
          console.info();
          printTx(tx);
          return;
        }
      });
      return;
    }

    info.txs.forEach(function (tx, j) {
      let jsonStr = JSON.stringify(tx, null, 2)
        .split(/\n/g)
        .map(function (line) {
          return `  ${line}`;
        })
        .join("\n");

      let comma = ",";
      if (i === addrs.length - 1) {
        if (j === info.txs.length - 1) {
          comma = "";
        }
      }

      console.info(jsonStr + comma);
    });
  }, Promise.resolve());

  if (json) {
    console.info(`]`);
  } else if (!hasTxs) {
    console.info(`    (none)`);
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

/**
 * @param {Array<any>} arr
 * @param {any} item
 */
function removeArg(arr, item) {
  // TODO support --foo=bar also
  let index = arr.indexOf(item);
  if (index >= 0) {
    return arr.splice(index, 2)[1];
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
