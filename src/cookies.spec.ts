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

describe('Cookies', () => {
  let server: Destroyable<Server>
  let app: express.Application

  ([
    ['original domain', 8],
    ['different domain', 7]
  ]).forEach(([ending, N]) => {
    it(`sets cookies on a long list of redirects, ending with ${ending}`, async () => {
      const browser = await launchBrowser()
      const page = await browser.newPage()

      app = express()
      app.use(morgan('common'))

      const cascadingHandler: express.Handler = function(req, res) {
        var a, b, n;
        n = Number(req.query.n);
        // alternates between domains
        a = req.query.a;
        b = req.query.b;
        res.header("Set-Cookie", [`namefoo${n}=valfoo${n}`, `namebar${n}=valbar${n}`]);
        if (n > 0) {
          res.redirect(`${a}/setCascadingCookies?n=${n - 1}&a=${b}&b=${a}`);
        }
        return res.send("<html>finished setting cookies</html>");
      }

      app.get('*', cascadingHandler);

      server = allowDestroy(app.listen(PORT))

      await page.goto(`http://site1.foo.com/setCascadingCookies?n=${N}&a=http://site2.bar.net&b=http://site1.foo.com`)

      let cookies = await page.cookies('http://site1.foo.com', 'http://site2.bar.net')
      cookies = _.reverse(_.sortBy(cookies, _.property('name')))

      expect(cookies).toMatchSnapshot()

      await browser.close()
      await new Promise((r) => server.destroy(r))
    })
  })
})
