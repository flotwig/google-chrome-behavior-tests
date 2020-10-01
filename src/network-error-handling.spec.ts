import _ from 'lodash'
import { allowDestroy, Destroyable } from './allow-destroy'
import express from 'express'
import morgan from 'morgan'
import os from 'os'
import path from 'path'
import puppeteer from 'puppeteer'
import { promises } from 'fs'
import { Server } from 'http'

const fs = promises

const PORT = 12344

const getNewTempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'chrome-test-profile-'))

const launchBrowser = async () =>
  puppeteer.launch({
    userDataDir: await getNewTempDir(),
    args: [
      `--proxy-server=http://localhost:${PORT}`,
      `--no-sandbox`
    ]
  })

describe('Network Error Handling', () => {
  let server: Destroyable<Server>
  let app: express.Application
  let page: puppeteer.Page
  let browser: puppeteer.Browser

  beforeEach(async () => {
    app = express()
    app.use(morgan('common'))

    browser = await launchBrowser()
    page = await browser.newPage()

    await new Promise(resolve => {
      server = allowDestroy(app.listen(PORT, resolve))
    })
  })

  afterEach(async () => {
    await new Promise(resolve => {
      server.destroy(resolve)
    })
    await browser.close()
    console.log('destroyed and closed')
  })

  describe('HTTP 5xx', () => {
    const testHttpStatusRetry = (statusCode: number, expectedRetries: number) => {
      return async () => {
        let hitCount = 0

        app.get('*', (req, res) => {
          hitCount++
          res.sendStatus(statusCode)
        })

        await page.goto('http://foo.com')

        expect(hitCount).toEqual(expectedRetries)
      }
    }
    it('does not retry on 502 on page visit', testHttpStatusRetry(502, 1))
    it('does not retry on 503 on page visit', testHttpStatusRetry(503, 1))
    it('does not retry on 504 on page visit', testHttpStatusRetry(504, 1))
  })
})
