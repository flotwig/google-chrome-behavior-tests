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
  })

  describe('HTTP 5xx', () => {
    it('retries on 502 on page visit', async () => {
      let hitCount = 0

      app.get('*', (req, res) => {
        hitCount++
        res.sendStatus(502)
      })

      await page.goto('http://foo.com')

      expect(hitCount).toEqual(1)
    })

    it('retries on 504 on page visit', async () => {
      let hitCount = 0

      app.get('*', (req, res) => {
        hitCount++
        res.sendStatus(504)
      })

      await page.goto('http://foo.com')

      expect(hitCount).toEqual(1)
    })
  })
})
