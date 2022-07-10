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
const DUST = 2000;

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
      satoshis: 75000,
    },
    {
      address: "XfgZetFiNZDzGZXksMgbvWcyoz87hs7L5T",
      satoshis: 75000,
    },
  ];

  // The change address
  // (required as a safeguard, but we won't generate change here)
  let changeAddr = "XxtRtjzhHLiVqjyTxaPVAhvUbYFfBUtNwf";

  // Each utxo to be spent must be signed by its corresponds key
  //let Fs = require("fs").promises;
  let keys = [
    // (await Fs.readFile("./key-1.wif", "utf8")).trim()
    "<private-key-wif-for-addr-1-goes-here>",
  ];
  throw new Error("change the example to use your key (and remove the error)");

  let tx = createTx(keys, coreUtxos, payments, changeAddr);

  let txHex = tx.serialize();
  console.info();
  console.info(
    "Transaction Hex: (inspect at https://live.blockcypher.com/dash/decodetx/)",
  );
  console.info(txHex);
  console.info();

  let result = await dashsight.instantSend(txHex);

  console.info("Transaction ID:");
  console.info(result.body.txid);
  console.info();
}

function createTx(keys, coreUtxos, payments, changeAddr) {
  // The full transferable balance
  let availableDuffs = coreUtxos.reduce(function (total, utxo) {
    return total + utxo.satoshis;
  }, 0);

  let fee = BASE_FEE;
  let tx;
  for (;;) {
    // Note: Cyclic Fee Estimation
    //
    // The fee varies base on the number of bytes, which in turn may vary based on
    // the fee, especially for small transactions. Hence we loop to figure it out.
    //
    // It is possible to calculate the full fee ahead of time, however, it's more
    // complexity than this example deserves.
    tx = calcTx();
    if (tx) {
      break;
    }
  }

  return tx;

  function calcTx() {
    let spendableDuffs = availableDuffs - fee;

    payments.forEach(function (payment) {
      spendableDuffs -= payment.satoshis;
    });
    if (spendableDuffs < 0) {
      let overspend = availableDuffs + Math.abs(spendableDuffs);
      throw new Error(
        `overspend: inputs total '${availableDuffs}', but outputs + fees total '${overspend}'`,
      );
    }

    //@ts-ignore - the constructor can, in fact, take 0 arguments
    tx = new Transaction();
    tx.from(coreUtxos);

    tx.to(payments);
    tx.change(changeAddr);
    tx.fee(fee);
    tx.sign(keys);

    let hex = tx.toString();
    let newFee = hex.length / 2;
    if (newFee <= fee) {
      if (0 === spendableDuffs || spendableDuffs >= DUST) {
        return tx;
      }
      // donate dust to the network
      newFee += spendableDuffs;
      spendableDuffs = 0;
    }

    fee = newFee;
    return null;
  }
}

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
