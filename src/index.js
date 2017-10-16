'use strict';

const nodeSass = require('node-sass');
const path = require('path');
const fs = require('fs');
const cheerio = require('cheerio');
const loaderUtils = require("loader-utils");

const consoleFilename = fn => `\x1b[1m${fn}\x1b[0m`;
const consoleHighlight = s => `\x1b[1;35m${s}\x1b[0m`;
const log = s => console.log(`\x1b[32mpolymer-sass-loader: \x1b[0m${s}`);
const error = s => console.error(`\x1b[31mpolymer-sass-loader: \x1b[0m${s}`);

module.exports = function polymerScss(source) {
  const sourceDir = path.dirname(this.resourcePath);
  const self = this;
  const cb = this.async();
  this.cacheable && this.cacheable();
  var config = loaderUtils.getOptions(this) || {};

  var $ = cheerio.load(source);
  var el = $('style[lang="scss"]');

  if (el) {
    var scss = el.html();

    if (!scss) {
      return cb(null, $.html());
    }

    config.outputStyle = config.outputStyle || 'nested'; // nested, expanded, compact, compressed

    config.data = scss.toString();

    config.includePaths = [ sourceDir ].concat(config.includePaths || []).filter((item, pos, self) => self.indexOf(item) == pos);

    log(`Processing scss => ${consoleFilename(this.resourcePath)}`);

    const imports = (scss.match(/@import ([^\n]+)/gi) || []).map(
      i => i.match(/@import ['"]?([^'"]+)['"]?;?/i).pop()
    )
    .filter((item, pos, self) => self.indexOf(item) == pos)
    .map(
      i => {
        const deps = config.includePaths
          .map(ip => [path.join(ip, `_${i}.scss`), path.join(ip, `${i}.scss`)])
          .reduce((a, b) => a.concat(b))
          .map(f => fs.existsSync(f) ? f : null)
          .filter(f => f);
        const ip = { import: i, dependencies: deps };
        return ip;
      }
    )
    .map(
      id => {
        const idp = id.dependencies.reduce((a, b) => a.concat(b));
        log(`Add watch dependency from ${consoleHighlight(`@import '${id.import}'`)} => ${consoleFilename(idp)}`)
        self.addDependency(idp);
        return id;
      }
    );

    nodeSass.render(config, function (err, compiledScss) {
      if (err || !compiledScss) {
        error('Error compiling scss: ' + err);
        return cb(null, null);
      }
      var css = compiledScss.css.toString();
      el.text(css);
      el.removeAttr('lang');
      return cb(null, $.html());
    });
  }
};
