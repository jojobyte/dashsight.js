"use strict";

/**
 * @param {InsightTx} tx
 */
module.exports = function printTx(tx) {
  let inputs = tx.vin.map(function (vin) {
    if (!vin.value) {
      return { addr: "", value: "" };
    }
    return { addr: vin.addr, value: vin.value.toFixed(8) };
  });
  let outputs = tx.vout.map(function (vout) {
    return {
      addr: vout.scriptPubKey.addresses.join(","),
      value: `${vout.value}`,
    };
  });
  if (tx.fees) {
    // minted coins have no fees
    outputs.push({
      addr: "(Network Fee)",
      value: `${tx.fees}`,
    });
  }

  console.info(`[${tx.txid}]`);
  console.info(`Inputs:`);
  inputs.forEach(function (vin) {
    if (!vin.value) {
      console.info(`          (none) <= (Minted from Coinbase)`);
      return;
    }

    let vinValue = vin.value.padStart(13, " ");
    console.info(`  Đ${vinValue} <= ${vin.addr}`);
  });
  console.info(`Outputs:`);
  outputs.forEach(function (vout) {
    let voutValue = vout.value.padStart(13, " ");
    console.info(`  Đ${voutValue} => ${vout.addr}`);
  });
};
