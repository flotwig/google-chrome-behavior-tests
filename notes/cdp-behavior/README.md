cdp-behavior
====

- CDP `Network` domain: https://chromedevtools.github.io/devtools-protocol/tot/Network/

## Cache behavior

- A `Network.requestServedFromCache` is NOT emitted for 304 responses. Instead, the `Network.responseReceivedExtraInfo` event is emitted, containing the original HTTP 200 cached response, followed by the `Network.responseReceived` event which contains the actual HTTP 304 response data. See: https://github.com/flotwig/google-chrome-behavior-tests/blob/0ec7452308f0a2fbc638028d954ad61845f36bfb/notes/cdp-behavior/cdp-logs-304.json#L9136-L9226
- A `Network.requestServedFromCache` is ONLY emitted if the request can be fulfilled without sending ANY network traffic at all - ie, the browser has enough info to fulfill the request directly from cache. Hence why a 304 does not cause this to be emitted. See an example of a cached data URL here: https://github.com/flotwig/google-chrome-behavior-tests/blob/0ec7452308f0a2fbc638028d954ad61845f36bfb/notes/cdp-behavior/cdp-logs-304.json#L3493-L3543

## Redirect behavior

- Here is a list of events sent for a normal A->B 301 redirect: `Network.requestWillBeSentExtraInfo`, `Network.requestWillBeSent` (for A), `Network.responseReceivedExtraInfo`, `Network.requestWillBeSent` (for B), `Network.requestWillBeSentExtraInfo`, `Network.responseReceivedExtraInfo`, `Network.responseReceived`, `Network.dataReceived`, `Network.dataReceived`, `Network.loadingFinished`
  - Example: https://github.com/flotwig/google-chrome-behavior-tests/blob/0ec7452308f0a2fbc638028d954ad61845f36bfb/notes/cdp-behavior/cdp-logs-301-same-origin.json#L6835-L9421
- From this, we can see that an event is emitted at each stage of the HTTP request/response cycle within a redirect.
- Fewer events are emitted for a cached A->B 301 redirect (ending in a 304): `Network.responseReceivedExtraInfo` (emitted **first** - probably just a bug in CDP), `Network.requestWillBeSent` (for A), `Network.requestWillBeSent` (for B), `Netork.requestWillBeSentExtraInfo`, `Network.responseReceivedExtraInfo`, `Network.responseReceived`, `Network.dataReceived`, `Network.loadingFinished`
  - Example: https://github.com/flotwig/google-chrome-behavior-tests/blob/0ec7452308f0a2fbc638028d954ad61845f36bfb/notes/cdp-behavior/cdp-logs-301-same-origin.json#L8151-L9621
- Cross-origin redirects and same-origin redirects appear to be treated identically by CDP.

## Data collection

Data collected from running Cypress with Electron with this patch in `electron.js`:

```js
webContents.debugger.sendCommand('Network.enable')

const cdpLog = []

webContents.debugger.on('message', (event, method, params) => {
  if (method.startsWith('Network.')) {
    cdpLog.push({ method, params })
  }
})

webContents.debugger.on('detach', () => {
  require('fs').writeFile(`/tmp/electron-cdp-${Date.now()}.json`, JSON.stringify(cdpLog, null, 2))
})
```

With this spec code:

```js
it('testing cache', () => {
  // const url = `/fixtures/generic.html?t=${Date.now()}` // for testing 304's
  // or
  // const url = `/redirect?t=${Date.now()}`

  const sendXhr = (url) => {
    const x = new XMLHttpRequest()

    x.open('get', url)
    x.send()

    return new Promise((resolve) => {
      x.onload = () => {
        resolve(x)
      }
    })
  }

  const sendFetch = (url) => {
    return fetch(url)
  }

  return sendXhr(url)
  .then((x) => {
    return sendFetch(url)
    .then((y) => {
      console.log(x.status, y.status, { x, y })
    })
  })
})
```
