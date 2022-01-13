// Worker

export default {
  async fetch(request, env) {
    return await handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  let url = new URL(request.url);
  let path = url.pathname.slice(1).split("/");

  if (!path[0]) {
    // Serve our HTML at the root path.
    return new Response(HTML, {
      headers: { "Content-Type": "text/html;charset=UTF-8" },
    });
  }

  switch (path[0]) {
    case "api":
      // This is a request for `/api/...`, call the API handler.
      return handleApiRequest(path.slice(1), request, env);

    default:
      return new Response("Not found", { status: 404 });
  }

  // let { searchParams } = new URL(request.url);
  // let schedule = searchParams.get("schedule");

  // let id = env.SCHEDULE.idFromName(schedule);
  // let obj = env.SCHEDULE.get(id);
  // let resp = await obj.fetch(request);

  // return resp;
}

async function handleApiRequest(path, request, env) {
  switch (path[0]) {
    case "room": {
      if (!path[1]) {
        if (request.method == "POST") {
          let id = env.SCHEDULE.newUniqueId();
          return new Response(id.toString(), {
            headers: { "Access-Control-Allow-Origin": "*" },
          });
        } else {
          return new Response("Method not allowed", { status: 405 });
        }
      }

      let name = path[1];
      let id;
      if (name.match(/^[0-9a-f]{64}$/)) {
        id = env.SCHEDULE.idFromString(name);
      } else {
        return new Response("Name too long", { status: 404 });
      }

      let roomObject = env.SCHEDULE.get(id);

      let newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");

      return roomObject.fetch(newUrl, request);
    }

    default:
      return new Response("Not found", { status: 404 });
  }
}

// Durable Object

export class Schedule {
  constructor(controller, env) {
    this.storage = controller.storage;
    this.env = env;
    this.sessions = [];

    // We keep track of the last-seen message's timestamp just so that we can assign monotonically
    // increasing timestamps even if multiple messages arrive simultaneously (see below). There's
    // no need to store this to disk since we assume if the object is destroyed and recreated, much
    // more than a millisecond will have gone by.
    // this.lastTimestamp = 0;
  }

  // Handle HTTP requests from clients.
  async fetch(request) {
    // // Apply requested action.
    // let { pathname } = new URL(request.url);

    // switch (pathname) {
    //   case "/saveSchedule":
    //     let schedule = await request.json();
    //     this.schedule = schedule;
    //     await this.state.storage.put("schedule", this.schedule);
    //     return new Response();
    //   case "/loadSchedule":
    //     break;
    //   default:
    //     return new Response("Not found", { status: 404 });
    // }

    // // Return `currentValue`. Note that `this.value` may have been
    // // incremented or decremented by a concurrent request when we
    // // yielded the event loop to `await` the `storage.put` above!
    // // That's why we stored the counter value created by this
    // // request in `currentValue` before we used `await`.
    // return new Response(JSON.stringify(this.schedule), {
    //   headers: {
    //     "content-type": "application/json;charset=UTF-8",
    //   },
    // });

    let url = new URL(request.url);

    switch (url.pathname) {
      case "/websocket": {
        if (request.headers.get("Upgrade") != "websocket") {
          return new Response("expected websocket", { status: 400 });
        }

        let ip = request.headers.get("CF-Connecting-IP");

        let pair = new WebSocketPair();

        await this.handleSession(pair[1], ip);

        return new Response(null, { status: 101, webSocket: pair[0] });
      }

      default:
        return new Response("Not found", { status: 404 });
    }
  }

  async handleSession(webSocket, ip) {
    webSocket.accept();

    // let limiterId = this.env.limiters.idFromName(ip);
    // let limiter = new RateLimiterClient(
    //   () => this.env.limiters.get(limiterId),
    //   (err) => webSocket.close(1011, err.stack)
    // );

    let session = { webSocket, blockedMessages: [] };
    this.sessions.push(session);

    this.sessions.forEach((otherSession) => {
      if (otherSession.name) {
        session.blockedMessages.push(
          JSON.stringify({ joined: otherSession.name })
        );
      }
    });

    let schedule = await this.storage.get("schedule");
    session.blockedMessages.push(
      JSON.stringify({ schedule: JSON.parse(schedule) })
    );

    let receivedUserInfo = false;
    webSocket.addEventListener("message", async (msg) => {
      try {
        if (session.quit) {
          webSocket.close(1011, "WebSocket broken.");
          return;
        }

        // if (!limiter.checkLimit()) {
        //   webSocket.send(
        //     JSON.stringify({
        //       error: "Your IP is being rate-limited, please try again later.",
        //     })
        //   );
        //   return;
        // }

        let data = JSON.parse(msg.data);

        if (!receivedUserInfo) {
          session.name = "" + (data.name || "anonymous");

          if (session.name.length > 32) {
            webSocket.send(JSON.stringify({ error: "Name too long." }));
            webSocket.close(1009, "Name too long.");
            return;
          }

          session.blockedMessages.forEach((queued) => {
            webSocket.send(queued);
          });
          delete session.blockedMessages;

          this.broadcast({ joined: session.name });

          webSocket.send(JSON.stringify({ ready: true }));

          receivedUserInfo = true;

          return;
        }

        // Construct sanitized message for storage and broadcast.
        data = {
          // name: session.name,
          schedule: data.schedule,
        };

        // Add timestamp. Here's where this.lastTimestamp comes in -- if we receive a bunch of
        // messages at the same time (or if the clock somehow goes backwards????), we'll assign
        // them sequential timestamps, so at least the ordering is maintained.
        // data.timestamp = Math.max(Date.now(), this.lastTimestamp + 1);
        // this.lastTimestamp = data.timestamp;

        let dataStr = JSON.stringify(data);
        this.broadcast(dataStr);

        // Save message.
        // let key = new Date(data.timestamp).toISOString();
        await this.storage.put("schedule", dataStr);
      } catch (err) {
        console.error(err);
      }
    });

    let closeOrErrorHandler = (evt) => {
      session.quit = true;
      this.sessions = this.sessions.filter((member) => member !== session);
      if (session.name) {
        this.broadcast({ quit: session.name });
      }
    };
    webSocket.addEventListener("close", closeOrErrorHandler);
    webSocket.addEventListener("error", closeOrErrorHandler);
  }

  broadcast(message) {
    if (typeof message !== "string") {
      message = JSON.stringify(message);
    }

    let quitters = [];
    this.sessions = this.sessions.filter((session) => {
      if (session.name) {
        try {
          session.webSocket.send(message);
          return true;
        } catch (err) {
          session.quit = true;
          quitters.push(session);
          return false;
        }
      } else {
        session.blockedMessages.push(message);
        return true;
      }
    });

    quitters.forEach((quitter) => {
      if (quitter.name) {
        this.broadcast({ quit: quitter.name });
      }
    });
  }
}
