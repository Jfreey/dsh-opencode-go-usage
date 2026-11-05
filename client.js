/**
 * Client half of the OpenCode Go usage bundle.
 *
 * Two surfaces share one cached reading from the Host route in `index.js`:
 * - a compact pill in the composer dock, left of the Turn-count pill, which
 *   opens a panel with all three allowances on hover, click or focus;
 * - a Settings page that never re-queries on open and refreshes only on demand.
 *
 * Neither surface sees the API key: they receive percentages and reset times.
 */
window.__ModuleLoader__.load({
  id: 'dsh-opencode-go-usage',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')
    const h = React.createElement

    const NS = 'opencode-go-usage'
    const ENDPOINT = '/dsh-opencode-go/usage'
    const POLL_MS = 60000
    const PANEL_WIDTH = 320

    const zh = {
      nav: 'OpenCode Go',
      title: 'OpenCode Go 用量',
      subtitle: 'Go 计划额度，来自 opencode.ai 的读数',
      rolling: '5 小时窗口',
      shortRolling: '5h',
      weekly: '本周额度',
      shortWeekly: '周',
      monthly: '本月额度',
      shortMonthly: '月',
      limited: '已限流',
      refresh: '刷新',
      refreshing: '刷新中…',
      loading: '正在读取用量…',
      resetPre: '',
      resetPost: ' 后重置',
      resetting: '即将重置',
      unitD: '天',
      unitH: '小时',
      unitM: '分钟',
      updated: '更新于',
      autoRefresh: '每 60 秒自动刷新',
      levelLabel: '级别',
      showBar: '进度条',
      rotateLabel: '滚动',
      manualRefreshNote: '打开此页不重新查询，需要时手动刷新',
      openConsole: '打开 Console',
      errorTitle: '读不到用量',
      retry: '重试',
      err_NO_KEY: '没有找到 OpenCode Go 的 API 密钥。请到「设置 → 模型」保存密钥，或在插件配置里填写 apiKey。',
      err_UNAUTHORIZED: '密钥无效或已过期。请到「设置 → 模型」重新保存。',
      err_FORBIDDEN: '这个密钥没有 OpenCode Go 订阅，或没有读取用量的权限。',
      err_TIMEOUT: 'opencode.ai 在 15 秒内没有响应，请稍后重试。',
      err_NETWORK: '无法连接 opencode.ai，请检查网络或代理。',
      err_UPSTREAM: 'opencode.ai 暂时不可用，请稍后重试。',
      err_SHAPE: 'opencode.ai 返回了无法识别的内容。',
      err_INTERNAL: '读取用量时发生了内部错误。',
      err_UNKNOWN: '读取用量时发生了未知错误。',
      integerNote: '接口只返回整数百分比，和 Console 可能差 1%。',
    }

    const en = {
      nav: 'OpenCode Go',
      title: 'OpenCode Go usage',
      subtitle: 'Go plan allowance, read from opencode.ai',
      rolling: '5-hour window',
      shortRolling: '5h',
      weekly: 'This week',
      shortWeekly: 'wk',
      monthly: 'This month',
      shortMonthly: 'mo',
      limited: 'Limited',
      refresh: 'Refresh',
      refreshing: 'Refreshing…',
      loading: 'Reading usage…',
      resetPre: 'resets in ',
      resetPost: '',
      resetting: 'resetting now',
      unitD: 'd',
      unitH: 'h',
      unitM: 'm',
      updated: 'Updated',
      autoRefresh: 'Refreshes every 60s',
      levelLabel: 'Level',
      showBar: 'Bar',
      rotateLabel: 'Rotate',
      manualRefreshNote: 'Opening this page reuses the cache — refresh when you need a new reading',
      openConsole: 'Open Console',
      errorTitle: "Couldn't read usage",
      retry: 'Retry',
      err_NO_KEY: 'No OpenCode Go API key was found. Save one in Settings → Models, or set apiKey in the plugin config.',
      err_UNAUTHORIZED: 'The API key is invalid or expired. Save a new one in Settings → Models.',
      err_FORBIDDEN: 'This key has no OpenCode Go subscription, or cannot read usage.',
      err_TIMEOUT: 'opencode.ai did not answer within 15 seconds. Try again shortly.',
      err_NETWORK: 'Could not reach opencode.ai. Check the network or proxy.',
      err_UPSTREAM: 'opencode.ai is temporarily unavailable. Try again later.',
      err_SHAPE: 'opencode.ai returned an unrecognized payload.',
      err_INTERNAL: 'The usage reader failed unexpectedly.',
      err_UNKNOWN: 'An unknown error occurred while reading usage.',
      integerNote: 'The API reports whole percents; Console may differ by 1%.',
    }

    const KNOWN_CODES = new Set([
      'NO_KEY',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'TIMEOUT',
      'NETWORK',
      'UPSTREAM',
      'SHAPE',
      'INTERNAL',
    ])

    const CSS = `
.og-go{--og-radius:999px;--og-track:var(--dsw-alias-border-l1);--og-fill:var(--dsw-alias-brand-primary);--og-warn:var(--dsw-alias-state-warn-primary);--og-error:var(--dsw-alias-state-error-primary)}
.og-go-pill{box-sizing:border-box;display:inline-flex;align-items:center;gap:6px;padding:1px 8px;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer}
.og-go-pill:hover,.og-go-pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}
.og-go-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.og-go-pill__tag{font-weight:500}
.og-go-pill__track{position:relative;width:36px;height:4px;border-radius:var(--og-radius);background:var(--og-track);overflow:hidden}
.og-go-pill__fill{position:absolute;inset:0 auto 0 0;border-radius:var(--og-radius);transition:width .3s ease}
.og-go-pill__level{font-weight:500;color:var(--dsw-alias-label-tertiary)}
.og-go-pill__value{font-variant-numeric:tabular-nums}
.og-go-pill__value[data-limited=true]{color:var(--og-error)}
.og-go-panel{position:fixed;z-index:1100;box-sizing:border-box;padding:14px 16px 12px;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu,var(--dsw-alias-bg-overlay));color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;box-shadow:var(--dsw-elevation-prominent,0 8px 24px rgba(0,0,0,.18));border:1px solid var(--dsw-alias-border-l1);cursor:default}
.og-go-panel__head{display:flex;align-items:baseline;justify-content:space-between;gap:16px;color:var(--dsw-alias-label-primary);font-weight:500;font-size:13px;line-height:20px}
.og-go-panel__meta{font-weight:400;font-size:11px;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap}
.og-go-panel__rule{margin:8px 0 10px;border-top:.5px solid var(--dsw-alias-border-l2)}
.og-go-row+.og-go-row{margin-top:12px}
.og-go-row__top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.og-go-row__label{color:var(--dsw-alias-label-secondary)}
.og-go-row__value{color:var(--dsw-alias-label-primary);font-weight:500;font-variant-numeric:tabular-nums}
.og-go-row__value[data-limited=true]{color:var(--og-error)}
.og-go-row__track{position:relative;height:6px;margin:6px 0 4px;border-radius:var(--og-radius);background:var(--og-track);overflow:hidden}
.og-go-row__fill{position:absolute;inset:0 auto 0 0;border-radius:var(--og-radius);transition:width .3s ease}
.og-go-row__hint{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.og-go-panel__fineprint{margin-top:8px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.og-go-controls{display:flex;flex-direction:column;gap:8px;margin-top:12px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2)}
.og-go-controls__row{display:flex;align-items:center;gap:8px}
.og-go-controls__label{min-width:28px;font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.og-go-seg{display:inline-flex;gap:2px;padding:2px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2)}
.og-go-seg button{padding:2px 8px;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font-family:inherit;font-size:11px;line-height:16px;cursor:pointer}
.og-go-seg button[aria-pressed=true]{background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary)}
.og-go-seg button:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.og-go-chip{padding:2px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:11px;line-height:16px;cursor:pointer}
.og-go-chip[aria-pressed=true]{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.og-go-chip:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}
.og-go-panel__foot{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:12px;padding-top:10px;border-top:.5px solid var(--dsw-alias-border-l2)}
.og-go-panel__note{font-size:11px;line-height:16px;color:var(--dsw-alias-label-tertiary)}
.og-go-panel__actions{display:flex;align-items:center;gap:8px;margin-left:auto}
.og-go-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 9px;border:1px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:12px;line-height:18px;cursor:pointer}
.og-go-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2)}
.og-go-btn:disabled{color:var(--dsw-alias-label-tertiary);cursor:default}
.og-go-btn:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px}
.og-go-link{color:var(--dsw-alias-brand-primary);text-decoration:none;font-size:12px;line-height:18px}
.og-go-link:hover{text-decoration:underline}
.og-go-error{display:flex;flex-direction:column;gap:6px}
.og-go-error__title{color:var(--og-error);font-weight:500}
.og-go-error__body{color:var(--dsw-alias-label-secondary)}
.og-go-error__code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary);word-break:break-word}
.og-go-muted{color:var(--dsw-alias-label-tertiary)}
.og-go-page{display:flex;flex-direction:column;gap:16px;padding-top:2px;color:var(--dsw-alias-label-primary)}
.og-go-page__head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.og-go-page__title{margin:0;font-size:16px;font-weight:500;line-height:24px}
.og-go-page__sub{margin:4px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.og-go-page__grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}
.og-go-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.og-go-card__top{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:20px}
.og-go-card__label{font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}
.og-go-card__value{font-size:22px;font-weight:600;line-height:28px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.og-go-card__value[data-limited=true]{color:var(--og-error)}
.og-go-card__track{position:relative;height:6px;border-radius:var(--og-radius);background:var(--og-track);overflow:hidden}
.og-go-card__fill{position:absolute;inset:0 auto 0 0;border-radius:var(--og-radius);transition:width .3s ease}
.og-go-card__hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.og-go-pill-limited{display:inline-flex;align-items:center;padding:0 8px;border:1px solid currentColor;border-radius:var(--og-radius);font-size:12px;line-height:18px;color:var(--og-error)}
.og-go-page__footer{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
.og-go-dot{opacity:.5}
`

    /** Resolve the Host route against the page's own base, whatever prefix it is served under. */
    function endpointUrl() {
      try {
        return new URL(ENDPOINT.replace(/^\/+/, ''), document.baseURI).pathname
      } catch {
        return ENDPOINT
      }
    }

    /** A percentage that never claims more precision than the provider gave. */
    function formatPercent(value) {
      if (!Number.isFinite(value) || value <= 0) return '0%'
      if (value < 1) return '<1%'
      if (value >= 10) return `${Math.round(value)}%`
      return `${value.toFixed(1)}%`
    }

    /** Bar and value color follow the meter level, so a nearly exhausted window reads at a glance. */
    function levelColor(value) {
      if (value >= 90) return 'var(--og-error)'
      if (value >= 70) return 'var(--og-warn)'
      return 'var(--og-fill)'
    }

    /** Human duration in the active locale's units. */
    function formatDuration(ms, t) {
      const minutes = Math.max(0, Math.round(ms / 60000))
      const days = Math.floor(minutes / 1440)
      const hours = Math.floor((minutes % 1440) / 60)
      const mins = minutes % 60
      if (days > 0) return `${days}${t('unitD')} ${hours}${t('unitH')}`
      if (hours > 0) return `${hours}${t('unitH')} ${mins}${t('unitM')}`
      return `${mins}${t('unitM')}`
    }

    /** "resets in …", composed from locale fragments because the dictionary has no placeholders. */
    function resetHint(meter, t, now) {
      if (typeof meter.resetsAt !== 'string') return ''
      const at = Date.parse(meter.resetsAt)
      if (!Number.isFinite(at)) return ''
      const remaining = at - now
      if (remaining <= 0) return t('resetting')
      return `${t('resetPre')}${formatDuration(remaining, t)}${t('resetPost')}`
    }

    /** Meter keys in rotation order. */
    const LEVELS = ['rolling', 'weekly', 'monthly']
    const PREFS_KEY = 'opencode-go-usage:display'
    const PREFS_EVENT = 'opencode-go-usage:display-changed'

    /** Read the browser-local display overrides; an unreadable value is simply no override. */
    function readPrefs() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? 'null')
        return parsed !== null && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }

    /**
     * Merge browser-local overrides over the Host's configured defaults, so the
     * panel's toggles take effect without editing the profile and restarting.
     * @param {{ bar?: boolean, level?: string, rotate?: boolean, rotateSeconds?: number }} host configured defaults
     */
    function useDisplayPrefs(host) {
      const [prefs, setPrefs] = React.useState(readPrefs)
      const display = {
        bar: typeof prefs.bar === 'boolean' ? prefs.bar : host.bar !== false,
        level: LEVELS.includes(prefs.level) ? prefs.level : LEVELS.includes(host.level) ? host.level : 'rolling',
        rotate: typeof prefs.rotate === 'boolean' ? prefs.rotate : host.rotate === true,
        rotateSeconds: host.rotateSeconds ?? 5,
      }
      React.useEffect(() => {
        const sync = () => setPrefs(readPrefs())
        window.addEventListener(PREFS_EVENT, sync)
        return () => window.removeEventListener(PREFS_EVENT, sync)
      }, [])
      const update = React.useCallback((patch) => {
        setPrefs((previous) => {
          const next = { ...previous, ...patch }
          try {
            window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
            window.dispatchEvent(new Event(PREFS_EVENT))
          } catch {}
          return next
        })
      }, [])
      return [display, update]
    }

    function errorText(code, t) {
      return t(`err_${KNOWN_CODES.has(code) ? code : 'UNKNOWN'}`)
    }

    /** "Updated 12:03:44", flagged when the snapshot is older than the cache window. */
    function stampOf(state, t) {
      const clock = clockOf(state.fetchedAt)
      const cached = state.stale === true ? ` · ${t('cachedNote')}` : ''
      return `${t('updated')} ${clock}${cached}`
    }

    function clockOf(iso) {
      const at = typeof iso === 'string' ? Date.parse(iso) : Number.NaN
      return Number.isFinite(at) ? new Date(at).toLocaleTimeString() : ''
    }

    /**
     * One shared reader. `cacheOnly` powers the Settings page (never re-query on
     * open); the dock relies on the Host's cache window and polls it.
     * @param {{ cacheOnly: boolean, poll: boolean }} options reading policy
     */
    function useUsage(options) {
      const [state, setState] = React.useState({ phase: 'loading', refreshing: false })
      const [now, setNow] = React.useState(() => Date.now())
      const inFlight = React.useRef(null)
      const active = React.useRef(true)

      const load = React.useCallback(async (request) => {
        const mode = request ?? {}
        if (inFlight.current !== null) inFlight.current.abort()
        const controller = new AbortController()
        inFlight.current = controller
        setState((previous) =>
          previous.phase === 'ready' ? { ...previous, refreshing: true } : { phase: 'loading', refreshing: false },
        )
        const query = mode.force === true ? '?refresh=1' : mode.cacheOnly === true ? '?cache=1' : ''
        try {
          const response = await fetch(`${endpointUrl()}${query}`, {
            method: 'GET',
            headers: { accept: 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
            signal: controller.signal,
          })
          const body = await response.json()
          if (controller.signal.aborted) return
          if (body !== null && typeof body === 'object' && body.ok === true) {
            active.current = body.dock !== false
            setState({
              phase: 'ready',
              usage: body.usage,
              fetchedAt: body.fetchedAt,
              servedFromCache: body.servedFromCache === true,
              stale: body.stale === true,
              dock: body.dock !== false,
              display: body.display,
              refreshing: false,
            })
          } else {
            const error = body !== null && typeof body === 'object' && body.error !== undefined ? body.error : undefined
            setState({
              phase: 'error',
              refreshing: false,
              error: {
                code: error !== undefined && typeof error.code === 'string' ? error.code : 'UNKNOWN',
                message: error !== undefined && typeof error.message === 'string' ? error.message : '',
              },
            })
          }
        } catch (error) {
          if (controller.signal.aborted) return
          setState({
            phase: 'error',
            refreshing: false,
            error: { code: 'NETWORK', message: error instanceof Error ? error.message : String(error) },
          })
        } finally {
          if (inFlight.current === controller) inFlight.current = null
        }
      }, [])

      React.useEffect(() => {
        load({ cacheOnly: options.cacheOnly === true })
        if (options.poll !== true) return undefined
        const timer = window.setInterval(() => {
          if (!active.current) return
          setNow(Date.now())
          load({})
        }, POLL_MS)
        return () => {
          window.clearInterval(timer)
          if (inFlight.current !== null) {
            inFlight.current.abort()
            inFlight.current = null
          }
        }
      }, [load, options.cacheOnly, options.poll])

      const reload = React.useCallback(() => {
        load({ force: true })
      }, [load])

      return { state, reload, now }
    }

    /**
     * Keep a portaled panel above its trigger, clamped into the viewport.
     * @param {boolean} open panel visibility
     * @param {{ current: HTMLElement | null }} anchorRef trigger element
     */
    function usePanelPosition(open, anchorRef) {
      const [position, setPosition] = React.useState(null)
      React.useLayoutEffect(() => {
        if (!open) {
          setPosition(null)
          return undefined
        }
        const update = () => {
          const element = anchorRef.current
          if (element === null) return
          const rect = element.getBoundingClientRect()
          const width = Math.min(PANEL_WIDTH, window.innerWidth - 24)
          const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12))
          const bottom = Math.min(window.innerHeight - 12, window.innerHeight - rect.top + 8)
          setPosition({ left, bottom, width })
        }
        update()
        window.addEventListener('resize', update)
        window.addEventListener('scroll', update, true)
        return () => {
          window.removeEventListener('resize', update)
          window.removeEventListener('scroll', update, true)
        }
      }, [open, anchorRef])
      return position
    }

    /** Three allowance rows inside the dock panel. */
    function MeterRows(props) {
      const { usage, t, now } = props
      const meters = usage ?? {}
      const rows = [
        ['rolling', t('rolling')],
        ['weekly', t('weekly')],
        ['monthly', t('monthly')],
      ]
      return h(
        'div',
        null,
        rows.map(([key, label]) => {
          const meter = meters[key]
          const percent = Number.isFinite(meter?.percent) ? meter.percent : 0
          const limited = meter?.status === 'limited'
          return h(
            'div',
            { className: 'og-go-row', key },
            h(
              'div',
              { className: 'og-go-row__top' },
              h('span', { className: 'og-go-row__label' }, label),
              h(
                'span',
                { className: 'og-go-row__value', 'data-limited': limited ? 'true' : undefined },
                limited ? t('limited') : formatPercent(percent),
              ),
            ),
            h(
              'div',
              {
                className: 'og-go-row__track',
                role: 'progressbar',
                'aria-label': label,
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': Math.round(percent),
              },
              h('div', {
                className: 'og-go-row__fill',
                style: { width: `${Math.min(100, Math.max(0, percent))}%`, background: levelColor(percent) },
              }),
            ),
            h('div', { className: 'og-go-row__hint' }, resetHint(meter ?? {}, t, now)),
          )
        }),
      )
    }

    /** Inline bar / level / rotation controls; changes persist in this browser. */
    function DisplayControls(props) {
      const { display, updateDisplay, t } = props
      const levelButton = (key) =>
        h(
          'button',
          {
            type: 'button',
            key,
            'aria-pressed': display.level === key,
            onClick: () => updateDisplay({ level: key }),
          },
          t(key === 'rolling' ? 'shortRolling' : key === 'weekly' ? 'shortWeekly' : 'shortMonthly'),
        )
      return h(
        'div',
        { className: 'og-go-controls' },
        h(
          'div',
          { className: 'og-go-controls__row' },
          h('span', { className: 'og-go-controls__label' }, t('levelLabel')),
          h(
            'div',
            { className: 'og-go-seg', role: 'group', 'aria-label': t('levelLabel') },
            LEVELS.map(levelButton),
          ),
        ),
        h(
          'div',
          { className: 'og-go-controls__row' },
          h(
            'button',
            {
              type: 'button',
              className: 'og-go-chip',
              'aria-pressed': display.bar,
              onClick: () => updateDisplay({ bar: !display.bar }),
            },
            t('showBar'),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'og-go-chip',
              'aria-pressed': display.rotate,
              onClick: () => updateDisplay({ rotate: !display.rotate }),
            },
            t('rotateLabel'),
          ),
        ),
      )
    }

    /** Panel body: loading, error, or the three meters plus a manual refresh. */
    function PanelContent(props) {
      const { state, t, now, reload, display, updateDisplay } = props
      if (state.phase === 'loading') return h('div', { className: 'og-go-muted' }, t('loading'))
      if (state.phase === 'error') {
        const code = state.error !== undefined && KNOWN_CODES.has(state.error.code) ? state.error.code : 'UNKNOWN'
        return h(
          'div',
          { className: 'og-go-error' },
          h('div', { className: 'og-go-error__title' }, t('errorTitle')),
          h('div', { className: 'og-go-error__body' }, errorText(code, t)),
          state.error !== undefined && state.error.message !== '' && state.error.message !== errorText(code, t)
            ? h('div', { className: 'og-go-error__code' }, state.error.message)
            : null,
          h('div', null, h('button', { type: 'button', className: 'og-go-btn', onClick: reload }, t('retry'))),
        )
      }
      return h(
        React.Fragment,
        null,
        h(MeterRows, { usage: state.usage, t, now }),
        h('div', { className: 'og-go-panel__fineprint' }, t('integerNote')),
        h(DisplayControls, { display, updateDisplay, t }),
        h(
          'div',
          { className: 'og-go-panel__foot' },
          h('span', { className: 'og-go-panel__note' }, stampOf(state, t)),
          h(
            'div',
            { className: 'og-go-panel__actions' },
            h(
              'button',
              { type: 'button', className: 'og-go-btn', onClick: reload, disabled: state.refreshing },
              state.refreshing ? t('refreshing') : t('refresh'),
            ),
            h(
              'a',
              { className: 'og-go-link', href: 'https://opencode.ai/console', target: '_blank', rel: 'noreferrer' },
              t('openConsole'),
            ),
          ),
        ),
      )
    }

    /** The composer-dock pill and its hover/click panel. */
    function DockPill(props) {
      const t = props.t
      const { state, reload, now } = useUsage({ cacheOnly: false, poll: true })
      const [open, setOpen] = React.useState(false)
      const [cycle, setCycle] = React.useState(0)
      const [pinned, setPinned] = React.useState(false)
      const rootRef = React.useRef(null)
      const panelRef = React.useRef(null)
      const closeTimer = React.useRef(0)
      const pinnedRef = React.useRef(false)
      const position = usePanelPosition(open, rootRef)

      pinnedRef.current = pinned

      const close = React.useCallback(() => {
        setPinned(false)
        setOpen(false)
      }, [])

      const hideUnlessPinned = React.useCallback(() => {
        window.clearTimeout(closeTimer.current)
        closeTimer.current = window.setTimeout(() => {
          if (!pinnedRef.current) setOpen(false)
        }, 160)
      }, [])

      const keepOpen = React.useCallback(() => {
        window.clearTimeout(closeTimer.current)
        setOpen(true)
      }, [])

      React.useEffect(() => () => window.clearTimeout(closeTimer.current), [])

      const [display, updateDisplay] = useDisplayPrefs(state.display ?? {})

      // Optional rotation of the tracked level. The expanded panel always lists all
      // three, so the cycle keeps running while it is open.
      React.useEffect(() => {
        if (display.rotate !== true) return undefined
        const period = Math.max(2000, (Number.isFinite(display.rotateSeconds) ? display.rotateSeconds : 5) * 1000)
        const timer = window.setInterval(() => setCycle((value) => (value + 1) % LEVELS.length), period)
        return () => window.clearInterval(timer)
      }, [display.rotate, display.rotateSeconds])

      React.useEffect(() => {
        if (!open) return undefined
        const onKeyDown = (event) => {
          if (event.key === 'Escape') close()
        }
        const onPointerDown = (event) => {
          const target = event.target
          if (target instanceof Node && (rootRef.current?.contains(target) === true || panelRef.current?.contains(target) === true))
            return
          close()
        }
        document.addEventListener('keydown', onKeyDown)
        document.addEventListener('pointerdown', onPointerDown, true)
        return () => {
          document.removeEventListener('keydown', onKeyDown)
          document.removeEventListener('pointerdown', onPointerDown, true)
        }
      }, [open, close])

      if (state.phase !== 'ready' || state.dock === false) return null

      const baseIndex = Math.max(0, LEVELS.indexOf(display.level))
      const levelKey = display.rotate === true ? LEVELS[(baseIndex + cycle) % LEVELS.length] : display.level
      const meter = (state.usage ?? {})[levelKey]
      const percent = Number.isFinite(meter?.percent) ? meter.percent : 0
      const limited = meter?.status === 'limited'
      const short = t(levelKey === 'weekly' ? 'shortWeekly' : levelKey === 'monthly' ? 'shortMonthly' : 'shortRolling')
      const label = `${t('title')} · ${short} ${formatPercent(percent)}`

      return h(
        'span',
        {
          className: 'og-go',
          ref: rootRef,
          onMouseEnter: keepOpen,
          onMouseLeave: hideUnlessPinned,
        },
        h(
          'button',
          {
            type: 'button',
            className: 'og-go-pill',
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            'aria-label': label,
            title: label,
            onFocus: keepOpen,
            onClick: () => {
              if (open && pinned) close()
              else {
                setPinned(true)
                keepOpen()
              }
            },
          },
          h('span', { className: 'og-go-pill__tag' }, 'Go'),
          display.bar === false
            ? null
            : h(
                'span',
                { className: 'og-go-pill__track' },
                h('span', {
                  // Remount per level: a width tween across two different meters
                  // reads as lag, while a same-level refresh should still animate.
                  key: levelKey,
                  className: 'og-go-pill__fill',
                  style: { width: `${Math.min(100, Math.max(0, percent))}%`, background: levelColor(percent) },
                }),
              ),
          h('span', { className: 'og-go-pill__level' }, short),
          h(
            'span',
            { className: 'og-go-pill__value', 'data-limited': limited ? 'true' : undefined },
            limited ? t('limited') : formatPercent(percent),
          ),
        ),
        open && position !== null
          ? ReactDOM.createPortal(
              h(
                'div',
                {
                  ref: panelRef,
                  className: 'og-go-panel og-go',
                  role: 'dialog',
                  'aria-label': t('title'),
                  style: { left: `${position.left}px`, bottom: `${position.bottom}px`, width: `${position.width}px` },
                  onMouseEnter: keepOpen,
                  onMouseLeave: hideUnlessPinned,
                },
                h(
                  'div',
                  { className: 'og-go-panel__head' },
                  h('span', null, t('title')),
                  h('span', { className: 'og-go-panel__meta' }, clockOf(state.fetchedAt)),
                ),
                h('div', { className: 'og-go-panel__rule', 'aria-hidden': true }),
                h(PanelContent, { state, t, now, reload, display, updateDisplay }),
              ),
              document.body,
            )
          : null,
      )
    }

    /** The Settings page: cache-first, manual refresh, no background polling. */
    function UsageSection(props) {
      const t = props.t
      const { state, reload } = useUsage({ cacheOnly: true, poll: false })
      const [display, updateDisplay] = useDisplayPrefs(state.display ?? {})

      const head = h(
        'div',
        { className: 'og-go-page__head' },
        h(
          'div',
          null,
          h('h2', { className: 'og-go-page__title' }, t('title')),
          h('p', { className: 'og-go-page__sub' }, t('subtitle')),
        ),
        h(
          'button',
          {
            type: 'button',
            className: 'og-go-btn',
            onClick: reload,
            disabled: state.refreshing || state.phase === 'loading',
          },
          state.refreshing ? t('refreshing') : t('refresh'),
        ),
      )

      if (state.phase === 'loading') {
        return h('div', { className: 'og-go og-go-page' }, head, h('div', { className: 'og-go-muted' }, t('loading')))
      }

      if (state.phase === 'error') {
        const code = state.error !== undefined && KNOWN_CODES.has(state.error.code) ? state.error.code : 'UNKNOWN'
        return h(
          'div',
          { className: 'og-go og-go-page' },
          head,
          h(
            'div',
            { className: 'og-go-card', role: 'alert' },
            h(
              'div',
              { className: 'og-go-error' },
              h('div', { className: 'og-go-error__title' }, t('errorTitle')),
              h('div', { className: 'og-go-error__body' }, errorText(code, t)),
              state.error !== undefined && state.error.message !== '' && state.error.message !== errorText(code, t)
                ? h('div', { className: 'og-go-error__code' }, state.error.message)
                : null,
              h('div', null, h('button', { type: 'button', className: 'og-go-btn', onClick: reload }, t('retry'))),
            ),
          ),
        )
      }

      const usage = state.usage ?? {}
      const cards = [
        ['rolling', t('rolling')],
        ['weekly', t('weekly')],
        ['monthly', t('monthly')],
      ]

      return h(
        'div',
        { className: 'og-go og-go-page' },
        head,
        h(
          'div',
          { className: 'og-go-page__grid' },
          cards.map(([key, label]) => {
            const meter = usage[key]
            const percent = Number.isFinite(meter?.percent) ? meter.percent : 0
            const limited = meter?.status === 'limited'
            return h(
              'div',
              { className: 'og-go-card', key },
              h(
                'div',
                { className: 'og-go-card__top' },
                h('span', { className: 'og-go-card__label' }, label),
                limited ? h('span', { className: 'og-go-pill-limited' }, t('limited')) : null,
              ),
              h(
                'div',
                { className: 'og-go-card__value', 'data-limited': limited ? 'true' : undefined },
                formatPercent(percent),
              ),
              h(
                'div',
                {
                  className: 'og-go-card__track',
                  role: 'progressbar',
                  'aria-label': label,
                  'aria-valuemin': 0,
                  'aria-valuemax': 100,
                  'aria-valuenow': Math.round(percent),
                },
                h('div', {
                  className: 'og-go-card__fill',
                  style: { width: `${Math.min(100, Math.max(0, percent))}%`, background: levelColor(percent) },
                }),
              ),
              h('div', { className: 'og-go-card__hint' }, resetHint(meter ?? {}, t, Date.now())),
            )
          }),
        ),
        h(DisplayControls, { display, updateDisplay, t }),
        h(
          'div',
          { className: 'og-go-page__footer' },
          h('span', null, stampOf(state, t)),
          h('span', { className: 'og-go-dot' }, '·'),
          h('span', null, t('manualRefreshNote')),
          h('span', { className: 'og-go-dot' }, '·'),
          h('span', null, t('integerNote')),
          h('span', { className: 'og-go-dot' }, '·'),
          h(
            'a',
            { className: 'og-go-link', href: 'https://opencode.ai/console', target: '_blank', rel: 'noreferrer' },
            t('openConsole'),
          ),
        ),
      )
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'opencode-go-usage: dictionaries')
        const t = ctx.locale.bind(NS)

        ctx.effect(() => {
          const style = document.createElement('style')
          style.dataset.plugin = 'dsh-opencode-go-usage'
          style.textContent = CSS
          document.head.appendChild(style)
          return () => {
            style.remove()
          }
        }, 'opencode-go-usage: styles')

        // Left of the Turn-count pill (`activity`, order 0) in the composer dock.
        ctx.slots.inject('conversation.composer.dock', () =>
          ctx.slots.register(
            {
              name: 'conversation.composer.dock',
              id: 'opencode-go-usage',
              order: -1,
              locale: NS,
              inject: () => ({ t }),
            },
            DockPill,
          ),
        )

        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            {
              name: 'settings.section',
              id: 'opencode-go-usage',
              order: 30,
              label: () => t('nav'),
              locale: NS,
              inject: () => ({ t }),
            },
            UsageSection,
          ),
        )
      },
    }
  },
})
