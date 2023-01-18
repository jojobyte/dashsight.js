#!/usr/bin/env node
"use strict";

const DUFFS = 100000000;

require("dotenv").config({ path: ".env" });

let Fs = require("node:fs/promises");

let dashsightBaseUrl =
  process.env.DASHSIGHT_BASE_URL || "https://insight.dash.org/insight-api";

let Dashsight = require("../");

let dashsight = Dashsight.create({
  insightBaseUrl: dashsightBaseUrl,
  dashsightBaseUrl: "", //  not needed here
  dashsocketBaseUrl: "", // not needed here
});

let Base58Check = require("@dashincubator/base58check").Base58Check;
let b58c = Base58Check.create({
  pubKeyHashVersion: "4c",
  privateKeyVersion: "cc",
});
let BlockTx = require("@dashincubator/blocktx");
let RIPEMD160 = require("@dashincubator/ripemd160");
let Secp256k1 = require("@dashincubator/secp256k1");
//@ts-ignore
let Crypto = exports.crypto || require("../shims/crypto-node.js");

/**
 * @param {import('@dashincubator/blocktx').TxSignOpts} opts
 */
async function signTx({ privateKey, hash }) {
  let sigOpts = { canonical: true };
  let sigBuf = await Secp256k1.sign(hash, privateKey, sigOpts);
  return BlockTx.utils.u8ToHex(sigBuf);
}

/**
 * @param {import('@dashincubator/blocktx').TxPrivateKey} privBuf
 */
function toPublicKey(privBuf) {
  let isCompressed = true;
  let pubKey = Secp256k1.getPublicKey(privBuf, isCompressed);
  return pubKey;
}

/**
 * @param {import('@dashincubator/blocktx').TxPublicKey} pubBuf
 */
async function hashPublicKey(pubBuf) {
  //console.log("DEBUG pubBuf", pubBuf);
  let sha = await Crypto.subtle.digest("SHA-256", pubBuf);
  let shaU8 = new Uint8Array(sha);
  //console.log("DEBUG shaU8", shaU8);
  let ripemd = RIPEMD160.create();
  let hash = ripemd.update(shaU8);
  //console.log("DEBUG hash", hash);
  let pkh = hash.digest("hex");
  //console.log("DEBUG pkh", pkh);
  return pkh;
}

/**
 * @param {String} wif
 * @returns {Promise<Uint8Array>}
 */
async function wifToPrivateKey(wif) {
  let parts = await b58c.verify(wif);
  let privBuf = Buffer.from(parts.privateKey, "hex");
  return privBuf;
}

/**
 * @param {String} wif
 * @returns {Promise<String>}
 */
async function wifToAddr(wif) {
  let parts = await b58c.verify(wif);
  let privBuf = Buffer.from(parts.privateKey, "hex");
  let isCompressed = true;
  let pubBuf = Secp256k1.getPublicKey(privBuf, isCompressed);
  let pubKeyHash = await hashPublicKey(pubBuf);
  let addr = await b58c.encode({
    version: "4c",
    pubKeyHash: pubKeyHash,
  });
  return addr;
}

/**
 * @param {String} addr - base58check
 * @returns {Promise<String>} - pubKeyHash as hex
 */
async function addrToPubKeyHash(addr) {
  let parts = await b58c.verify(addr);
  return parts.pubKeyHash;
}

async function main() {
  let addrs = process.argv.slice(2);

  if (2 !== addrs.length) {
    console.error(`Usage: create-tx <wif> <pay-addr>`);
    process.exit(1);
    return;
  }

  let wifpath = addrs[0];
  let payAddr = addrs[1];

  console.info();

  let wif = await Fs.readFile(wifpath, "utf8");
  wif = wif.trim();

  let source = await wifToAddr(wif);
  console.info(`Source:            ${source}`);
  console.info(`Destination:       ${payAddr}`);
  console.info();

  let insightUtxos = await dashsight.getUtxos(source);
  let coreUtxos = Dashsight.toCoreUtxos(insightUtxos);
  let hasUtxos = coreUtxos.length > 0;
  if (!hasUtxos) {
    console.error(`'${source}' is completely spent`);
    process.exit(1);
    return;
  }

  let coreUtxo = coreUtxos[0];
  let key = await wifToPrivateKey(wif);
  let duffs = toDuffs(coreUtxo.satoshis);
  let dash = toDash(coreUtxo.satoshis);
  console.info(`First Unspent Tx:  ${dash} (${duffs})`);

  // max bytes for single tx with both bigint pads is 193
  let fee = 193;

  let feeDash = toDash(fee);
  let feeDuffs = toDuffs(fee);
  console.info(`Fee:               ${feeDash} (${feeDuffs})`);

  let units = coreUtxo.satoshis - fee;
  let amountDash = toDash(units);
  let amountDuffs = toDuffs(units);
  console.info(`Payment Amount:    ${amountDash} (${amountDuffs})`);

  let keys = [key];
  let inputs = [coreUtxo];
  let pubKeyHash = await addrToPubKeyHash(payAddr);
  let outputs = [{ pubKeyHash, units }];
  let txInfo = {
    version: 3, // (will be) optional
    inputs: inputs,
    outputs: outputs,
    // TODO any sort of minimum fee guessing?
    locktime: 0, // optional
  };

  let dashTx = BlockTx.create({
    version: 3,
    //@ts-ignore
    sign: signTx,
    //@ts-ignore
    getPrivateKey: async function (txInput, i) {
      let privKey = keys[i];
      return privKey;
    },
    //@ts-ignore
    getPublicKey: async function (txInput, i) {
      let privKey = keys[i];
      let pubKey = toPublicKey(privKey);
      return pubKey;
    },
  });

  //@ts-ignore
  let txInfoSigned = await dashTx.hashAndSignAll(txInfo, keys);
  let txHex = txInfoSigned.transaction.toString();

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
