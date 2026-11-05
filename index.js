/**
 * Host half of the OpenCode Go usage bundle.
 *
 * Reads the Go allowance from `https://opencode.ai/zen/go/v1/usage` with the
 * credential the Harness already holds for the `opencode-go` model provider,
 * caches it, and publishes a read-only JSON route the Client half renders.
 * The API key never leaves the Host process.
 *
 * @module dsh-opencode-go-usage
 */

const UPSTREAM = 'https://opencode.ai/zen/go/v1/usage'
const DEFAULT_ENDPOINT = '/dsh-opencode-go/usage'
const DEFAULT_REF = 'OPENCODE_GO_API_KEY'
const USER_AGENT = 'dsh-opencode-go-usage/1.0'
const TIMEOUT_MS = 15000
const ERROR_TTL_MS = 5000

/**
 * Normalize a configured level name, accepting the three ids and their common
 * aliases; anything unrecognized falls back to the 5-hour window.
 * @param {unknown} value configured level
 * @returns {'rolling' | 'weekly' | 'monthly'} a known meter key
 */
function levelOf(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (raw === 'weekly' || raw === 'week' || raw === 'w' || raw === '周') return 'weekly'
  if (raw === 'monthly' || raw === 'month' || raw === 'm' || raw === '月') return 'monthly'
  return 'rolling'
}

/**
 * Clamp an untrusted percentage into the meter's 0–100 range.
 * @param {unknown} value raw provider value
 * @returns {number} a usable percentage
 */
function percentOf(value) {
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed)) return 0
  return Math.min(100, Math.max(0, parsed))
}

/**
 * Project one upstream meter (`rolling` | `weekly` | `monthly`).
 * @param {unknown} value raw upstream meter
 */
function meterOf(value) {
  const meter = value !== null && typeof value === 'object' ? value : {}
  return {
    status: meter.status === 'rate-limited' ? 'limited' : 'ok',
    percent: percentOf(meter.percent),
    resetsAt: typeof meter.resetsAt === 'string' ? meter.resetsAt : null,
  }
}

/**
 * Read the credential reference from the Host: the managed store first (the
 * Models page writes it), then the process environment as a fallback.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning context
 * @param {string} ref credential reference name
 */
async function resolveKey(ctx, ref) {
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const hit = await credentials.resolve(ref)
    if (hit !== undefined && typeof hit.value === 'string' && hit.value.length > 0) {
      return { key: hit.value, source: hit.source ?? 'stored' }
    }
  }
  const ambient = typeof process !== 'undefined' ? process.env[ref] : undefined
  if (typeof ambient === 'string' && ambient.length > 0) return { key: ambient, source: 'environment' }
  return undefined
}

/**
 * Fetch and normalize the Go allowance.
 * @param {string} key bearer credential
 */
async function fetchUsage(key) {
  const response = await fetch(UPSTREAM, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${key}`,
      accept: 'application/json',
      'user-agent': USER_AGENT,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

  if (!response.ok) {
    const code = response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : 'UPSTREAM'
    return {
      ok: false,
      error: {
        code,
        status: response.status,
        message:
          response.status === 401
            ? 'OpenCode rejected the API key (HTTP 401). Save a valid key in Settings → Models.'
            : response.status === 403
              ? 'This key has no OpenCode Go subscription, or cannot read its usage (HTTP 403).'
              : `OpenCode Go usage is unavailable (HTTP ${response.status}).`,
      },
    }
  }

  const body = await response.json()
  const usage =
    body !== null && typeof body === 'object' && body.usage !== null && typeof body.usage === 'object' ? body.usage : undefined
  if (usage === undefined) {
    return { ok: false, error: { code: 'SHAPE', message: 'OpenCode returned an unexpected usage payload.' } }
  }

  return {
    ok: true,
    usage: {
      rolling: meterOf(usage.rolling),
      weekly: meterOf(usage.weekly),
      monthly: meterOf(usage.monthly),
    },
  }
}

/**
 * Host plugin body.
 * @param {import('@deepseek-ai/cordis').Context} ctx owning context
 * @param {{ apiKey?: string, apiKeyEnv?: string, path?: string, cacheSeconds?: number, dock?: boolean, bar?: boolean, level?: string, rotate?: boolean, rotateSeconds?: number }} [config]
 */
export function apply(ctx, config = {}) {
  const literalKey = typeof config.apiKey === 'string' && config.apiKey.length > 0 ? config.apiKey : undefined
  const reference = typeof config.apiKeyEnv === 'string' && config.apiKeyEnv.length > 0 ? config.apiKeyEnv : DEFAULT_REF
  const endpoint = typeof config.path === 'string' && config.path.startsWith('/') ? config.path : DEFAULT_ENDPOINT
  const cacheMs = Number.isFinite(config.cacheSeconds) && config.cacheSeconds > 0 ? config.cacheSeconds * 1000 : 60000
  /** Whether the Client should show the composer-dock pill; default on. */
  const dockEnabled = config.dock !== false
  /**
   * How the dock pill presents the reading: whether the bar is drawn, which
   * allowance it tracks, and whether that allowance rotates on a timer.
   */
  const display = {
    bar: config.bar !== false,
    level: levelOf(config.level),
    rotate: config.rotate === true,
    rotateSeconds:
      Number.isFinite(config.rotateSeconds) && config.rotateSeconds >= 2 ? Math.round(config.rotateSeconds) : 5,
  }
  /** Every response carries the dock presentation so the Client needs no second route. */
  const envelope = () => ({ dock: dockEnabled, display })

  /** Last successful reading: a derived cache shared by the dock and the settings page. */
  let cached
  /** Last failed reading, kept briefly so a broken key does not hammer the provider. */
  let failed

  const fetchOnce = async (now) => {
    let resolved
    try {
      resolved = literalKey === undefined ? await resolveKey(ctx, reference) : { key: literalKey, source: 'config' }
    } catch (error) {
      ctx.logger?.warn('opencode-go-usage: credential resolution failed')
      ctx.logger?.warn(error)
      resolved = undefined
    }

    if (resolved === undefined) {
      const payload = {
        ok: false,
        fetchedAt: new Date(now).toISOString(),
        error: {
          code: 'NO_KEY',
          message: `No credential behind ${reference}. Save an OpenCode Go API key in Settings → Models, or set config.apiKey.`,
        },
      }
      failed = { at: now, payload }
      return payload
    }

    try {
      const result = await fetchUsage(resolved.key)
      const payload = { ...result, fetchedAt: new Date(now).toISOString(), credentialSource: resolved.source }
      if (result.ok) {
        cached = { at: now, payload }
        failed = undefined
      } else {
        failed = { at: now, payload }
      }
      return payload
    } catch (error) {
      const timeout = error !== null && typeof error === 'object' && error.name === 'TimeoutError'
      const payload = {
        ok: false,
        fetchedAt: new Date(now).toISOString(),
        credentialSource: resolved.source,
        error: {
          code: timeout ? 'TIMEOUT' : 'NETWORK',
          message: timeout
            ? 'opencode.ai did not answer within 15 seconds.'
            : `Could not reach opencode.ai: ${error instanceof Error ? error.message : String(error)}`,
        },
      }
      failed = { at: now, payload }
      return payload
    }
  }

  /**
   * Answer one read.
   * - no flag: fresh cache within `cacheSeconds`, otherwise one upstream read
   * - `refresh=1`: always one upstream read
   * - `cache=1`: whatever is cached, however old (one upstream read only when
   *   nothing has been cached yet), so opening Settings never re-queries.
   * @param {{ force: boolean, cacheOnly: boolean }} request reading mode
   */
  const read = async ({ force, cacheOnly }) => {
    const now = Date.now()

    if (!force && cached !== undefined) {
      const age = now - cached.at
      if (cacheOnly || age < cacheMs) {
        return {
          ...cached.payload,
          ...envelope(),
          servedFromCache: true,
          stale: age >= cacheMs,
        }
      }
    }

    if (!force && !cacheOnly && failed !== undefined && now - failed.at < ERROR_TTL_MS) {
      return { ...failed.payload, ...envelope() }
    }

    const payload = await fetchOnce(now)
    return { ...payload, ...envelope(), servedFromCache: false }
  }

  const handler = async (request, response) => {
    if (request.method !== 'GET') {
      response.writeHead(405, { allow: 'GET', 'content-type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ ok: false, error: { code: 'METHOD', message: 'GET only.' } }))
      return
    }

    let force = false
    let cacheOnly = false
    try {
      const url = new URL(request.url ?? endpoint, 'http://localhost')
      force = url.searchParams.get('refresh') === '1'
      cacheOnly = url.searchParams.get('cache') === '1'
    } catch {
      force = false
    }

    let payload
    try {
      payload = await read({ force, cacheOnly })
    } catch (error) {
      ctx.logger?.warn('opencode-go-usage: usage read failed')
      ctx.logger?.warn(error)
      payload = {
        ok: false,
        fetchedAt: new Date().toISOString(),
        ...envelope(),
        error: { code: 'INTERNAL', message: 'The usage reader failed unexpectedly.' },
      }
    }

    const body = JSON.stringify(payload)
    response.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body),
    })
    response.end(body)
  }

  // A new key (or a cleared one) makes the cached reading wrong, not stale: drop
  // it so the next request — including a cache-only Settings open — resolves the
  // current credential instead of showing the previous account's numbers.
  ctx.on('credentials/reference-updated', (ref) => {
    if (String(ref) === reference) {
      cached = undefined
      failed = undefined
    }
  })

  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: endpoint, handler }))
}

export const inject = ['webServer']
