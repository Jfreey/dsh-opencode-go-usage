# OpenCode Go 用量 / OpenCode Go Usage

两个地方看 OpenCode Go 计划的额度：5 小时窗口、本周、本月三个级别。

- **对话框底栏**：轮数左侧一个紧凑徽标 `Go [进度条] 5h 13%`，鼠标悬停 / 点击 / 聚焦
  展开三行明细（每个级别一条进度条、已用百分比、重置倒计时），面板里带手动刷新。
- **设置 → OpenCode Go**：三个卡片式进度条，打开页面只读缓存，需要手动刷新。

数据由 Host 进程带着你配置的 API 密钥向 `https://opencode.ai/zen/go/v1/usage`
读取（Go 订阅的官方用量接口），密钥不会进入页面，页面只收到百分比和重置时间。

## 安装

仓库本身就是可安装的 bundle（`package.json` 里声明了 `dsh.bundle`）：在 Harness 的
插件管理里指向本仓库目录或 GitHub 地址安装即可。安装后刷新页面，底栏出现 `Go` 徽标，
设置里出现「OpenCode Go」一节。

需要 DeepSeek Harness 0.2.x（`dsh.client` 与 `ctx.slots` / `ctx.locale` 契约）。

## 密钥从哪里来

按下面的顺序解析，不需要把密钥写进插件配置：

1. 插件行 `config.apiKey`（显式填写时优先）。
2. 凭据服务里的 `config.apiKeyEnv` 引用，默认 `OPENCODE_GO_API_KEY`——也就是
   「设置 → 模型」里为 `opencode-go` 保存的那把密钥。
3. 同名进程环境变量。

## 配置项

```yaml
- id: opencode-go-usage
  name: 'dsh-opencode-go-usage'
  config:
    apiKeyEnv: OPENCODE_GO_API_KEY   # 凭据引用名
    # apiKey: oc_sk_...              # 也可以直接写死，不推荐
    path: /dsh-opencode-go/usage     # Host 只读路由
    cacheSeconds: 60                 # 宿主缓存秒数，也是底栏的刷新周期

    dock: true          # 底栏徽标总开关
    bar: true           # 徽标里的进度条；关掉只剩 Go / 级别 / 百分比
    level: rolling      # 进度条默认级别：rolling(5h) | weekly | monthly
    rotate: false       # 级别轮换显示，默认关闭
    rotateSeconds: 5    # 轮换间隔（最小 2 秒），仅 rotate: true 时生效
```

`level` 也接受别名 `week`/`w`/`周` 与 `month`/`m`/`月`；无法识别时回落到 `rolling`。
轮换只作用于底栏徽标，展开面板时暂停，三行明细始终同时显示。

配置改动需要重载 Harness（重启应用或重新启用该 bundle）后生效。

## 刷新与缓存

| 场景 | 请求 | 行为 |
| --- | --- | --- |
| 底栏徽标 | `GET /dsh-opencode-go/usage` | 每 60 秒拉一次；宿主缓存未过期时直接返回缓存 |
| 展开面板「刷新」 | `GET …?refresh=1` | 跳过缓存，强制向上游查询 |
| 设置页打开 | `GET …?cache=1` | 有缓存就用缓存（哪怕过期），只有从未读过时才查上游 |
| 设置页「刷新」 | `GET …?refresh=1` | 强制查询 |

## 接口

`GET /dsh-opencode-go/usage`（`?refresh=1` 强制刷新，`?cache=1` 只读缓存）：

```json
{
  "ok": true,
  "fetchedAt": "2026-11-04T12:40:00.000Z",
  "credentialSource": "stored",
  "dock": true,
  "display": { "bar": true, "level": "rolling", "rotate": false, "rotateSeconds": 5 },
  "servedFromCache": true,
  "stale": false,
  "usage": {
    "rolling": { "status": "ok", "percent": 12.5, "resetsAt": "2026-11-04T17:33:21.000Z" },
    "weekly":  { "status": "ok", "percent": 4.1,  "resetsAt": "2026-11-09T00:00:00.000Z" },
    "monthly": { "status": "ok", "percent": 1.2,  "resetsAt": "2026-12-04T12:23:50.000Z" }
  }
}
```

失败时返回 `{ "ok": false, "error": { "code": "NO_KEY|UNAUTHORIZED|FORBIDDEN|TIMEOUT|NETWORK|UPSTREAM|SHAPE", "message": "…" } }`。

## 说明

- 只读、同源 GET 路由，返回内容不含密钥；未经过 Harness 的浏览器登录闸门，
  因为它只读且 Harness 默认只监听回环地址。若你把 Harness 暴露到局域网或隧道，
  这条路由也会随之可达。
- 额度百分比与重置时间以 opencode.ai 的返回为准；页面不推算套餐档位。
- 进度条沿用主题 token（`--dsw-alias-*`），圆角用 `--dsw-radius-*`，跟随明暗主题。
