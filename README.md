# pm2-perfmonitor

A pm2 module for performance monitor.

# Features

- Automatically detect **zombie** processes and restart it.
- Monitor the number of zombie process restarts (pm2 monit).

# Installation

```bash
$ pm2 install pm2-perfmonitor
```

> NOTE: the command is `pm2 install` NOT `npm install`

# Configure

|            Property             | Default Value |                                     Description                                      |
| :-----------------------------: | :-----------: | :----------------------------------------------------------------------------------: |
|            `enabled`            |    `true`     |                        Specify whether to enable this module                         |
|          `excludeApps`          |       -       |       Specify the application name that needs to be excluded from guardianship       |
|          `includeApps`          |       -       |                Specify the application name that needs to be guarded                 |
|        `workerInterval`         |    `60000`    |                          Timed task execution interval (ms)                          |
|        `zombieDetection`        |    `true`     |                 Specify whether to enable zombie process protection                  |
|         `zombieMaxHits`         |     `10`      |              Specify the maximum occurrence frequency of zombie status               |
| `autoRestartWhenZombieDetected` |    `true`     |              Specify whether to automatically restart zombie processes               |
|       `zombieMaxRestarts`       |      `0`      | The maximum number of zombie process restarts can be set to `0` to indicate no limit |

# How to set these values ?

After having installed the module you have to type : `pm2 set pm2-perfmonitor:<param> <value>`

**e.g:**

- `pm2 set pm2-perfmonitor:includeApps myNuxtApp1, myNextApp2` （Only detect applications named `myNuxtApp1` and `myNextApp2`）
- `pm2 set pm2-perfmonitor:workerInterval 120000` （Check every `2` minutes）
