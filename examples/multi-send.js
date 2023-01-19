#!/usr/bin/env node
"use strict";

/**
 * @overview Multiple-Input, Multiple Output Send
 *
 * An example of making payments to multiple addresses,
 * from multiple UTXOs, owned by multiple keys.
 */

require("dotenv").config({ path: ".env" });

let dashsightBaseUrl =
  process.env.DASHSIGHT_BASE_URL ||
  "https://dashsight.dashincubator.dev/insight-api";
let insightBaseUrl =
  process.env.INSIGHT_BASE_URL || "https://insight.dash.org/insight-api";

// the cost of a single input, single output tx is between 191 and 193
const MIN_FEE = 191;
const DUST = 2000;

let Crypto = exports.crypto || require("../shims/crypto-node.js");
let Fs = require("node:fs/promises");

let Dashsight = require("../");

let Base58Check = require("@dashincubator/base58check").Base58Check;
let BlockTx = require("@dashincubator/blocktx");
let RIPEMD160 = require("@dashincubator/ripemd160");
let Secp256k1 = require("@dashincubator/secp256k1");

let b58c = Base58Check.create({
  pubKeyHashVersion: "4c",
  privateKeyVersion: "cc",
});
let dashsight = Dashsight.create({
  insightBaseUrl: insightBaseUrl,
  dashsightBaseUrl: dashsightBaseUrl,
});
let dashTx = BlockTx.create({
  version: 3,
  sign: signTx,
  toPublicKey: toPublicKey,
});

async function main() {
  let wifsPath = process.argv[2];
  let paymentPairs = process.argv.slice(3);
  let changeAddr;

  if (!paymentPairs.length) {
    // address with no amount is change address
    console.error(
      "Usage: examples/multi-send.js <wif-file> <pay-addr1:amount pay-addr2[:amount] ...>",
    );
    console.error(
      "Example: examples/multi-send.js ./wifs.txt XdMjvLrgMpoTjhPnQ2YfWzLXxWLATofqLX:20000 Xhn6eTCwW94vhVifhshyTeihvTa7LcatiM",
    );
    process.exit(1);
  }

  let payments = [
    /* Example
    {
      address: "XmpcA2iWGL69vdys8jidRvNapSFc1cw5Co",
      satoshis: 75000,
    },
    */
  ];
  for (let paymentPair of paymentPairs) {
    let pair = paymentPair.split(":");
    let sats = parseInt(pair[1], 10);
    if (sats) {
      payments.push({
        address: pair[0],
        satoshis: sats,
      });
      continue;
    }
    if (changeAddr) {
      throw new Error(
        "you can only have one change address (pay addr with no sats)",
      );
    }
    changeAddr = pair[0];
  }
  console.log("debug, payto", payments);

  let wifsText = await Fs.readFile(wifsPath, "ascii");
  let wifLines = wifsText.split(/[\r\n]+/);

  // Note: each UTXO to be spent must be signed by its corresponds key
  let wifs = [];
  let keys = [];
  let addrs = [];
  let utxos = [
    /* Example
    {
      // convenience for getPrivateKey/getPublicKey
      address: "Xf7vuu6R1ir7kk8hShnXdpir3MKJ5bWpFs",
      outputIndex: 0,
      satoshis: 99809,
      script: "76a914309f24907c81d7e56169b1ab5f86e89aba0f808488ac",
      sigHashType: 0x01, // implicit, optional
      txId: "966343979b762c30431b38654b70e8a5a43c394a9c67f80862cfb992f8955d16",
    }
    */
  ];
  for (let line of wifLines) {
    let wif = line.trim();
    if (!wif) {
      return;
    }
    let privateKey = await wifToPrivateKey(wif);
    let addr = await wifToAddr(wif);
    let insightUtxo = await dashsight.getUtxos(addr);
    let coreUtxos = dashsight.toCoreUtxos(insightUtxo);
    for (let coreUtxo of coreUtxos) {
      wifs.push(wif);
      keys.push(privateKey);
      addrs.push(addr);
      utxos.push(coreUtxo);
    }
  }
  console.log("debug, utxos", utxos);

  let tx = await createTx(keys, utxos, payments, changeAddr);

  let txHex = tx.transaction;
  console.info();
  console.info(
    "Transaction Hex: (inspect at https://live.blockcypher.com/dash/decodetx/)",
  );
  console.info(txHex);
  console.info();

  //throw new Error('throwing before the real instantsend')
  let result = await dashsight.instantSend(txHex);

  console.info("Transaction ID:");
  console.info(result.body.txid);
  console.info();
}

async function createTx(keys, coreUtxos, payments, changeAddr) {
  let spendableDuffs = coreUtxos.reduce(function (total, utxo) {
    return total + utxo.satoshis;
  }, 0);
  let spentDuffs = payments.reduce(function (total, output) {
    return total + output.satoshis;
  }, 0);
  let unspentDuffs = spendableDuffs - spentDuffs;

  let txInfo = {
    inputs: coreUtxos,
    outputs: payments,
  };
  // variation is ~1%, on average
  let medianFee = BlockTx.estimate(txInfo);

  if (unspentDuffs < MIN_FEE) {
    throw new Error(
      `overspend: inputs total '${spendableDuffs}', but outputs total '${spentDuffs}', which leaves no way to pay the fee of '${medianFee}'`,
    );
  }

  let outputs = txInfo.outputs.slice(0);
  let change;

  let tx;
  for (;;) {
    // Note: Cyclic Fee Estimation
    //
    // The fee varies base on the number of bytes, which in turn may vary based on
    // the fee, especially for small transactions. Hence we loop to figure it out.
    //
    // It is possible to calculate the full fee ahead of time, however, it's more
    // complexity than this example deserves.
    change = unspentDuffs - (medianFee + BlockTx.OUTPUT_SIZE);
    if (change < DUST) {
      change = 0;
    }
    if (change) {
      txInfo.outputs = outputs.slice(0);
      txInfo.outputs.push({
        address: changeAddr,
        satoshis: change,
      });
    }
    tx = await dashTx.hashAndSignAll(txInfo, keys);

    let realFee = tx.transaction.length / 2;
    if (realFee <= medianFee) {
      break;
    }
    medianFee += 1;
    if (medianFee > unspentDuffs) {
      let total = spentDuffs + medianFee;
      throw new Error(
        `overspend: inputs total '${spendableDuffs}', but outputs (${spentDuffs}) + fee (${medianFee}) is '${total}'`,
      );
    }
  }

  return tx;
}

async function signTx({ privateKey, hash }) {
  let sigOpts = { canonical: true };
  let sigBuf = await Secp256k1.sign(hash, privateKey, sigOpts);
  return sigBuf;
}

function toPublicKey(privBuf) {
  let isCompressed = true;
  let pubKey = Secp256k1.getPublicKey(privBuf, isCompressed);
  return pubKey;
}

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

async function hashPublicKey(pubBuf) {
  let sha = await Crypto.subtle.digest("SHA-256", pubBuf);
  let shaU8 = new Uint8Array(sha);
  let ripemd = RIPEMD160.create();
  let hash = ripemd.update(shaU8);
  let pkh = hash.digest("hex");
  return pkh;
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
