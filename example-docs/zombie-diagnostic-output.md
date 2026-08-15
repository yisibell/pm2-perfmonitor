# Zombie Diagnostic Output (Example)

> The module itself does **not** generate these files — it only sends messages to the target
> app process. Collecting and dumping the diagnostic data is up to the app side.
> Everything below is an **example** of what an app can do with those messages.

## How it works

When `enableNodeInspectorOnZombie` is enabled and a zombie process is detected, the module
sends the following messages to the app process right before restarting it:

|            Event            |                    Meaning                     |
| :-------------------------: | :--------------------------------------------: |
| `pm2-perfmonitor:cpu-profile-start` | start sampling (`node:inspector` CPU profile + active handles snapshot) |
| `pm2-perfmonitor:cpu-profile-stop`  | stop sampling and dump the collected data to files |

The app receives them via `process.on('message', ...)`:

```js
process.on('message', (msg) => {
  const event = msg?.data?.event

  if (event === 'pm2-perfmonitor:cpu-profile-start') {
    // start CPU profiling (node:inspector) and snapshot active handles
  }

  if (event === 'pm2-perfmonitor:cpu-profile-stop') {
    // stop profiling, dump the files below, then release resources
  }
})
```

A complete runnable example app that implements this listener: [../example-apps/diagnostic-server.mjs](../example-apps/diagnostic-server.mjs) (`pm2 start ecosystem.dev.config.cjs` to run it together with the module).

## Example output

In this example, the app dumps the following files when it receives
`pm2-perfmonitor:cpu-profile-stop`:

| File | Path | Description |
|------|------|-------------|
| Active Resources | `/var/log/pm2/active-resources.{pid}.{timestamp}.json` | Active handles (sockets, timers, servers) and requests — **directly shows which backend service is stuck** |
| CPU Profile | `/var/log/pm2/cpu-profile.{pid}.{timestamp}.cpuprofile` | V8 CPU profile — open with Chrome DevTools (`chrome://inspect`) for analysis |

**`active-resources.json` example:**

```json
{
  "pid": 15460,
  "timestamp": "2026-08-12T10:14:03.242Z",
  "uptime": "8372.50 s",
  "memory": { "rss": "150.25 MB", "heapTotal": "80.00 MB", "heapUsed": "50.12 MB", "external": "1.00 MB" },
  "handleCount": 5,
  "requestCount": 1,
  "handles": [
    { "type": "Server", "address": { "port": 3390 } },
    { "type": "Socket", "remoteAddress": "10.0.1.23", "remotePort": 80, "readyState": "open", "bytesRead": 0, "bytesWritten": 512 },
    { "type": "Socket", "remoteAddress": "10.0.1.24", "remotePort": 6379, "readyState": "open", "bytesRead": 1234 },
    { "type": "Socket", "remoteAddress": "10.0.1.23", "remotePort": 80, "readyState": "opening" }
  ],
  "requests": [
    { "type": "TCPConnectWrap" }
  ]
}
```

- `bytesWritten > 0 && bytesRead === 0` → request sent but no response received (backend hang)
- `readyState: "opening"` + `TCPConnectWrap` → TCP handshake stuck (backend unreachable)
- `readyState: "open"` + `bytesRead > 0` → connection is alive and responsive (normal)
- Combine `remoteAddress:remotePort` with server-side access logs to identify which specific API endpoint is stuck.
