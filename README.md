# pm2-perfmonitor

A pm2 module for performance monitor

# Features

- Automatically detect zombie processes and restart it.

# Install

```bash
$ pm2 install pm2-perfmonitor
```

# Configure

|            Property             | Default Value | Description                |
| :-----------------------------: | :-----------: | :------------------------- |
|            `enabled`            |    `true`     | 是否启用该模块             |
|          `excludeApps`          |       -       | 指定需要排除守护的应用名   |
|          `includeApps`          |       -       | 指定需要守护的应用名       |
|        `workerInterval`         |    `60000`    | 定时任务执行时间间隔（ms） |
|        `zombieDetection`        |    `true`     | 是否开启僵尸进程守护       |
|         `zombieMaxHits`         |     `10`      | 僵尸状态最大出现次数       |
| `autoRestartWhenZombieDetected` |    `true`     | 是否对僵尸进程自动重启     |

# How to set these values ?

After having installed the module you have to type : `pm2 set pm2-perfmonitor:<param> <value>`

**e.g:**

- `pm2 set pm2-perfmonitor:includeApps myNuxtApp1, myNextApp2` （只对应用名为：myNuxtApp1 和 myNextApp2 的应用进行检测）
- `pm2 set pm2-perfmonitor:workerInterval 120000` （2分钟检测一次）
