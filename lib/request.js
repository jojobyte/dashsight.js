"use strict";

//@ts-ignore
let pkg = require("../package.json");

//@ts-ignore
// provide a standards-compliant user-agent
let _request = require("@root/request").defaults({
  userAgent: `${pkg.name}/${pkg.version}`,
});

/**
 * @param {import('@root/request').RequestOptions} opts
 */
module.exports = async function request(opts) {
  let resp = await _request(opts);
  if (resp.ok) {
    return resp;
  }

  let err = new Error(
    `http request was ${resp.statusCode}, not ok. See err.response for details.`,
  );
  //@ts-ignore
  err.response = resp.toJSON();
  throw err;
};
