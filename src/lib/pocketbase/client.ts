import PocketBase from 'pocketbase'

/**
 * Timeout for outgoing PocketBase requests, in milliseconds.
 *
 * The PocketBase JS SDK (v0.26.9) does NOT expose a `timeout` option on its
 * constructor — its signature is `new PocketBase(baseUrl, authStore?, lang?)`.
 * The documented way to bound a request's duration is to supply a custom
 * `signal` (or `fetch`) via the `beforeSend` hook, which is what we do below.
 *
 * Large recipe PDF uploads can legitimately take tens of seconds, so we use a
 * generous 5 minute ceiling to avoid the SDK/burger hanging indefinitely
 * while still being well above the reverse-proxy cut-off.
 */
const REQUEST_TIMEOUT_MS = 5 * 60 * 1000 // 300000ms = 5 minutes

const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)
pb.autoCancellation(false)

pb.beforeSend = (url, options) => {
  // autoCancellation is disabled, so the SDK does not manage its own signal
  // and it is safe to attach our own timeout signal here.
  options.signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  return { url, options }
}

export default pb
