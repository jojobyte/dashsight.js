(function (exports) {
  "use strict";

  let Ws = {};
  exports.DashSocket = Ws;
  exports.DashSightWs = Ws; // deprecated

  /**
   * @typedef WsOpts
   * @prop {String} [baseUrl] - (deprecated by dashsocketBaseUrl) ex: https://insight.dash.org
   * @prop {CookieStore} cookieStore - only needed for insight APIs hosted behind an AWS load balancer
   * @prop {Boolean} debug
   * @prop {Function} onClose
   * @prop {Function} onError
   * @prop {Function} onMessage
   * @prop {String} dashsocketBaseUrl - ex: https://insight.dash.org/socket.io
   */

  /**
   * @param {WsOpts} opts
   */
  Ws.create = function ({
    baseUrl,
    dashsocketBaseUrl,
    cookieStore = null,
    debug,
    onClose,
    onError,
    onMessage,
  }) {
    let wsc = {};

    let Eio3 = {};

    if (!dashsocketBaseUrl) {
      dashsocketBaseUrl = `${baseUrl}/socket.io`;
    }
    if (dashsocketBaseUrl.endsWith("/")) {
      dashsocketBaseUrl = dashsocketBaseUrl.slice(
        0,
        dashsocketBaseUrl.length - 1,
      );
    }

    // Get `sid` (session id) and ping/pong params
    Eio3.connect = async function () {
      let now = Date.now();
      let sidUrl = `${dashsocketBaseUrl}/?EIO=3&transport=polling&t=${now}`;

      let sidResp = await window.fetch(sidUrl, {
        mode: "cors",
        credentials: "include",
      });
      if (!sidResp.ok) {
        let err = new Error("bad response");
        // TODO make error type consistent between browser and node?
        err.response = sidResp;
        throw err;
      }

      // ex: `97:0{"sid":"xxxx",...}`
      let msg = await sidResp.text();
      let session = parseSession(msg);
      return session;
    };

    /**
     * @param {String} sid
     * @param {String} eventname
     * @returns "ok"
     * @throws
     */
    Eio3.subscribe = async function (sid, eventname) {
      let now = Date.now();
      let subUrl = `${dashsocketBaseUrl}/?EIO=3&transport=polling&t=${now}&sid=${sid}`;
      let body = stringifySub(eventname);

      let subResp = await window.fetch(subUrl, {
        method: "POST",
        mode: "cors",
        credentials: "include",
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
        },
        body: body,
      });
      if (!subResp.ok) {
        let err = new Error("bad response");
        // TODO make error type consistent between browser and node?
        err.response = subResp;
        throw err;
      }

      return await subResp.text();
    };

    /*
  Eio3.poll = async function (sid) {
    let now = Date.now();
    let pollUrl = `${dashsocketBaseUrl}/?EIO=3&transport=polling&t=${now}&sid=${sid}`;

    let cookies = await cookieStore.get(pollUrl);
    let pollResp = await request({
      //agent: httpAgent,
      method: "GET",
      url: pollUrl,
      headers: Object.assign(
        {
          Cookie: cookies,
        },
        defaultHeaders,
      ),
    });
    if (!pollResp.ok) {
      console.error(pollResp.toJSON());
      throw new Error("bad response");
    }
    await cookieStore.set(pollUrl, pollResp);

    return pollResp.body;
  };
  */

    /**
     * @param {String} sid - session id (associated with AWS ALB cookie)
     */
    Eio3.connectWs = async function (sid) {
      let dashsocketBaseUrlPart = dashsocketBaseUrl.slice(4); // trim leading 'http'
      let url = `ws${dashsocketBaseUrlPart}/?EIO=3&transport=websocket&sid=${sid}`;

      let ws = new WebSocket(url, []);

      let promise = new Promise(function (resolve) {
        ws.onopen = function () {
          ws.onopen = null;
          if (debug) {
            console.debug("=> Socket.io Hello ('2probe')");
          }
          ws.send("2probe");
        };

        ws.onerror = function (err) {
          ws.onerror = null;
          if (onError) {
            onError(err);
          } else {
            console.error("WebSocket Error:");
            console.error(err);
          }
        };

        ws.onmessage = function (ev) {
          let data = ev.data;
          ws.onmessage = null;
          if ("3probe" === data.toString()) {
            if (debug) {
              console.debug("<= Socket.io Welcome ('3probe')");
            }
            ws.send("5"); // no idea, but necessary
            if (debug) {
              console.debug("=> Socket.io ACK? ('5')");
            }
          } else {
            console.error("Unrecognized WebSocket Hello:");
            console.error(data.toString());
            // reject()
            // TODO surface to the user
            window.alert("unrecoverable error. check the console for details");
          }
          resolve(ws);
        };
      });

      return await promise;
    };

    /** @type import('ws')? */
    wsc._ws = null;

    wsc.init = async function () {
      let session = await Eio3.connect();
      if (debug) {
        console.debug("Socket.io Session:");
        console.debug(session);
        console.debug();
      }

      let sub = await Eio3.subscribe(session.sid, "inv");
      if (debug) {
        console.debug("Socket.io Subscription:");
        console.debug(sub);
        console.debug();
      }

      /*
    let poll = await Eio3.poll(session.sid);
    if (debug) {
      console.debug("Socket.io Confirm:");
      console.debug(poll);
      console.debug();
    }
    */

      let ws = await Eio3.connectWs(session.sid);
      wsc._ws = ws;
      ws._pingTimeout = null;

      setPing();
      ws.addEventListener("message", _onMessage);
      ws.onclose = _onClose;

      function setPing() {
        ws._pingTimeout = setTimeout(function () {
          //ws.ping(); // standard
          ws.send("2"); // socket.io
          if (debug) {
            console.debug("=> Socket.io Ping");
          }
        }, session.pingInterval);
      }

      /**
       * See https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/message_event
       * @typedef {Object} WsEvent
       * @prop {any} data
       */

      /**
       * @param {WsEvent} ev
       */
      function _onMessage(ev) {
        let msg = ev.data;
        if ("3" === msg) {
          if (debug) {
            console.debug("<= Socket.io Pong");
            console.debug();
          }
          setPing();
          return;
        }

        if ("42" !== msg.slice(0, 2)) {
          console.warn("Unknown message:");
          console.warn(msg);
          return;
        }

        /** @type {InsightPush} */
        let [evname, data] = JSON.parse(msg.slice(2));
        if (onMessage) {
          onMessage(evname, data);
        }
        switch (evname) {
          case "tx":
          /* falls through */
          case "txlock":
          /* falls through */
          case "block":
          /* falls through */
          default:
            // TODO put check function here
            if (debug) {
              console.debug(`Received '${evname}':`);
              console.debug(data);
              console.debug();
            }
        }
      }

      function _onClose() {
        ws.onclose = null;
        ws.removeEventListener("message", _onMessage);
        clearTimeout(ws._pingTimeout)
        if (debug) {
          console.debug("WebSocket Close");
        }
        if (onClose) {
          onClose();
        }
      }
    };

    wsc.close = function () {
      wsc._ws?.close();
    };

    return wsc;
  };

  /**
   * TODO share with node version
   * @param {String} msg
   * @returns {SocketIoHello}
   */
  function parseSession(msg) {
    let colonIndex = msg.indexOf(":");
    // 0 is CONNECT, which will always follow our first message
    let start = colonIndex + ":0".length;
    let len = parseInt(msg.slice(0, colonIndex), 10);
    let json = msg.slice(start, start + (len - 1));

    //console.log("Socket.io Connect:");
    //console.log(msg);
    //console.log(json);

    // @type {SocketIoHello}
    let session = JSON.parse(json);
    return session;
  }

  /**
   * TODO share with node version
   * @param {String} msg
   * @returns {String}
   */
  function stringifySub(eventname) {
    let sub = JSON.stringify(["subscribe", eventname]);
    // not really sure what this is, couldn't find documentation for it
    let typ = 422; // 4 = MESSAGE, 2 = EVENT, 2 = ???
    let msg = `${typ}${sub}`;
    let len = msg.length;
    let body = `${len}:${msg}`;
    return body;
  }

  /**
   * @callback Finder
   * @param {String} evname
   * @param {InsightSocketEventData} data
   */

  /**
   * @param {String} dashsocketBaseUrl
   * @param {Finder} find
   * @param {Partial<WsOpts>} [opts]
   */
  Ws.listen = async function (dashsocketBaseUrl, find, opts) {
    if ("https://insight.dash.org" === dashsocketBaseUrl) {
      dashsocketBaseUrl = "https://insight.dash.org/socket.io";
    }
    let ws;
    let p = new Promise(async function (resolve, reject) {
      //@ts-ignore
      ws = Ws.create(
        Object.assign({}, opts, {
          dashsocketBaseUrl: dashsocketBaseUrl,
          cookieStore: null,
          debug: opts?.debug,
          onClose: resolve,
          onError: reject,
          /** @type Finder */
          onMessage: async function (evname, data) {
            let result;
            try {
              result = await find(evname, data);
            } catch (e) {
              reject(e);
              return;
            }

            if (result) {
              resolve(result);
            }
          },
        }),
      );

      await ws.init().catch(reject);
    });
    let result = await p;
    //@ts-ignore
    ws.close();
    return result;
  };

  // TODO waitForVouts(baseUrl, [{ address, satoshis }])

  /**
   * @param {String} dashsocketBaseUrl
   * @param {String} addr
   * @param {Number} [amount]
   * @param {Number} [maxTxLockWait]
   * @param {WsOpts} [opts]
   * @returns {Promise<SocketPayment>}
   */
  Ws.waitForVout = async function (
    dashsocketBaseUrl,
    addr,
    amount = 0,
    maxTxLockWait = 3000,
    opts = {},
  ) {
    if ("https://insight.dash.org" === dashsocketBaseUrl) {
      dashsocketBaseUrl = "https://insight.dash.org/socket.io";
    }

    // Listen for Response
    /** @type SocketPayment */
    let mempoolTx;
    return await Ws.listen(dashsocketBaseUrl, findResponse, opts);

    /**
     * @param {String} evname
     * @param {InsightSocketEventData} data
     */
    function findResponse(evname, data) {
      if (!["tx", "txlock"].includes(evname)) {
        return;
      }

      let now = Date.now();
      if (mempoolTx?.timestamp) {
        // don't wait longer than 3s for a txlock
        if (now - mempoolTx.timestamp > maxTxLockWait) {
          return mempoolTx;
        }
      }

      let result;
      // TODO should fetch tx and match hotwallet as vin
      data.vout.some(function (vout) {
        if (!(addr in vout)) {
          return false;
        }

        let duffs = vout[addr];
        if (amount && duffs !== amount) {
          return false;
        }

        let newTx = {
          address: addr,
          timestamp: now,
          txid: data.txid,
          satoshis: duffs,
          txlock: data.txlock,
        };

        if ("txlock" !== evname) {
          if (!mempoolTx) {
            mempoolTx = newTx;
          }
          return false;
        }

        result = newTx;
        return true;
      });

      return result;
    }
  };
})(("undefined" !== typeof module && module.exports) || window);
