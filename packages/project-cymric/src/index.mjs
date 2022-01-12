// Worker

export default {
  async fetch(request, env) {
    return await handleRequest(request, env);
  },
};

async function handleRequest(request, env) {
  let { searchParams } = new URL(request.url);
  let schedule = searchParams.get("schedule");

  let id = env.SCHEDULE.idFromName(schedule);
  let obj = env.SCHEDULE.get(id);
  let resp = await obj.fetch(request);

  return resp;
}

// Durable Object

export class Schedule {
  constructor(state, env) {
    this.state = state;
    // `blockConcurrencyWhile()` ensures no requests are delivered until
    // initialization completes.
    this.state.blockConcurrencyWhile(async () => {
      let stored = await this.state.storage.get("schedule");
      this.schedule = stored;
    });
  }

  // Handle HTTP requests from clients.
  async fetch(request) {
    // Apply requested action.
    let { pathname } = new URL(request.url);

    switch (pathname) {
      case "/saveSchedule":
        let schedule = await request.json();
        this.schedule = schedule;
        await this.state.storage.put("schedule", this.schedule);
        return new Response();
      case "/loadSchedule":
        break;
      default:
        return new Response("Not found", { status: 404 });
    }

    // Return `currentValue`. Note that `this.value` may have been
    // incremented or decremented by a concurrent request when we
    // yielded the event loop to `await` the `storage.put` above!
    // That's why we stored the counter value created by this
    // request in `currentValue` before we used `await`.
    return new Response(JSON.stringify(this.schedule));
  }
}
