(function (exports) {
  "use strict";

  //@ts-ignore
  // provide a standards-compliant user-agent
  let urequest = exports.urequest || require("@root/request");

  /**
   * @param {Object} opts
   * @param {Object.<String,any>} [opts.form]
   * @param {String} [opts.body]
   * @param {Boolean | String} [opts.json]
   * @param {String} [opts.method]
   * @param {String} opts.url
   * @param {Object.<String, String|Array<String>>} opts.headers
   */
  async function dashrequest(opts) {
    let resp = await urequest(opts);
    if (resp.ok) {
      return resp;
    }

    let err = new Error(
      `http request was ${resp.statusCode}, not ok. See err.response for details.`,
    );
    //@ts-ignore
    err.response = resp.toJSON();
    throw err;
  }

  exports.__dashsight_request = dashrequest;

  if ("undefined" !== typeof module) {
    module.exports = dashrequest;
  }
})(("undefined" !== typeof module && module.exports) || window);
