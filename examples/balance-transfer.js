#!/usr/bin/env node
"use strict";

/**
 * @overview Multiple-Input, Full Balance Transfer
 *
 * A typical example of transferring a balance from multiple UTXOs,
 * owned by multiple keys, to a single payment address.
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
      address: "Xf7vuu6R1ir7kk8hShnXdpir3MKJ5bWpFs",
      outputIndex: 0,
      satoshis: 99809,
      script: "76a914309f24907c81d7e56169b1ab5f86e89aba0f808488ac",
      txId: "966343979b762c30431b38654b70e8a5a43c394a9c67f80862cfb992f8955d16",
    },
    {
      address: "XmKzeKbSKtP6Ld3XpWf1S7a6hxRFmXvtqu",
      outputIndex: 0,
      satoshis: 99809,
      script: "76a91474b8010010c29e778dae98f48a155a379554190088ac",
      txId: "57d573d612b826c8d5729406aba4b18cc153bb0264e4211b4f7543eb55b28949",
    },
  ];

  // The destination address
  let paymentAddr = "XdMjvLrgMpoTjhPnQ2YfWzLXxWLATofqLX";

  // The change address
  // (required as a safeguard, but we won't generate change here)
  let changeAddr = paymentAddr;

  // The full transferable balance
  let availableDuffs = coreUtxos.reduce(function (total, utxo) {
    return total + utxo.satoshis;
  }, 0);

  // Each utxo to be spent must be signed by its corresponds key
  let keys = [
    "<private-key-wif-for-addr-1-goes-here>",
    "<private-key-wif-for-addr-2-goes-here>",
  ];
  throw new Error("change the example to use your keys (and remove the error)");

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
    if (spendableDuffs < DUST) {
      throw new Error(
        `dust: inputs total '${availableDuffs}', which is considered non-spendable "dust"`,
      );
    }

    let payments = [
      {
        address: paymentAddr,
        satoshis: spendableDuffs,
      },
    ];

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
      break;
    }

    fee = newFee;
  }

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

main()
  .then(function () {
    process.exit(0);
  })
  .catch(function (err) {
    console.error(err);
    process.exit(1);
  });
