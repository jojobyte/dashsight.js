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
  let txids = process.argv.slice(2);

  if (!txids.length) {
    console.error(`Usage: tx <txid> [txid,...]`);
    process.exit(1);
    return;
  }

  console.info();
  if (json) {
    console.info("[");
  } else {
    console.info(`Transaction Details...`);
  }

  await txids.reduce(async function (promise, txid, i) {
    await promise;
    let tx = await dashsight.getTx(txid);
    if (!json) {
      console.info();
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

      console.info(`[${txid}]`);
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
      /*
Inputs:
  Đ0.00100001 <= Xhn6eTCwW94vhVifhshyTeihvTa7LcatiM
Outputs:
  Đ0.00099809 => XmCyQ6qARLWXap74QubFMunngoiiA1QgCL
  Đ0.00000192 => (Network Fee)
      */
      return;
    }

    let jsonStr = JSON.stringify(tx, null, 2)
      .split(/\n/g)
      .map(function (line) {
        return `  ${line}`;
      })
      .join("\n");

    let comma = ",";
    if (i === txids.length - 1) {
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
