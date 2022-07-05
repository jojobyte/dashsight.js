"use strict";

let Insight = module.exports;

let request = require("./request.js");

const DUFFS = 100000000;

/**
 * @param {Object} opts
 * @param {String} opts.baseUrl
 */
Insight.create = function ({ baseUrl }) {
  let insight = {};

  /**
   * Don't use this with instantSend
   * @param {String} address
   * @returns {Promise<InsightBalance>}
   */
  insight.getBalance = async function (address) {
    console.warn(`warn: getBalance(pubkey) doesn't account for instantSend,`);
    console.warn(`      consider (await getUtxos()).reduce(countSatoshis)`);
    let txUrl = `${baseUrl}/insight-api/addr/${address}/?noTxList=1`;
    let txResp = await request({ url: txUrl, json: true });

    /** @type {InsightBalance} */
    let data = txResp.body;
    return data;
  };

  /**
   * Instant Balance is accurate with Instant Send
   * @param {String} address
   * @returns {Promise<InstantBalance>}
   */
  insight.getInstantBalance = async function (address) {
    let utxos = await insight.getUtxos(address);
    let balanceDuffs = utxos.reduce(function (total, utxo) {
      return total + utxo.satoshis;
    }, 0);
    // because 0.1 + 0.2 = 0.30000000000000004,
    // but we would only want 0.30000000
    let balanceDash = (balanceDuffs / DUFFS).toFixed(8);

    return {
      addrStr: address,
      balance: parseFloat(balanceDash),
      balanceSat: balanceDuffs,
      _utxoCount: utxos.length,
      _utxoAmounts: utxos.map(function (utxo) {
        return utxo.satoshis;
      }),
    };
  };

  /**
   * @param {String} address
   * @returns {Promise<Array<InsightUtxo>>}
   */
  insight.getUtxos = async function (address) {
    let utxoUrl = `${baseUrl}/insight-api/addr/${address}/utxo`;
    let utxoResp = await request({ url: utxoUrl, json: true });

    /** @type Array<InsightUtxo> */
    let utxos = utxoResp.body;
    return utxos;
  };

  /**
   * @param {String} txid
   * @returns {Promise<InsightTx>}
   */
  insight.getTx = async function (txid) {
    let txUrl = `${baseUrl}/insight-api/tx/${txid}`;
    let txResp = await request({ url: txUrl, json: true });

    /** @type InsightTx */
    let data = txResp.body;
    return data;
  };

  /**
   * @param {String} addr
   * @param {Number} maxPages
   * @returns {Promise<InsightTxResponse>}
   */
  insight.getTxs = async function (addr, maxPages) {
    let txUrl = `${baseUrl}/insight-api/txs?address=${addr}&pageNum=0`;
    let txResp = await request({ url: txUrl, json: true });

    /** @type {InsightTxResponse} */
    let body = txResp.body;

    let data = await getAllPages(body, addr, maxPages);
    return data;
  };

  /**
   * @param {InsightTxResponse} body
   * @param {String} addr
   * @param {Number} maxPages
   */
  async function getAllPages(body, addr, maxPages) {
    let pagesTotal = Math.min(body.pagesTotal, maxPages);
    for (let cursor = 1; cursor < pagesTotal; cursor += 1) {
      let nextResp = await request({
        url: `${baseUrl}/insight-api/txs?address=${addr}&pageNum=${cursor}`,
        json: true,
      });
      // Note: this could still be wrong, but I don't think we have
      // a better way to page so... whatever
      body.txs = body.txs.concat(nextResp.body.txs);
    }
    return body;
  }

  /**
   * @param {String} hexTx
   */
  insight.instantSend = async function (hexTx) {
    let instUrl = `${baseUrl}/insight-api-dash/tx/sendix`;
    let reqObj = {
      method: "POST",
      url: instUrl,
      form: {
        rawtx: hexTx,
      },
    };
    let txResp = await request(reqObj);
    if (!txResp.ok) {
      // TODO better error check
      throw new Error(JSON.stringify(txResp.body, null, 2));
    }
    return txResp.toJSON();
  };

  /**
   * @param {Array<InsightUtxo>} body
   */
  async function getUtxos(body) {
    /** @type Array<CoreUtxo> */
    let utxos = [];

    await body.reduce(async function (promise, utxo) {
      await promise;

      let data = await insight.getTx(utxo.txid);

      // TODO the ideal would be the smallest amount that is greater than the required amount

      let utxoIndex = -1;
      data.vout.some(function (vout, index) {
        if (!vout.scriptPubKey?.addresses?.includes(utxo.address)) {
          return false;
        }

        let satoshis = Math.round(parseFloat(vout.value) * DUFFS);
        if (utxo.satoshis !== satoshis) {
          return false;
        }

        utxoIndex = index;
        return true;
      });

      utxos.push({
        txId: utxo.txid,
        outputIndex: utxoIndex,
        address: utxo.address,
        script: utxo.scriptPubKey,
        satoshis: utxo.satoshis,
      });
    }, Promise.resolve());

    return utxos;
  }

  return insight;
};
