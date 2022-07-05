# dashsight.js

SDK for Dash's flavor of the Insight API

# TODO

- Do we want to normalize duffs?

# Install

```bash
npm install --save dashsight
```

# Usage

```js
"use strict";

require("dotenv").config({ path: ".env" });

let dashsightBaseUrl =
  process.env.INSIGHT_BASE_URL || "https://insight.dash.org";

let dashsight = require("dashsight").create({
  baseUrl: dashsightBaseUrl,
});

dashsight.getInstantBalance(address).then(function (info) {
  console.info(`Current balance is: Đ${info.balance}`);
});
```

# API

| `Dashsight.create({ baseUrl })`        |
| -------------------------------------- |
| `dashsight.getInstantBalance(addrStr)` |
| `dashsight.getTx(txIdHex)`             |
| `dashsight.getTxs(addrStr, maxPages)`  |
| `dashsight.getUtxos(addrStr)`          |
| `dashsight.instantSend(txHex)`         |

## `Dashsight.create({ baseUrl })`

Creates an instance of the insight sdk bound to the given baseUrl.

```js
let Dashsight = = require("dashsight");

let dashsight Dashsight.create({
  baseUrl: "https://insight.dash.org",
});
```

Note: There is no default `baseUrl` (this is supposed to be used in a
decentralized fashion, after all), but `https://insight.dash.org` might be one
you trust.

## `insight.getBalance(address)` (BUG)

Do not use. Does not give accurate balances. Provided for completeness /
compatibility only.

## `dashsight.getInstantBalance(addr)`

Takes a normal payment address, gives back the instantaneous balance (reflects
instant send TXs).

```js
// Base58Check-encoded Pay to Pubkey Hash (p2pkh)
let addr = `Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;

let info = await dashsight.getInstantBalance(addr);

console.log(info);
```

Example output:

```json
{
  "addrStr": "Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "balance": 10.01,
  "balanceSat": 1001000000
}
```

Note: This is not actually part of Dash's Insight API, but would be if it could
correctly calculate balances adjusted for Instant Send.

## `dashsight.getTx(txIdHex)`

Get transaction details by its (hex-encoded) ID.

```js
// Base58Check-encoded Pay to Pubkey Hash (p2pkh)
let txid = `f92e66edc9c8da41de71073ef08d62c56f8752a3f4e29ced6c515e0b1c074a38`;

let tx = await dashsight.getTx(txid);

console.log(tx);
```

Example output:

```json
{
  "txid": "f92e66edc9c8da41de71073ef08d62c56f8752a3f4e29ced6c515e0b1c074a38",
  "version": 2,
  "locktime": 1699123,
  "vin": [
    {
      "txid": "346035a9ab38c84eb13964aff45e7a4d363f467fb755be0ffac6dfb2f80f63dc",
      "vout": 1,
      "sequence": 4294967294,
      "n": 0,
      "scriptSig": {
        "hex": "483045022100f8f5feb0a533f8509cb6cbb0b046dc1136adaab378e9a5151dc4fe633dd064710220157b08ddf7557b5e69c6128989a7da7fccadd28836f0fb99860d730f4320681a0121038c681a93929bb4fe5d39025d42f711abab49a247f8312943d3021c6eb3231c82",
        "asm": "3045022100f8f5feb0a533f8509cb6cbb0b046dc1136adaab378e9a5151dc4fe633dd064710220157b08ddf7557b5e69c6128989a7da7fccadd28836f0fb99860d730f4320681a[ALL] 038c681a93929bb4fe5d39025d42f711abab49a247f8312943d3021c6eb3231c82"
      },
      "addr": "Xhn6eTCwW94vhVifhshyTeihvTa7LcatiM",
      "valueSat": 100001,
      "value": 0.00100001,
      "doubleSpentTxID": null
    }
  ],
  "vout": [
    {
      "value": "0.00099809",
      "n": 0,
      "scriptPubKey": {
        "hex": "76a91473640d816ff4161d8c881da78983903bf9eba2d988ac",
        "asm": "OP_DUP OP_HASH160 73640d816ff4161d8c881da78983903bf9eba2d9 OP_EQUALVERIFY OP_CHECKSIG",
        "addresses": ["XmCyQ6qARLWXap74QubFMunngoiiA1QgCL"],
        "type": "pubkeyhash"
      },
      "spentTxId": null,
      "spentIndex": null,
      "spentHeight": null
    }
  ],
  "blockheight": -1,
  "confirmations": 0,
  "time": 1657004174,
  "valueOut": 0.00099809,
  "size": 192,
  "valueIn": 0.00100001,
  "fees": 0.00000192,
  "txlock": true
}
```

## `dashsight.getTxs(addrStr)`

Get all transaction associated with an address.

```js
// Base58Check-encoded Pay to Pubkey Hash (p2pkh)
let addr = `Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;

let txs = await dashsight.getTxs(addr);

console.log(txs);
```

Example output:

```json
[ ]
```

## `dashsight.getUtxos(addrStr)`

Gets all unspent transaction outputs (the usable "coins") for the given address.

```js
// Base58Check-encoded Pay to Pubkey Hash (p2pkh)
let addr = `Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`;

let utxos = await dashsight.getUtxos(addr);

console.log(utxos);
```

```json
[
  {
    "address": "Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "txid": "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "vout": 0,
    "scriptPubKey": "00000000000000000000000000000000000000000000000000",
    "amount": 0.01,
    "satoshis": 1000000,
    "height": 1500000,
    "confirmations": 200000
  }
]
```

## `dashsight.instantSend(txHex)`

TODO
