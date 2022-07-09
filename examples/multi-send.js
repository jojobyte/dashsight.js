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
  process.env.INSIGHT_BASE_URL || "https://insight.dash.org";

let Dashsight = require("../");

let dashsight = Dashsight.create({
  baseUrl: dashsightBaseUrl,
});

let Dashcore = require("@dashevo/dashcore-lib");
let Transaction = Dashcore.Transaction;

// the cost of a typical single input, single output tx
const BASE_FEE = 192;

// ins
//XmpcA2iWGL69vdys8jidRvNapSFc1cw5Co;
//XfgZetFiNZDzGZXksMgbvWcyoz87hs7L5T;

// outs
//XxtRtjzhHLiVqjyTxaPVAhvUbYFfBUtNwf;
//XegAvRKfiPRLge3wQiuSwCpooqyzo7Zm51;

async function main() {
  // Spendable UTXOs from two private keys
  let coreUtxos = [
    {
      address: "XdMjvLrgMpoTjhPnQ2YfWzLXxWLATofqLX",
      outputIndex: 0,
      satoshis: 199278,
      script: "76a9141d4b89eda7eaf41672884296159a7fc57b59d97088ac",
      txId: "57fe8d4ae28bc5e82aeef5e56863f9d4a9cca1697caf7ef48bc475215b8cb1c5",
    },
  ];

  // The destination address
  let payments = [
    {
      address: "XmpcA2iWGL69vdys8jidRvNapSFc1cw5Co",
      value: 0, // remainder
    },
    {
      address: "XfgZetFiNZDzGZXksMgbvWcyoz87hs7L5T",
      value: 0, // remainder
    },
  ];

  // The change address
  // (required as a safeguard, but we won't generate change here)
  let changeAddr = "XxtRtjzhHLiVqjyTxaPVAhvUbYFfBUtNwf";

  // The full transferable balance
  let availableDuffs = coreUtxos.reduce(function (total, utxo) {
    return total + utxo.satoshis;
  }, 0);

  // Each utxo to be spent must be signed by its corresponds key
  let Fs = require("fs").promises;
  let keys = [(await Fs.readFile("./source-1.wif", "utf8")).trim()];

  // Note: Cyclic Fee Estimation
  //
  // The fee varies base on the number of bytes, which in turn may vary based on
  // the fee, especially for small transactions. Hence we loop to figure it out.
  //
  // It is possible to calculate the full fee ahead of time, however, it's more
  // complexity than this example deserves.
  let fee = BASE_FEE;
  let tx;
  for (;;) {
    let spendableDuffs = availableDuffs - fee;
    //@ts-ignore - the constructor can, in fact, take 0 arguments
    tx = new Transaction();
    tx.from(coreUtxos);
    tx.to(paymentAddr, spendableDuffs);
    tx.change(changeAddr);
    tx.fee(fee);
    tx.sign(keys);

    let hex = tx.toString();
    let newFee = hex.length / 2;
    if (newFee <= fee) {
      break;
    }

    fee = newFee;
  }

  let txHex = tx.serialize();
  console.info("Transaction Hex:");
  console.info(txHex);
  console.info("(inspect at https://live.blockcypher.com/dash/decodetx/)");
  console.info();

  let result = await dashsight.instantSend(txHex);

  console.info("Transaction ID:");
  console.info(result.body.txid);
  console.info();
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
