(function (exports) {
  "use strict";

  let Dashsight = {};
  //@ts-ignore
  exports.DashSight = Dashsight;

  const DUFFS = 100000000;

  /** @typedef {import('./').CoreUtxo} CoreUtxo */
  /** @typedef {import('./').InsightBalance} InsightBalance */
  /** @typedef {import('./').InsightTx} InsightTx */
  /** @typedef {import('./').InsightTxResponse} InsightTxResponse */
  /** @typedef {import('./').InsightTxVin} InsightTxVin */
  /** @typedef {import('./').InsightTxVout} InsightTxVout */
  /** @typedef {import('./').InsightUtxo} InsightUtxo */
  /** @typedef {import('./').InstantSend} InstantSend */
  /** @typedef {import('./').DashSightInstance} DashSightInstance */
  /** @typedef {import('./').GetBalance} GetBalance */
  /** @typedef {import('./').GetCoreUtxos} GetCoreUtxos */
  /** @typedef {import('./').GetInstantBalance} GetInstantBalance */
  /** @typedef {import('./').GetTx} GetTx */
  /** @typedef {import('./').GetTxs} GetTxs */
  /** @typedef {import('./').GetUtxos} GetUtxos */
  /** @typedef {import('./').ToCoreUtxo} ToCoreUtxo */
  /** @typedef {import('./').ToCoreUtxos} ToCoreUtxos */

  /**
   * @typedef {RequestInit & { headers: Object, body?: String }} DashHeaders
   */
  /**
   * @param {Object} [body]
   * @returns {DashHeaders}
   */
  function jsonRequestBody(body) {
    /**
     * @type {DashHeaders} headers
     */
    let headers = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
    }

    if (body) {
      headers.body = JSON.stringify(body)
    }

    return headers
  }

  /**
   * @param {Object} opts
   * @param {String} [opts.baseUrl] - for the Insight API
   * @param {String} opts.insightBaseUrl - for regular Insight features, includes prefix
   * @param {String} opts.dashsightBaseUrl - for Dash-specific features, such as instant send
   * @param {String} opts.dashsocketBaseUrl - for WebSocket notifications
   * @returns {DashSightInstance}
   */
  Dashsight.create = function ({
    baseUrl,
    dashsightBaseUrl,
    insightBaseUrl,
    dashsocketBaseUrl,
  }) {
    let insight = {};

    if (!dashsightBaseUrl) {
      dashsightBaseUrl = insightBaseUrl || `${baseUrl}/insight-api`;
    }
    if (dashsightBaseUrl.endsWith("/")) {
      dashsightBaseUrl = dashsightBaseUrl.slice(0, dashsightBaseUrl.length - 1);
    }

    if (!insightBaseUrl) {
      insightBaseUrl = dashsightBaseUrl;
    }
    if (insightBaseUrl.endsWith("/")) {
      insightBaseUrl = insightBaseUrl.slice(0, insightBaseUrl.length - 1);
    }

    if (!dashsocketBaseUrl) {
      dashsocketBaseUrl = `${baseUrl}/socket.io`;
    }
    if (dashsocketBaseUrl.endsWith("/")) {
      dashsocketBaseUrl = dashsocketBaseUrl.slice(
        0,
        dashsocketBaseUrl.length - 1,
      );
    }

    /** @type {GetBalance} */
    insight.getBalance = async function (address) {
      console.warn(`warn: getBalance(pubkey) doesn't account for instantSend,`);
      console.warn(`      consider (await getUtxos()).reduce(countSatoshis)`);
      let txUrl = `${insightBaseUrl}/addr/${address}/?noTxList=1`;
      let txResp = await fetch(txUrl, { ...jsonRequestBody() });

      /** @type {InsightBalance} */
      let data = txResp.body;
      return data;
    };

    /** @type {GetInstantBalance} */
    insight.getInstantBalance = async function (address) {
      let utxos = await insight.getUtxos(address);
      let balanceDuffs = utxos?.reduce(function (total, utxo) {
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

    /** @type {GetUtxos} */
    insight.getUtxos = async function (address) {
      let utxoUrl = `${insightBaseUrl}/addr/${address}/utxo`;
      let utxoResp = await fetch(utxoUrl, { ...jsonRequestBody() });

      /** @type Array<InsightUtxo> */
      let utxos = await utxoResp.json();
      return utxos;
    };

    /** @type {GetCoreUtxos} */
    insight.getCoreUtxos = async function (address) {
      let result = await insight.getTxs(address, 1);
      if (result.pagesTotal > 1) {
        let utxos = await insight.getUtxos(address);
        return insight.toCoreUtxos(utxos);
      }

      let coreUtxos = await getTxUtxos(address, result.txs);
      return coreUtxos;
    };

    /** @type {GetTx} */
    insight.getTx = async function (txid) {
      let txUrl = `${insightBaseUrl}/tx/${txid}`;
      let txResp = await fetch(txUrl, { ...jsonRequestBody() });

      /** @type InsightTx */
      let data = await txResp.json();
      return data;
    };

    /** @type {GetTxs} */
    insight.getTxs = async function (addr, maxPages) {
      let txUrl = `${insightBaseUrl}/txs?address=${addr}&pageNum=0`;
      let txResp = await fetch(txUrl, { ...jsonRequestBody() });

      /** @type {InsightTxResponse} */
      let body = await txResp.json();

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
        let nextResp = await fetch(
          `${insightBaseUrl}/txs?address=${addr}&pageNum=${cursor}`,
          { ...jsonRequestBody() }
        );
        nextResp = await nextResp.json();
        // Note: this could still be wrong, but I don't think we have
        // a better way to page so... whatever
        // @ts-ignore
        body.txs = body.txs.concat(nextResp?.txs);
      }
      return body;
    }

    /** @type {InstantSend} */
    insight.instantSend = async function (hexTx) {
      // Ex:
      //   - https://insight.dash.org/insight-api-dash/tx/sendix
      //   - https://dashsight.dashincubator.dev/insight-api/tx/sendix
      let instUrl = `${dashsightBaseUrl}/tx/sendix`;
      let reqObj = {
        method: "POST",
        ...jsonRequestBody({
          rawtx: hexTx,
        }),
      };
      let txResp = await fetch(instUrl, reqObj);
      if (!txResp.ok) {
        // TODO better error check
        throw new Error(JSON.stringify(txResp.body, null, 2));
      }
      return txResp.json();
    };

    /** @type {ToCoreUtxo} */
    insight.toCoreUtxo = Dashsight.toCoreUtxo;

    /** @type {ToCoreUtxos} */
    insight.toCoreUtxos = Dashsight.toCoreUtxos;

    /**
     * Handles UTXOs that have NO MORE THAN ONE page of transactions
     * @param {String} address
     * @param {Array<InsightTx>} txs - soonest-first-sorted transactions
     */
    async function getTxUtxos(address, txs) {
      /** @type { Array<CoreUtxo> } */
      let coreUtxos = [];

      txs.forEach(function (tx, i) {
        //let fee = tx.valueIn - tx.valueOut;
        // consumed as an input
        tx.vin.forEach(removeSpentOutputs);
        tx.vout.forEach(addUnspentOutputs);

        /**
         * @param {InsightTxVin} vin
         */
        function removeSpentOutputs(vin) {
          if (address !== vin.addr) {
            return;
          }

          let spentIndex = -1;
          coreUtxos.some(function (coreUtxo, i) {
            if (coreUtxo.txId !== vin.txid) {
              return false;
            }
            if (coreUtxo.outputIndex !== vin.vout) {
              return false;
            }
            if (coreUtxo.satoshis !== vin.valueSat) {
              return false;
            }
            spentIndex = i;
          });
          if (spentIndex >= 0) {
            // remove this output as unspent
            coreUtxos.splice(spentIndex, 1);
          }
        }

        /**
         * @param {InsightTxVout} vout
         * @param {Number} i
         */
        function addUnspentOutputs(vout, i) {
          // in theory this makes all of the vin checking above redundant
          if (vout.spentTxId) {
            return;
          }

          if (!vout.scriptPubKey.addresses.includes(address)) {
            return;
          }

          let value = Math.round(parseFloat(vout.value) * DUFFS);
          coreUtxos.push({
            address: address,
            outputIndex: i,
            satoshis: value,
            script: vout.scriptPubKey.hex,
            txId: tx.txid,
          });
        }
      });

      return coreUtxos;
    }

    return insight;
  };

  /** @type {ToCoreUtxo} */
  Dashsight.toCoreUtxo = function (utxo) {
    return {
      txId: utxo.txid,
      outputIndex: utxo.vout,
      address: utxo.address,
      script: utxo.scriptPubKey,
      satoshis: utxo.satoshis,
    };
  };

  /** @type {ToCoreUtxos} */
  Dashsight.toCoreUtxos = function (insightUtxos) {
    let coreUtxos = insightUtxos.map(Dashsight.toCoreUtxo);

    return coreUtxos;
  };

  if ("undefined" !== typeof module) {
    module.exports.Dashsight = Dashsight;
    module.exports.create = Dashsight.create;
    module.exports.toCoreUtxo = Dashsight.toCoreUtxo;
    module.exports.toCoreUtxos = Dashsight.toCoreUtxos;
  }
})(("undefined" !== typeof module && module.exports) || window);
