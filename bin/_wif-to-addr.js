"use strict";

let Pub = module.exports;

let Crypto = require("node:crypto");

let Base58Check = require("@root/base58check").Base58Check;
let RIPEMD160 = require("ripemd160");
let Secp256k1 = require("secp256k1");

let pubKeyHashVersion = "4c";
let b58c = Base58Check.create({
  pubKeyHashVersion: pubKeyHashVersion,
  privateKeyVersion: "cc",
});

/**
 * @param {String} wif
 * @returns {Promise<String>}
 */
Pub.wifToAddr = async function (wif) {
  let parts = await b58c.verify(wif);
  let privBuf = Buffer.from(parts.privateKey, "hex");
  let valid = Secp256k1.privateKeyVerify(privBuf);
  if (!valid) {
    throw new Error(`can't convert invalid wif to private key`);
  }
  let pubBuf = Secp256k1.publicKeyCreate(privBuf);
  let addr = await b58c.encode({
    version: pubKeyHashVersion,
    pubKeyHash: Pub._hashPubkey(pubBuf),
  });
  return addr;
};

/**
 * @param {Uint8Array|Buffer} buf
 * @returns {String}
 */
Pub._hashPubkey = function (buf) {
  let sha = Crypto.createHash("sha256").update(buf).digest();
  let hash = new RIPEMD160().update(sha).digest();
  return hash.toString("hex");
};
