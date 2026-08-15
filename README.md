# pm2-perfmonitor

A pm2 module for **zombie process** and **CPU overload** detection.

# Features

- Automatically detect **zombie** processes and restart it.
- [Added in v2.7+] Notify the zombie process (`cpu-profile-start` / `cpu-profile-stop` messages) to collect diagnostic data (CPU profile + active handles dump) before restart.
- Monitor the number of zombie process restarts (`pm2 monit`).
- [Added in v2] Support **CPU overload** protection (automatic restart + `perf` collection).
- [Added in v2] Monitor the number of CPU Overload process restarts (`pm2 monit`).

# Installation

```bash
# install or update (defaults to latest)
$ pm2 install pm2-perfmonitor

# install or update to a specific version
$ pm2 install pm2-perfmonitor@2.7.2

# install or update to the latest version matching a range
$ pm2 install pm2-perfmonitor@~2.7

# uninstall
$ pm2 uninstall pm2-perfmonitor
```

Version suffix syntax (npm semver, so ranges also apply when updating):

- `@2.7.2` — an exact version
- `@~2.7` — the latest `2.7.x` patch release (other ranges like `@^2.7.0` work too)
- no suffix — the latest version (default)

> NOTE: the command is `pm2 install` NOT `npm install`

# Configure

|            Property             |      Defaults       |                                               Description                                               |  Supported   |
| :-----------------------------: | :-----------------: | :-----------------------------------------------------------------------------------------------------: | :----------: |
|            `enabled`            |       `true`        |                                  Specify whether to enable this module                                  | v1+ |
|          `excludeApps`          |          -          |                Specify the application name that needs to be excluded from guardianship                 | v1+ |
|          `includeApps`          |          -          |                          Specify the application name that needs to be guarded                          | v1+ |
|        `workerInterval`         |       `60000`       |                                   Timed task execution interval (ms)                                    | v1+ |
|        `zombieDetection`        |       `true`        |                           Specify whether to enable zombie process protection                           | v1+ |
|         `zombieMaxHits`         |        `10`         |                        Specify the maximum occurrence frequency of zombie status                        | v1+ |
| `autoRestartWhenZombieDetected` |       `true`        |                        Specify whether to automatically restart zombie processes                        | v1+ |
|       `zombieMaxRestarts`       |         `0`         |      Specify the maximum number of restarts for zombie processes (set to `0` to indicate no limit)      | v1+ |
|     `cpuOverloadDetection`      |       `false`       |                            Specify whether to enable CPU overload protection                            |      v2      |
|     `cpuOverloadThreshold`      |        `99`         |                           Specify the threshold for determining CPU overload                            |      v2      |
|      `cpuOverloadMaxHits`       |         `5`         | Maximum number of consecutive occurrences of CPU overload allowed (automatically restarts when reached) |      v2      |
| `enableNodeInspectorOnCpuOverload` |       `false`       |                    Specify whether to enable `node:inspector` performance collection for CPU overload                   |      v2      |
| `enableNodeInspectorOnZombie` |       `false`        |           Specify whether to enable `node:inspector` diagnostic collection before zombie process restart (CPU profile + active handles dump)            |      v2.7+   |
|  `nodeInspectorSampleDuration`  |        `10`         |                  Specify the performance collection duration (s) for `node:inspector`                   |      v2      |
|     `enablePerfCollection`      |       `false`       |                         Specify whether to enable `perf` performance collection                         |      v2      |
|    `perfReportGenerationDir`    | `/var/log/pm2/perf` |                   Specify the directory for generating performance reports for `perf`                   |      v2      |
|         `flamegraphDir`         |  `/opt/FlameGraph`  |                    Specify the directory for `flamegraph` flame map generation tool                     |      v2      |
|      `perfSampleDuration`       |        `10`         |                              Specify the sampling duration (s) for `perf`                               |      v2      |
|      `perfSampleFrequency`      |        `99`         |                             Specify the sampling frequency (Hz) for `perf`                              |      v2      |


> Please see the details for all configurable options：[Default Options](./lib//defaults.js)

# Zombie Diagnostic Output

When `enableNodeInspectorOnZombie` is enabled, the module sends `cpu-profile-start` / `cpu-profile-stop` messages to the zombie process right before restarting it. Collecting and dumping the diagnostic data (CPU profile + active handles) is up to the app side — see the example: [Zombie Diagnostic Output Example](./examples/zombie-diagnostic-output.md)

# How to set these values ?

After having installed the module you have to type : `pm2 set pm2-perfmonitor:<param> <value>`

**e.g:**

- `pm2 set pm2-perfmonitor:includeApps myNuxtApp1, myNextApp2` （Only detect applications named `myNuxtApp1` and `myNextApp2`）
- `pm2 set pm2-perfmonitor:workerInterval 120000` （Check every `2` minutes）
- `pm2 set pm2-perfmonitor:cpuOverloadDetection true`（enable **CPU overload** protection）
- `pm2 set pm2-perfmonitor:zombieProcessDetectionStrategy zombie-state-and-zero-cpu`（Set the strategy for detecting zombie processes to: system process status is **Z** and CPU usage is consistently **0%**）
