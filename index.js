"use strict";

module.exports = require("./lib/insight.js");

/**
 * @typedef {Object} InsightUtxo
 * @property {String} address
 * @property {String} txid
 * @property {Number} vout
 * @property {String} scriptPubKey
 * @property {Number} amount
 * @property {Number} satoshis
 * @property {Number} height
 * @property {Number} confirmations
 */

/**
 * @typedef {[InsightSocketEventName,InsightSocketEventData]} InsightPush
 */

/**
 * @typedef {String} InsightSocketEventName
 */

/**
 * @typedef {Object} InstantBalance
 * @property {String} addrStr
 * @property {Number} balance
 * @property {Number} balanceSat
 * @property {Number} _utxoCount
 * @property {Array<Number>} _utxoAmounts
 *
 * @example
 *   {
 *     addrStr: 'Xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
 *     balance: 10.01,
 *     balanceSat: 1001000000,
 *   }
 */

/**
 * @typedef InsightBalance
 * @property {String} addrStr
 * @property {Number} balance
 * @property {Number} balanceSat
 * @property {Number} totalReceived
 * @property {Number} totalReceivedSat
 * @property {Number} totalSent
 * @property {Number} totalSentSat
 * @property {Number} unconfirmedBalance
 * @property {Number} unconfirmedBalanceSat
 * @property {Number} unconfirmedAppearances
 * @property {Number} txAppearances
 */

/**
 * @typedef {Object} InsightSocketEventData
 * @property {String} txid - hex
 * @property {Number} valueOut - float
 * @property {Array<Record<Base58CheckAddr, Number>>} vout - addr and duffs
 * @property {Boolean} isRBF
 * @property {Boolean} txlock
 *
 * @example
 *   {
 *     txid: 'd2cc7cb8e8d2149f8c4475aee6797b4732eab020f8eb24e8912d0054787b0966',
 *     valueOut: 0.00099775,
 *     vout: [
 *       { XcacUoyPYLokA1fZjc9ZfpV7hvALrDrERA: 40000 },
 *       { Xo6M4MxnHWzrksja6JnFjHuSa35SMLQ9J3: 59775 }
 *     ],
 *     isRBF: false,
 *     txlock: true
 *   }
 */

/**
 * @typedef {Object} InsightTxResponse
 * @property {Number} pagesTotal
 * @property {Array<InsightTx>} txs
 */

/**
 * @typedef {Object} InsightTx
 * @property {String} txid
 * @property {Number} confirmations
 * @property {Number} time
 * @property {Boolean} txlock
 * @property {Number} version
 * @property {Array<InsightTxVin>} vin
 * @property {Array<InsightTxVout>} vout
 * @property {Number} fees
 */

/**
 * @typedef {Object} InsightTxVin
 * @property {String} addr - base58check-encoded address
 * @property {String} txid - the input's original output transaction id (hex)
 * @property {Number} value - float value in DASH
 * @property {Number} valueSat - integer value in DUFFs
 * @property {Number} vout - the input's original outputIndex
 */

/**
 * @typedef {Object} InsightTxVout
 * @property {String} value - string value in DASH
 * @property {Object} scriptPubKey
 * @property {Array<String>} scriptPubKey.addresses
 * @property {String} scriptPubKey.hex
 * @property {String} spentTxId - not a UTXO, was spend in the indicated transaction
 */

//
//
// Core vs Insight Conversion
//
//

/**
 * @typedef {Object} CoreUtxo
 * @property {String} txId
 * @property {Number} outputIndex
 * @property {String} address
 * @property {String} script
 * @property {Number} satoshis
 */

//
//
// Socket.IO nonsense
//
//

/**
 * @typedef {Object} SocketIoConnect
 * @property {String} sid
 * @property {Array<String>} upgrades
 * @property {Number} pingInterval
 * @property {Number} pingTimeout
 */

/**
 * @typedef {Object} SocketPayment
 * @property {String} address - base58check pay-to address
 * @property {Number} satoshis - duffs, duh
 * @property {Number} timestamp - in milliseconds since epoch
 * @property {String} txid - in hex
 * @property {Boolean} txlock
 */

//
//
// AWS LB Cookie Nonsense
//
//

/**
 * @typedef {Object} CookieStore
 * @property {CookieStoreSet} set
 * @property {CookieStoreGet} get
 */

/**
 * @typedef {Function} CookieStoreSet
 * @param {String} url
 * @param {import('http').IncomingMessage} resp
 * @returns {Promise<void>}
 */

/**
 * @typedef {Function} CookieStoreGet
 * @param {String} url
 * @returns {Promise<String>}
 */

//
//
// Helper Types
//
//

/**
 * @typedef {String} Base58CheckAddr
 */
