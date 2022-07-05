#!/usr/bin/env node
"use strict";

require("dotenv").config({ path: ".env" });

let dashsightBaseUrl =
  process.env.INSIGHT_BASE_URL || "https://insight.dash.org";

let Dashsight = require("../");

let dashsight = Dashsight.create({
  baseUrl: dashsightBaseUrl,
});

async function main() {
  let json = removeItem(process.argv, "--json");
  let addrs = process.argv.slice(2);

  if (!addrs.length) {
    console.error(`Usage: balance <address> [address,...]`);
    process.exit(1);
    return;
  }

  console.info();
  if (json) {
    console.info("[");
  } else {
    console.info(`Instant balance is...`);
  }

  await addrs.reduce(async function (promise, addr, i) {
    await promise;
    let info = await dashsight.getInstantBalance(addr);
    if (!json) {
      let padded = info.balance.toFixed(8).padStart(12, " ");
      console.info(`  ${padded}`);
      return;
    }

    let jsonStr = JSON.stringify(info, null, 2)
      .split(/\n/g)
      .map(function (line) {
        return `  ${line}`;
      })
      .join("\n");

    let comma = ",";
    if (i === addrs.length - 1) {
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
