#!/usr/bin/env node
"use strict";

/**
 * @overview Multiple-Input, Full Balance Transfer
 *
 * A typical example of transferring a balance from multiple UTXOs,
 * owned by multiple keys, to a single payment address.
 */

require("dotenv").config({ path: ".env" });

let Fs = require("node:fs/promises");

let Dashsight = require("../");

let dashsightBaseUrl =
  process.env.DASHSIGHT_BASE_URL ||
  "https://dashsight.dashincubator.dev/insight-api";
let insightBaseUrl =
  process.env.INSIGHT_BASE_URL || "https://insight.dash.org/insight-api";

let dashsight = Dashsight.create({
  dashsightBaseUrl: dashsightBaseUrl,
  insightBaseUrl: insightBaseUrl,
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
let Crypto = exports.crypto || require("../shims/crypto-node.js");

async function signTx({ privateKey, hash }) {
  let sigOpts = { canonical: true };
  let sigBuf = await Secp256k1.sign(hash, privateKey, sigOpts);
  return BlockTx.utils.u8ToHex(sigBuf);
}

function toPublicKey(privBuf) {
  let isCompressed = true;
  let pubKey = Secp256k1.getPublicKey(privBuf, isCompressed);
  return pubKey;
}

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

async function addrToPubKeyHash(addr) {
  let parts = await b58c.verify(addr);
  return parts.pubKeyHash;
}

// the cost of a typical, single input, single output tx is 191-193,
// depending on signature padding
//const BASE_FEE = 191; // up to 193
//const DUST = 2000;
const DUST = 193;

async function main() {
  let wifsPath = process.argv[2];
  let paymentAddr = process.argv[3];

  if (!paymentAddr) {
    console.error("Usage: examples/balance-transfer.js <wif-file> <pay-addr>");
    console.error(
      "Example: examples/balance-transfer.js ./wifs.txt XdMjvLrgMpoTjhPnQ2YfWzLXxWLATofqLX",
    );
    process.exit(1);
  }

  let wifsText = await Fs.readFile(wifsPath, "ascii");
  let wifLines = wifsText.split(/[\r\n]+/);

  // Note: each UTXO to be spent must be signed by its corresponds key
  let wifs = [];
  let keys = [];
  let addrs = [];
  let utxos = [];
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

  let dashtx = BlockTx.create({
    version: 3,
    sign: signTx,
    getPrivateKey: async function (txInput, i) {
      let privKey = keys[i];
      return privKey;
    },
    getPublicKey: async function (txInput, i) {
      let privKey = keys[i];
      let pubKey = toPublicKey(privKey);
      return pubKey;
    },
  });

  /* EXAMPLE
  // Spendable UTXOs from two private keys
  let utxos = [
    {
      address: "Xf7vuu6R1ir7kk8hShnXdpir3MKJ5bWpFs",
      outputIndex: 0,
      satoshis: 99809,
      script: "76a914309f24907c81d7e56169b1ab5f86e89aba0f808488ac",
      txId: "966343979b762c30431b38654b70e8a5a43c394a9c67f80862cfb992f8955d16",
    },
  ];
  */

  // The full transferable balance
  let availableDuffs = utxos.reduce(function (total, utxo) {
    return total + utxo.satoshis;
  }, 0);

  let inputs = [];
  for (let i in utxos) {
    let utxo = utxos[i];
    inputs.push({
      txId: utxo.txId,
      prevIndex: utxo.outputIndex,
      // publicKey: , // optional
      sigHashType: 0x01, // optional
      subscript: utxo.script,
    });
  }

  let txInfoEstimate = {
    inputs: inputs,
    outputs: [
      {
        pubKeyHash: addrToPubKeyHash(paymentAddr),
        units: 0,
      },
    ],
  };
  let [minFee, maxFee] = BlockTx.estimate(txInfoEstimate);
  if (!minFee) {
    throw new Error("minFee is NaN");
  }
  if (!maxFee) {
    throw new Error("maxFee is NaN");
  }
  let feeSpread = maxFee - minFee;

  // TODO to what length do we take the diminishing returns?
  let lowFeeExtra = Math.floor(feeSpread / 16);
  let fee = minFee + lowFeeExtra;

  let txInfo;
  let txInfoSigned;
  let txHex;

  // Note: Cyclic Fee Estimation
  //
  // The fee varies base on the number of bytes, which in turn may vary based on
  // the fee, especially for small transactions. Hence we loop to figure it out.
  //
  // It is possible to calculate the full fee ahead of time, however, it's more
  // complexity than this example deserves.
  //
  // In the best case scenario:
  //     191 => 191 (no bigint pad, stable, exits)
  // In the worst case scenario:
  //     191 => 2000 (no bigint pad, just more items)
  //     2000 => 2001 (input 1: 1st bigint pad)
  //     2001 => 2002 (input 1: 1st & 2nd bigint pad)
  //     2002 => 2002 (stable, exits)
  let ITER_ERROR = feeSpread + 1;
  for (let i = 0; ; i += 1) {
    if (i >= ITER_ERROR) {
      throw new Error("SANITY FAIL: more loops than possible fee combos");
    }

    let spendableDuffs = availableDuffs - fee;
    if (spendableDuffs < DUST) {
      throw new Error(
        `dust: inputs total '${availableDuffs}', which is considered non-spendable "dust"`,
      );
    }

    txInfo = {
      version: 3, // (will be) optional
      inputs: inputs,
      outputs: [
        {
          pubKeyHash: await addrToPubKeyHash(paymentAddr),
          units: spendableDuffs,
        },
      ],
      // TODO any sort of minimum fee guessing?
      locktime: 0, // optional
    };
    txInfoSigned = await dashtx.hashAndSignAll(txInfo);
    txHex = txInfoSigned.transaction.toString();

    let newFee = Math.max(fee, txHex.length / 2);
    if (newFee === fee) {
      break;
    }

    fee = newFee;
  }

  console.info();
  console.info("Transaction Hex:");
  console.info();
  console.info(txHex);
  console.info();

  console.info("Inspect at https://live.blockcypher.com/dash/decodetx/");
  console.info();
  console.info("Or Broadcast to the network:");
  console.info();
  console.info("    # replace the '<txHex>' with Transaction Hex above");
  console.info("    dashsight instantsend '03000000...88ac00000000'");
  console.info();
  /*
  let result = await dashsight.instantSend(txHex);

  console.info("Transaction ID:");
  console.info(result.body.txid);
  console.info();
  */
}

/**
 * @param {TxInfo} txInfo
 * @returns {[Number, Number]}
 */
BlockTx.estimate = function (txInfo) {
  let size = BlockTx._HEADER_ONLY_SIZE;

  size += BlockTx.utils.toVarIntSize(txInfo.inputs.length);
  size += BlockTx.MIN_INPUT_SIZE * txInfo.inputs.length;

  size += BlockTx.utils.toVarIntSize(txInfo.outputs.length);
  size += BlockTx.OUTPUT_SIZE * txInfo.outputs.length;

  let maxPadding = BlockTx.MAX_INPUT_PAD * txInfo.inputs.length;
  let maxSize = size + maxPadding;

  return [size, maxSize];
};
BlockTx._HEADER_ONLY_SIZE = 8;
BlockTx.MAX_INPUT_PAD = 2;

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
