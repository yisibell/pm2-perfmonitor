# pm2-perfmonitor

A pm2 module for **zombie process** and **CPU overload** detection.

# Features

- Automatically detect **zombie** processes and restart it.
- Monitor the number of zombie process restarts (`pm2 monit`).
- [Added in v2] Support **CPU overload** protection (automatic restart + `perf` collection).
- [Added in v2] Monitor the number of CPU Overload process restarts (`pm2 monit`).

# Installation

```bash
# install or update
$ pm2 install pm2-perfmonitor

# uninstall
$ pm2 uninstall pm2-perfmonitor
```

> NOTE: the command is `pm2 install` NOT `npm install`

# Configure

|            Property             |      Defaults       |                                               Description                                               |  Supported   |
| :-----------------------------: | :-----------------: | :-----------------------------------------------------------------------------------------------------: | :----------: |
|            `enabled`            |       `true`        |                                  Specify whether to enable this module                                  | v1 and above |
|          `excludeApps`          |          -          |                Specify the application name that needs to be excluded from guardianship                 | v1 and above |
|          `includeApps`          |          -          |                          Specify the application name that needs to be guarded                          | v1 and above |
|        `workerInterval`         |       `60000`       |                                   Timed task execution interval (ms)                                    | v1 and above |
|        `zombieDetection`        |       `true`        |                           Specify whether to enable zombie process protection                           | v1 and above |
|         `zombieMaxHits`         |        `10`         |                        Specify the maximum occurrence frequency of zombie status                        | v1 and above |
| `autoRestartWhenZombieDetected` |       `true`        |                        Specify whether to automatically restart zombie processes                        | v1 and above |
|       `zombieMaxRestarts`       |         `0`         |      Specify the maximum number of restarts for zombie processes (set to `0` to indicate no limit)      | v1 and above |
|     `cpuOverloadDetection`      |       `false`       |                            Specify whether to enable CPU overload protection                            |      v2      |
|     `cpuOverloadThreshold`      |        `99`         |                           Specify the threshold for determining CPU overload                            |      v2      |
|      `cpuOverloadMaxHits`       |         `5`         | Maximum number of consecutive occurrences of CPU overload allowed (automatically restarts when reached) |      v2      |
| `enableNodeInspectorCollection` |       `false`       |                    Specify whether to enable `node:inspector` performance collection                    |      v2      |
|  `nodeInspectorSampleDuration`  |        `10`         |                  Specify the performance collection duration (s) for `node:inspector`                   |      v2      |
|     `enablePerfCollection`      |       `false`       |                         Specify whether to enable `perf` performance collection                         |      v2      |
|    `perfReportGenerationDir`    | `/var/log/pm2/perf` |                   Specify the directory for generating performance reports for `perf`                   |      v2      |
|         `flamegraphDir`         |  `/opt/FlameGraph`  |                    Specify the directory for `flamegraph` flame map generation tool                     |      v2      |
|      `perfSampleDuration`       |        `10`         |                              Specify the sampling duration (s) for `perf`                               |      v2      |
|      `perfSampleFrequency`      |        `99`         |                             Specify the sampling frequency (Hz) for `perf`                              |      v2      |


> Please see the details for all configurable options：[Default Options](./lib//defaults.js)

# How to set these values ?

After having installed the module you have to type : `pm2 set pm2-perfmonitor:<param> <value>`

**e.g:**

- `pm2 set pm2-perfmonitor:includeApps myNuxtApp1, myNextApp2` （Only detect applications named `myNuxtApp1` and `myNextApp2`）
- `pm2 set pm2-perfmonitor:workerInterval 120000` （Check every `2` minutes）
- `pm2 set pm2-perfmonitor:cpuOverloadDetection true`（enable **CPU overload** protection）
- `pm2 set pm2-perfmonitor:zombieProcessDetectionStrategy zombie-state-and-zero-cpu`（Set the strategy for detecting zombie processes to: system process status is **Z** and CPU usage is consistently **0%**）
