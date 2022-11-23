#!/usr/bin/env node
"use strict";

const DUFFS = 100000000;

require("dotenv").config({ path: ".env" });

let Fs = require("node:fs/promises");

let Dashcore = require("@dashevo/dashcore-lib");
let Transaction = Dashcore.Transaction;

let dashsightBaseUrl =
  process.env.DASHSIGHT_BASE_URL || "https://insight.dash.org/insight-api";

let Dashsight = require("../");

let dashsight = Dashsight.create({
  insightBaseUrl: dashsightBaseUrl,
  dashsightBaseUrl: dashsightBaseUrl,
  dashsocketBaseUrl: "", // not needed here
});

let Pub = require("./_wif-to-addr.js");

async function main() {
  let addrs = process.argv.slice(2);

  if (2 !== addrs.length) {
    console.error(`Usage: create-tx <wif> <payaddr>`);
    process.exit(1);
    return;
  }

  let wifpath = addrs[0];
  let payaddr = addrs[1];

  console.info();

  let wif = await Fs.readFile(wifpath, "utf8");
  wif = wif.trim();

  let source = await Pub.wifToAddr(wif);
  console.info(`Source:            ${source}`);
  console.info(`Destination:       ${payaddr}`);
  console.info();

  let utxos = await dashsight.getUtxos(source);
  let hasUtxos = utxos.length > 0;
  if (!hasUtxos) {
    console.error(`'${source}' is completely spent`);
    process.exit(1);
    return;
  }

  let utxo = utxos[0];
  let duffs = toDuffs(utxo.satoshis);
  let dash = toDash(utxo.satoshis);
  console.info(`First Unspent Tx:  ${dash} (${duffs})`);

  let coreUtxo = {
    txId: utxo.txid,
    outputIndex: utxo.vout,
    address: utxo.address,
    script: utxo.scriptPubKey,
    satoshis: utxo.satoshis,
  };

  let fee = 191;

  let feeDash = toDash(fee);
  let feeDuffs = toDuffs(fee);
  console.info(`Fee:               ${feeDash} (${feeDuffs})`);

  let amount = coreUtxo.satoshis - fee;
  let amountDash = toDash(amount);
  let amountDuffs = toDuffs(amount);
  console.info(`Payment Amount:    ${amountDash} (${amountDuffs})`);

  //@ts-ignore - no input required, actually
  let tx = new Transaction()
    //@ts-ignore - allows single value or array
    .from([coreUtxo]);
  tx.to(payaddr, amount);
  tx.fee(fee);
  tx.sign(wif);

  let txHex = tx.toString();
  console.info();
  console.info(txHex);

  console.info();
  console.info(
    "Inspect transaction hex at https://live.blockcypher.com/dash/decodetx/",
  );
  console.info();
}

/**
 * @param {Number} duffs
 * @returns {String}
 */
function toDuffs(duffs) {
  return duffs.toString().padStart(9, "0");
}

/**
 * @param {Number} duffs
 * @returns {String}
 */
function toDash(duffs) {
  return (duffs / DUFFS).toFixed(8);
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
