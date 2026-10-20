"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// node_modules/requires-port/index.js
var require_requires_port = __commonJS({
  "node_modules/requires-port/index.js"(exports2, module2) {
    "use strict";
    module2.exports = function required(port, protocol) {
      protocol = protocol.split(":")[0];
      port = +port;
      if (!port) return false;
      switch (protocol) {
        case "http":
        case "ws":
          return port !== 80;
        case "https":
        case "wss":
          return port !== 443;
        case "ftp":
          return port !== 21;
        case "gopher":
          return port !== 70;
        case "file":
          return false;
      }
      return port !== 0;
    };
  }
});

// node_modules/querystringify/index.js
var require_querystringify = __commonJS({
  "node_modules/querystringify/index.js"(exports2) {
    "use strict";
    var has = Object.prototype.hasOwnProperty;
    var undef;
    function decode(input) {
      try {
        return decodeURIComponent(input.replace(/\+/g, " "));
      } catch (e) {
        return null;
      }
    }
    function encode(input) {
      try {
        return encodeURIComponent(input);
      } catch (e) {
        return null;
      }
    }
    function querystring(query) {
      var parser = /([^=?#&]+)=?([^&]*)/g, result = {}, part;
      while (part = parser.exec(query)) {
        var key = decode(part[1]), value = decode(part[2]);
        if (key === null || value === null || key in result) continue;
        result[key] = value;
      }
      return result;
    }
    function querystringify(obj, prefix) {
      prefix = prefix || "";
      var pairs = [], value, key;
      if ("string" !== typeof prefix) prefix = "?";
      for (key in obj) {
        if (has.call(obj, key)) {
          value = obj[key];
          if (!value && (value === null || value === undef || isNaN(value))) {
            value = "";
          }
          key = encode(key);
          value = encode(value);
          if (key === null || value === null) continue;
          pairs.push(key + "=" + value);
        }
      }
      return pairs.length ? prefix + pairs.join("&") : "";
    }
    exports2.stringify = querystringify;
    exports2.parse = querystring;
  }
});

// node_modules/url-parse/index.js
var require_url_parse = __commonJS({
  "node_modules/url-parse/index.js"(exports2, module2) {
    "use strict";
    var required = require_requires_port();
    var qs = require_querystringify();
    var controlOrWhitespace = /^[\x00-\x20\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/;
    var CRHTLF = /[\n\r\t]/g;
    var slashes = /^[A-Za-z][A-Za-z0-9+-.]*:\/\//;
    var port = /:\d+$/;
    var protocolre = /^([a-z][a-z0-9.+-]*:)?(\/\/)?([\\/]+)?([\S\s]*)/i;
    var windowsDriveLetter = /^[a-zA-Z]:/;
    function trimLeft(str) {
      return (str ? str : "").toString().replace(controlOrWhitespace, "");
    }
    var rules = [
      ["#", "hash"],
      // Extract from the back.
      ["?", "query"],
      // Extract from the back.
      function sanitize(address, url) {
        return isSpecial(url.protocol) ? address.replace(/\\/g, "/") : address;
      },
      ["/", "pathname"],
      // Extract from the back.
      ["@", "auth", 1],
      // Extract from the front.
      [NaN, "host", void 0, 1, 1],
      // Set left over value.
      [/:(\d*)$/, "port", void 0, 1],
      // RegExp the back.
      [NaN, "hostname", void 0, 1, 1]
      // Set left over.
    ];
    var ignore = { hash: 1, query: 1 };
    function lolcation(loc) {
      var globalVar;
      if (typeof window !== "undefined") globalVar = window;
      else if (typeof global !== "undefined") globalVar = global;
      else if (typeof self !== "undefined") globalVar = self;
      else globalVar = {};
      var location = globalVar.location || {};
      loc = loc || location;
      var finaldestination = {}, type = typeof loc, key;
      if ("blob:" === loc.protocol) {
        finaldestination = new Url(unescape(loc.pathname), {});
      } else if ("string" === type) {
        finaldestination = new Url(loc, {});
        for (key in ignore) delete finaldestination[key];
      } else if ("object" === type) {
        for (key in loc) {
          if (key in ignore) continue;
          finaldestination[key] = loc[key];
        }
        if (finaldestination.slashes === void 0) {
          finaldestination.slashes = slashes.test(loc.href);
        }
      }
      return finaldestination;
    }
    function isSpecial(scheme) {
      return scheme === "file:" || scheme === "ftp:" || scheme === "http:" || scheme === "https:" || scheme === "ws:" || scheme === "wss:";
    }
    function extractProtocol(address, location) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, "");
      location = location || {};
      var match = protocolre.exec(address);
      var protocol = match[1] ? match[1].toLowerCase() : "";
      var forwardSlashes = !!match[2];
      var otherSlashes = !!match[3];
      var slashesCount = 0;
      var rest;
      if (forwardSlashes) {
        if (otherSlashes) {
          rest = match[2] + match[3] + match[4];
          slashesCount = match[2].length + match[3].length;
        } else {
          rest = match[2] + match[4];
          slashesCount = match[2].length;
        }
      } else {
        if (otherSlashes) {
          rest = match[3] + match[4];
          slashesCount = match[3].length;
        } else {
          rest = match[4];
        }
      }
      if (protocol === "file:") {
        if (slashesCount >= 2) {
          rest = rest.slice(2);
        }
      } else if (isSpecial(protocol)) {
        rest = match[4];
      } else if (protocol) {
        if (forwardSlashes) {
          rest = rest.slice(2);
        }
      } else if (slashesCount >= 2 && isSpecial(location.protocol)) {
        rest = match[4];
      }
      return {
        protocol,
        slashes: forwardSlashes || isSpecial(protocol),
        slashesCount,
        rest
      };
    }
    function resolve(relative, base) {
      if (relative === "") return base;
      var path = (base || "/").split("/").slice(0, -1).concat(relative.split("/")), i = path.length, last = path[i - 1], unshift = false, up = 0;
      while (i--) {
        if (path[i] === ".") {
          path.splice(i, 1);
        } else if (path[i] === "..") {
          path.splice(i, 1);
          up++;
        } else if (up) {
          if (i === 0) unshift = true;
          path.splice(i, 1);
          up--;
        }
      }
      if (unshift) path.unshift("");
      if (last === "." || last === "..") path.push("");
      return path.join("/");
    }
    function Url(address, location, parser) {
      address = trimLeft(address);
      address = address.replace(CRHTLF, "");
      if (!(this instanceof Url)) {
        return new Url(address, location, parser);
      }
      var relative, extracted, parse, instruction, index, key, instructions = rules.slice(), type = typeof location, url = this, i = 0;
      if ("object" !== type && "string" !== type) {
        parser = location;
        location = null;
      }
      if (parser && "function" !== typeof parser) parser = qs.parse;
      location = lolcation(location);
      extracted = extractProtocol(address || "", location);
      relative = !extracted.protocol && !extracted.slashes;
      url.slashes = extracted.slashes || relative && location.slashes;
      url.protocol = extracted.protocol || location.protocol || "";
      address = extracted.rest;
      if (extracted.protocol === "file:" && (extracted.slashesCount !== 2 || windowsDriveLetter.test(address)) || !extracted.slashes && (extracted.protocol || extracted.slashesCount < 2 || !isSpecial(url.protocol))) {
        instructions[3] = [/(.*)/, "pathname"];
      }
      for (; i < instructions.length; i++) {
        instruction = instructions[i];
        if (typeof instruction === "function") {
          address = instruction(address, url);
          continue;
        }
        parse = instruction[0];
        key = instruction[1];
        if (parse !== parse) {
          url[key] = address;
        } else if ("string" === typeof parse) {
          index = parse === "@" ? address.lastIndexOf(parse) : address.indexOf(parse);
          if (~index) {
            if ("number" === typeof instruction[2]) {
              url[key] = address.slice(0, index);
              address = address.slice(index + instruction[2]);
            } else {
              url[key] = address.slice(index);
              address = address.slice(0, index);
            }
          }
        } else if (index = parse.exec(address)) {
          url[key] = index[1];
          address = address.slice(0, index.index);
        }
        url[key] = url[key] || (relative && instruction[3] ? location[key] || "" : "");
        if (instruction[4]) url[key] = url[key].toLowerCase();
      }
      if (parser) url.query = parser(url.query);
      if (relative && location.slashes && url.pathname.charAt(0) !== "/" && (url.pathname !== "" || location.pathname !== "")) {
        url.pathname = resolve(url.pathname, location.pathname);
      }
      if (url.pathname.charAt(0) !== "/" && isSpecial(url.protocol)) {
        url.pathname = "/" + url.pathname;
      }
      if (!required(url.port, url.protocol)) {
        url.host = url.hostname;
        url.port = "";
      }
      url.username = url.password = "";
      if (url.auth) {
        index = url.auth.indexOf(":");
        if (~index) {
          url.username = url.auth.slice(0, index);
          url.username = encodeURIComponent(decodeURIComponent(url.username));
          url.password = url.auth.slice(index + 1);
          url.password = encodeURIComponent(decodeURIComponent(url.password));
        } else {
          url.username = encodeURIComponent(decodeURIComponent(url.auth));
        }
        url.auth = url.password ? url.username + ":" + url.password : url.username;
      }
      url.origin = url.protocol !== "file:" && isSpecial(url.protocol) && url.host ? url.protocol + "//" + url.host : "null";
      url.href = url.toString();
    }
    function set(part, value, fn) {
      var url = this;
      switch (part) {
        case "query":
          if ("string" === typeof value && value.length) {
            value = (fn || qs.parse)(value);
          }
          url[part] = value;
          break;
        case "port":
          url[part] = value;
          if (!required(value, url.protocol)) {
            url.host = url.hostname;
            url[part] = "";
          } else if (value) {
            url.host = url.hostname + ":" + value;
          }
          break;
        case "hostname":
          url[part] = value;
          if (url.port) value += ":" + url.port;
          url.host = value;
          break;
        case "host":
          url[part] = value;
          if (port.test(value)) {
            value = value.split(":");
            url.port = value.pop();
            url.hostname = value.join(":");
          } else {
            url.hostname = value;
            url.port = "";
          }
          break;
        case "protocol":
          url.protocol = value.toLowerCase();
          url.slashes = !fn;
          break;
        case "pathname":
        case "hash":
          if (value) {
            var char = part === "pathname" ? "/" : "#";
            url[part] = value.charAt(0) !== char ? char + value : value;
          } else {
            url[part] = value;
          }
          break;
        case "username":
        case "password":
          url[part] = encodeURIComponent(value);
          break;
        case "auth":
          var index = value.indexOf(":");
          if (~index) {
            url.username = value.slice(0, index);
            url.username = encodeURIComponent(decodeURIComponent(url.username));
            url.password = value.slice(index + 1);
            url.password = encodeURIComponent(decodeURIComponent(url.password));
          } else {
            url.username = encodeURIComponent(decodeURIComponent(value));
          }
      }
      for (var i = 0; i < rules.length; i++) {
        var ins = rules[i];
        if (ins[4]) url[ins[1]] = url[ins[1]].toLowerCase();
      }
      url.auth = url.password ? url.username + ":" + url.password : url.username;
      url.origin = url.protocol !== "file:" && isSpecial(url.protocol) && url.host ? url.protocol + "//" + url.host : "null";
      url.href = url.toString();
      return url;
    }
    function toString(stringify) {
      if (!stringify || "function" !== typeof stringify) stringify = qs.stringify;
      var query, url = this, host = url.host, protocol = url.protocol;
      if (protocol && protocol.charAt(protocol.length - 1) !== ":") protocol += ":";
      var result = protocol + (url.protocol && url.slashes || isSpecial(url.protocol) ? "//" : "");
      if (url.username) {
        result += url.username;
        if (url.password) result += ":" + url.password;
        result += "@";
      } else if (url.password) {
        result += ":" + url.password;
        result += "@";
      } else if (url.protocol !== "file:" && isSpecial(url.protocol) && !host && url.pathname !== "/") {
        result += "@";
      }
      if (host[host.length - 1] === ":" || port.test(url.hostname) && !url.port) {
        host += ":";
      }
      result += host + url.pathname;
      query = "object" === typeof url.query ? stringify(url.query) : url.query;
      if (query) result += "?" !== query.charAt(0) ? "?" + query : query;
      if (url.hash) result += url.hash;
      return result;
    }
    Url.prototype = { set, toString };
    Url.extractProtocol = extractProtocol;
    Url.location = lolcation;
    Url.trimLeft = trimLeft;
    Url.qs = qs;
    module2.exports = Url;
  }
});

// src/url.js
var require_url = __commonJS({
  "src/url.js"(exports2, module2) {
    "use strict";
    var ParseURL = require_url_parse();
    module2.exports = function URLCompat(input, base) {
      return new ParseURL(input, base || void 0);
    };
  }
});

// src/html.js
var require_html = __commonJS({
  "src/html.js"(exports2, module2) {
    "use strict";
    var cheerio = require("cheerio-without-node-native");
    var URL = require_url();
    var BASE = "https://www2.pelisforte.se";
    function text(value) {
      return String(value || "").replace(/\s+/g, " ").trim();
    }
    function safeURL(value, base) {
      const input = String(value || "").trim().replace(/&amp;/g, "&").replace(/\\\//g, "/");
      if (!input) return null;
      try {
        const u = new URL(input, base);
        const host = u.hostname.toLowerCase();
        if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.port && u.port !== "80" && u.port !== "443" || !host.includes(".") || /[:\[\]]/.test(host) || /^(?:0x[\da-f]+|\d+)(?:\.(?:0x[\da-f]+|\d+)){0,3}$/i.test(host) || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
        return u.href;
      } catch (_) {
        return null;
      }
    }
    function normalize(value) {
      return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    }
    function searchResults(html, base, mediaType) {
      const $ = cheerio.load(html);
      const seen = {};
      const results = [];
      $("article").each(function(_, article) {
        const item = $(article);
        const anchors = item.find("h2 a, h3 a, .entry-title a, a");
        let url = null;
        anchors.each(function(_2, anchor) {
          const candidate = safeURL($(anchor).attr("href"), base);
          const pattern = mediaType === "series" ? /^\/serie\/[^/]+\/?$/ : /^\/pelicula\/[^/]+\/?$/;
          if (!url && candidate && new URL(candidate).origin === new URL(base).origin && pattern.test(new URL(candidate).pathname)) url = candidate;
        });
        if (!url || seen[url]) return;
        seen[url] = true;
        const title = text(item.find("h2, h3, .entry-title").first().text()) || text(item.find("img").first().attr("alt")).replace(/^Image\s+/i, "");
        const yearMatch = text(item.text()).match(/\b(19\d{2}|20\d{2})\b/);
        results.push({ url, title, year: yearMatch ? Number(yearMatch[1]) : null });
      });
      return results;
    }
    function rankResults(results, details) {
      const titles = (details.titles || [details.title]).map(normalize).filter(Boolean);
      return results.map(function(result) {
        const title = normalize(result.title);
        let score = -1;
        titles.forEach(function(wanted) {
          const words = wanted.split(" ");
          const overlap = words.filter((w) => title.split(" ").includes(w)).length / words.length;
          const candidate = title === wanted ? 100 : overlap >= 0.8 ? 70 + overlap : -1;
          score = Math.max(score, candidate);
        });
        if (details.year && result.year) {
          if (Math.abs(details.year - result.year) > 1) score = -1;
          else if (details.year === result.year) score += score >= 0 ? 10 : 0;
        }
        return Object.assign({}, result, { score });
      }).filter((r) => r.score >= 70).sort((a, b) => b.score - a.score);
    }
    function language(value) {
      if (/latino/i.test(value)) return "Latino";
      if (/castellano|españa/i.test(value)) return "Castellano";
      if (/subtitul/i.test(value)) return "Subtitulado";
      return "Idioma no indicado";
    }
    function playerOptions(html, base) {
      const $ = cheerio.load(html);
      const options = [];
      const seen = {};
      $('[id^="options-"]').each(function(_, element) {
        const item = $(element);
        const id = item.attr("id");
        const frame = item.find("iframe").first();
        const url = safeURL(frame.attr("data-src") || frame.attr("src"), base);
        if (!url || seen[url]) return;
        seen[url] = true;
        let label = "";
        $("a").each(function(_2, a) {
          if ($(a).attr("href") === "#" + id) label = text($(a).text());
        });
        options.push({
          id,
          url,
          language: language(label),
          // Internal diagnostics only. Never copy to visible Nuvio fields.
          sourceLabel: label
        });
      });
      return { title: text($("h1").first().text()), options };
    }
    function stopReason(html) {
      if (/Video\s+Removed|file\s+(?:was\s+)?(?:deleted|not\s+found)|video\s+(?:has\s+been\s+)?removed/i.test(html))
        return "removed";
      if (/cf-chl-|challenges\.cloudflare\.com|verify you(?:'|’)?re a human|verify you are human|Performing security verification/i.test(html))
        return "challenge";
      if (/Video source is unavailable/i.test(html)) return "unavailable";
      if (/Video embed restricted for this domain/i.test(html)) return "referer_restricted";
      return null;
    }
    function followLinks(html, base) {
      const $ = cheerio.load(html);
      const urls = [];
      const push = (value) => {
        const url = safeURL(value, base);
        if (url && !urls.includes(url)) urls.push(url);
      };
      $("iframe").each(function(_, frame) {
        push($(frame).attr("data-src") || $(frame).attr("src"));
      });
      const re = /(?:window\.)?location\.(?:replace|assign)\(\s*(["'])([^"'\\]+)\1\s*\)|(?:window\.)?location(?:\.href)?\s*=\s*(["'])([^"'\\]+)\3/g;
      let match;
      while (match = re.exec(html)) push(match[2] || match[4]);
      $("meta[http-equiv]").each(function(_, element) {
        if (String($(element).attr("http-equiv")).toLowerCase() !== "refresh") return;
        const m = /url\s*=\s*["']?([^"']+)$/i.exec($(element).attr("content") || "");
        if (m) push(m[1].trim());
      });
      return urls.slice(0, 4);
    }
    function mediaLinks(html, base) {
      const $ = cheerio.load(html);
      const values = [];
      $("source, video").each(function(_, element) {
        const src = $(element).attr("src");
        if (src) values.push(src);
      });
      const re = /(?:["']?(?:file|hls|mp4|src)["']?)\s*:\s*(["'])((?:\\.|(?!\1).)+)\1/g;
      let match;
      while (match = re.exec(html)) values.push(match[2]);
      return values.map((v) => safeURL(v, base)).filter(function(url, index, all) {
        return url && /\.(?:m3u8|mp4)(?:$|\?)/i.test(url) && all.indexOf(url) === index;
      }).slice(0, 8);
    }
    function parseHLS(body, base) {
      const lines = String(body || "").replace(/^\uFEFF/, "").trim().split(/\r?\n/);
      if (lines[0] !== "#EXTM3U") throw new Error("invalid_hls");
      if (/#EXT-X-SESSION-KEY|KEYFORMAT\s*=|METHOD=(?!NONE|AES-128)[A-Z0-9-]+/i.test(body)) throw new Error("drm_unsupported");
      const variants = [];
      for (let i = 0; i < lines.length; i++) {
        if (!/^#EXT-X-STREAM-INF:/.test(lines[i])) continue;
        const resolution = /RESOLUTION=(\d+)x(\d+)/i.exec(lines[i]);
        const width = resolution ? Number(resolution[1]) : 0;
        const height = resolution ? Number(resolution[2]) : 0;
        const bandwidth = Number((/(?:[:,])BANDWIDTH=(\d+)/.exec(lines[i]) || [])[1] || 0);
        let j = i + 1;
        while (j < lines.length && (!lines[j].trim() || /^#/.test(lines[j]))) j++;
        const url = safeURL(lines[j], base);
        if (url) variants.push({ url, width, height, bandwidth });
      }
      const segmentLine = lines.find((line) => line.trim() && !/^#/.test(line));
      const init = /#EXT-X-MAP:.*?URI="([^"]+)"/.exec(body);
      const key = /#EXT-X-KEY:.*?METHOD=AES-128.*?URI="([^"]+)"/.exec(body);
      return {
        variants: variants.sort((a, b) => b.height - a.height || b.bandwidth - a.bandwidth),
        externalGroups: /#EXT-X-MEDIA:[^\r\n]*(?:TYPE=AUDIO|TYPE=SUBTITLES)[^\r\n]*URI=/i.test(body),
        segment: segmentLine ? safeURL(segmentLine.trim(), base) : null,
        init: init ? safeURL(init[1], base) : null,
        key: key ? safeURL(key[1], base) : null
      };
    }
    module2.exports = {
      BASE,
      text,
      safeURL,
      normalize,
      searchResults,
      rankResults,
      playerOptions,
      stopReason,
      followLinks,
      mediaLinks,
      parseHLS
    };
  }
});

// src/unpack.js
var require_unpack = __commonJS({
  "src/unpack.js"(exports2, module2) {
    "use strict";
    function literal(input) {
      if (!input || input.length > 5e5 || !/^['"]/.test(input) || input[input.length - 1] !== input[0]) throw new Error("invalid_literal");
      let output = "";
      const escapes = { n: "\n", r: "\r", t: "	", b: "\b", f: "\f", v: "\v", "0": "\0" };
      for (let i = 1; i < input.length - 1; i++) {
        if (input[i] !== "\\") {
          output += input[i];
          continue;
        }
        const next = input[++i];
        if (next === "\n") continue;
        if (next === "x" || next === "u") {
          const size = next === "x" ? 2 : 4;
          const digits = input.slice(i + 1, i + 1 + size);
          if (!new RegExp("^[a-fA-F0-9]{" + size + "}$").test(digits)) throw new Error("invalid_escape");
          output += String.fromCharCode(parseInt(digits, 16));
          i += size;
        } else if (Object.prototype.hasOwnProperty.call(escapes, next)) output += escapes[next];
        else if (next === "\\" || next === "'" || next === '"' || next === "/") output += next;
        else throw new Error("unsupported_escape");
      }
      return output;
    }
    function unpack(input) {
      if (!input || input.length > 2e6) return [];
      const quoted = `('(?:\\\\.|[^'\\\\])*'|"(?:\\\\.|[^"\\\\])*")`;
      const expression = new RegExp("\\}\\(\\s*" + quoted + "\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*" + quoted + `\\.split\\(\\s*[\\'"]\\|[\\'"]\\s*\\)`, "g");
      const outputs = [];
      let match;
      while ((match = expression.exec(input)) && outputs.length < 3) {
        const radix = Number(match[2]);
        const count = Number(match[3]);
        if (radix < 2 || radix > 36 || count > 5e3) continue;
        try {
          const payload = literal(match[1]);
          const dictionary = literal(match[4]).split("|");
          if (dictionary.length > 5e3) continue;
          const expanded = payload.replace(/\b[0-9a-z]+\b/g, function(token) {
            const index = parseInt(token, radix);
            return Number.isFinite(index) && index < count && index.toString(radix) === token && dictionary[index] ? dictionary[index] : token;
          });
          if (expanded.length < 1e6) outputs.push(expanded);
        } catch (_) {
        }
      }
      return outputs;
    }
    module2.exports = { literal, unpack };
  }
});

// src/extractor-constants.js
var require_extractor_constants = __commonJS({
  "src/extractor-constants.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      UA: "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    };
  }
});

// src/catalog-html.js
var require_catalog_html = __commonJS({
  "src/catalog-html.js"(exports2, module2) {
    "use strict";
    var cheerio = require("cheerio-without-node-native");
    var { safeURL, text } = require_html();
    var URL = require_url();
    function cleanDescription(value) {
      return text(value).replace(/pelisforte/gi, "sky latino");
    }
    function posterURL(value, base) {
      const url = safeURL(value, base);
      return url && !/\/(?:fbpf|logo|netflix|disney)[^/]*\.(?:jpg|png|webp)/i.test(url) ? url : void 0;
    }
    function sourceID(type, url) {
      const slug = new URL(url).pathname.split("/").filter(Boolean)[1];
      return "sky:" + (type === "series" ? "s:" : "m:") + slug;
    }
    function parseID(id) {
      const match = /^sky:([ms]):([a-z0-9-]{1,200})(?::(\d{1,3}):(\d{1,4}))?$/.exec(id);
      if (!match || match[1] === "m" && match[4]) return null;
      return {
        type: match[1] === "s" ? "series" : "movie",
        slug: match[2],
        season: match[3] ? Number(match[3]) : null,
        episode: match[4] ? Number(match[4]) : null
      };
    }
    function cards(html, base, type) {
      const $ = cheerio.load(html);
      const seen = {};
      const results = [];
      const list = $(".post-lst").first();
      const articles = list.length ? list.find("article") : $("article");
      articles.each(function(_, element) {
        const item = $(element);
        let url;
        let itemType;
        item.find("a").each(function(_2, link) {
          const candidate = safeURL($(link).attr("href"), base);
          if (!candidate || new URL(candidate).origin !== new URL(base).origin) return;
          const route = /^\/(pelicula|serie)\/[a-z0-9-]+\/?$/i.exec(new URL(candidate).pathname);
          if (!route) return;
          itemType = route[1] === "serie" ? "series" : "movie";
          if (type && itemType !== type) return;
          url = candidate;
        });
        if (!url || seen[url]) return;
        seen[url] = true;
        const name = text(item.find(".entry-title, h2, h3").first().text());
        if (!name) return;
        const year = (text(item.find(".year, .post-yr, .entry-meta, .post-ql").text()).match(/\b(19\d{2}|20\d{2})\b/) || [])[1];
        const img = item.find("img").first();
        const poster = posterURL(img.attr("data-src") || img.attr("src"), base);
        const meta = { id: sourceID(itemType, url), type: itemType, name, posterShape: "poster" };
        if (poster) meta.poster = poster;
        if (year) meta.releaseInfo = year;
        results.push({ url, meta });
      });
      const next = [];
      $("a[href]").each(function(_, element) {
        const url = safeURL($(element).attr("href"), base);
        if (url && new URL(url).origin === new URL(base).origin && /\/page\/\d+\/?/.test(url) && !next.includes(url)) next.push(url);
      });
      return { items: results, pagination: next };
    }
    function episodeLinks(html, base, seriesID) {
      const $ = cheerio.load(html);
      const found = {};
      const episodes = [];
      const listLinks = $("#episode_by_temp a[href]");
      const episodeCards = $("article.episodes a[href]");
      const links = listLinks.length ? listLinks : episodeCards.length ? episodeCards : $("a[href]");
      links.each(function(_, element) {
        const link = $(element);
        const url = safeURL(link.attr("href"), base);
        if (!url || new URL(url).origin !== new URL(base).origin || !/^\/episodio\/[a-z0-9-]+\/?$/.test(new URL(url).pathname)) return;
        const candidate = text(link.closest("article, li").text()) + " " + new URL(url).pathname;
        const number = /(?:^|[\s/-])(\d{1,3})x(\d{1,4})(?:$|[\s/-])/i.exec(candidate);
        if (!number) return;
        const season = Number(number[1]), episode = Number(number[2]);
        const id = seriesID + ":" + season + ":" + episode;
        if (found[id]) return;
        found[id] = true;
        episodes.push({ id, title: text(link.closest("article").find("h2,h3,.entry-title").first().text()) || season + "\xD7" + episode, season, episode, url });
      });
      return episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
    }
    function detail(html, url, type) {
      const $ = cheerio.load(html);
      const id = sourceID(type, url);
      const name = text($("h1").first().text());
      if (!name || /(?:404|no encontrado|not found)/i.test(name)) throw new Error("not_found");
      const poster = posterURL($(".post-thumbnail img, .poster img").first().attr("src"), url);
      const description = cleanDescription($(".description, .entry-content").first().text()).slice(0, 2e3);
      const year = ($("title").text().match(/\((19\d{2}|20\d{2})\)/) || [])[1];
      const meta = { id, type, name, posterShape: "poster" };
      if (poster) meta.poster = poster;
      if (description) meta.description = description;
      if (year) meta.releaseInfo = year;
      if (type === "series") {
        meta.videos = episodeLinks(html, url, id).map(function(episode) {
          const video = Object.assign({}, episode);
          delete video.url;
          return video;
        });
      }
      const seasons = [];
      $("[data-season]").each(function(_, element) {
        const number = Number($(element).attr("data-season"));
        if (Number.isInteger(number) && number > 0 && number <= 100 && !seasons.includes(number)) seasons.push(number);
      });
      const inline = html.match(/var\s+torofilm_public\s*=\s*(\{[^;]+\})/);
      let ajax;
      try {
        ajax = inline ? JSON.parse(inline[1]) : null;
      } catch (_) {
        ajax = null;
      }
      const post = $("[data-post][data-season]").first().attr("data-post");
      return { meta, episodes: episodeLinks(html, url, id), seasons, ajax, post };
    }
    module2.exports = { cards, detail, episodeLinks, sourceID, parseID, cleanDescription };
  }
});

// src/source.js
var require_source = __commonJS({
  "src/source.js"(exports2, module2) {
    "use strict";
    var h = require_html();
    var c = require_catalog_html();
    var URL = require_url();
    var { UA } = require_extractor_constants();
    function createSource(options) {
      options = options || {};
      const base = options.base || h.BASE;
      const fetcher = options.fetch || fetch;
      const cache = options.cache || /* @__PURE__ */ new Map();
      function get(url, init) {
        const key = url + (init && init.body || "");
        const existing = cache.get(key);
        if (existing && existing.expires > Date.now()) return Promise.resolve(existing.body);
        return Promise.resolve().then(() => fetcher(url, Object.assign({
          headers: { "User-Agent": UA, Referer: base + "/" }
        }, init || {}))).then(function(response) {
          if (!response || response.status < 200 || response.status >= 300) throw new Error("source_unavailable");
          return response.text();
        }).then(function(body) {
          if (body.length > 2e6 || h.stopReason(body)) throw new Error("source_unavailable");
          cache.set(key, { body, expires: Date.now() + 12e4 });
          if (cache.size > 300) cache.delete(cache.keys().next().value);
          return body;
        });
      }
      function pageURL(type, page, query) {
        if (query) return base + (page > 1 ? "/page/" + page + "/" : "/") + "?s=" + encodeURIComponent(query);
        if (type === "series") return page === 1 ? base + "/series-1746289646" : null;
        return page === 1 ? base + "/portal003" : base + "/todas-las-peliculas/page/" + page;
      }
      function catalog(type, query, skip) {
        if (!["movie", "series"].includes(type)) return Promise.reject(new Error("invalid_type"));
        const page = Math.floor((skip || 0) / 20) + 1;
        const url = pageURL(type, page, query);
        if (!url) return Promise.resolve([]);
        return get(url).then((body) => c.cards(body, base, type).items.slice((skip || 0) % 20).map((item) => item.meta));
      }
      function urlFor(parsed) {
        return base + (parsed.type === "series" ? "/serie/" : "/pelicula/") + parsed.slug;
      }
      function metadata(id) {
        const parsed = c.parseID(id);
        if (!parsed || parsed.season !== null) return Promise.reject(new Error("invalid_id"));
        const url = urlFor(parsed);
        return get(url).then(function(body) {
          const result = c.detail(body, url, parsed.type);
          if (parsed.type !== "series" || !result.ajax || !result.post || !result.ajax.nonce) return result.meta;
          const known = {};
          result.episodes.forEach((ep) => {
            known[ep.season] = true;
          });
          const missing = result.seasons.filter((season) => !known[season]).slice(0, 3);
          return missing.reduce(function(chain, season) {
            return chain.then(function() {
              const endpoint = h.safeURL(result.ajax.url, base);
              if (!endpoint || new URL(endpoint).origin !== new URL(base).origin) return;
              return get(endpoint, {
                method: "POST",
                headers: { "User-Agent": UA, Referer: url, "Content-Type": "application/x-www-form-urlencoded" },
                body: "action=action_select_season&nonce=" + encodeURIComponent(result.ajax.nonce) + "&season=" + season + "&post=" + encodeURIComponent(result.post)
              }).then(function(fragment) {
                result.episodes = result.episodes.concat(c.episodeLinks(fragment, url, id));
              }).catch(function() {
              });
            });
          }, Promise.resolve()).then(function() {
            const seen = {};
            result.meta.videos = result.episodes.sort((a, b) => a.season - b.season || a.episode - b.episode).filter(function(ep) {
              if (seen[ep.id]) return false;
              seen[ep.id] = true;
              return true;
            }).map(function(ep) {
              const video = Object.assign({}, ep);
              delete video.url;
              return video;
            });
            return result.meta;
          });
        });
      }
      function findEpisode(seriesURL, season, episode) {
        return get(seriesURL).then(function(body) {
          const result = c.detail(body, seriesURL, "series");
          const found = result.episodes.find((ep) => ep.season === season && ep.episode === episode);
          if (found) return found.url;
          const endpoint = result.ajax && h.safeURL(result.ajax.url, base);
          if (!result.seasons.includes(season) || !endpoint || new URL(endpoint).origin !== new URL(base).origin || !result.post)
            throw new Error("episode_unavailable");
          return get(endpoint, {
            method: "POST",
            headers: { "User-Agent": UA, Referer: seriesURL, "Content-Type": "application/x-www-form-urlencoded" },
            body: "action=action_select_season&nonce=" + encodeURIComponent(result.ajax.nonce || "") + "&season=" + season + "&post=" + encodeURIComponent(result.post)
          }).then(function(fragment) {
            const observed = c.episodeLinks(fragment, seriesURL, result.meta.id).find((ep) => ep.season === season && ep.episode === episode);
            if (!observed) throw new Error("episode_unavailable");
            return observed.url;
          }).catch(function() {
            throw new Error("episode_unavailable");
          });
        });
      }
      function playbackPage(id) {
        const parsed = c.parseID(id);
        if (!parsed) return Promise.reject(new Error("invalid_id"));
        if (parsed.type === "movie") return Promise.resolve(urlFor(parsed));
        if (parsed.season === null || parsed.episode === null) return Promise.reject(new Error("episode_required"));
        return findEpisode(urlFor(parsed), parsed.season, parsed.episode);
      }
      return { catalog, metadata, playbackPage, findEpisode, get };
    }
    module2.exports = { createSource };
  }
});

// src/extractor.js
var require_extractor = __commonJS({
  "src/extractor.js"(exports2, module2) {
    "use strict";
    var html = require_html();
    var URL = require_url();
    var { unpack } = require_unpack();
    var { UA } = require_extractor_constants();
    function createExtractor2(config) {
      config = config || {};
      const fetcher = config.fetch || fetch;
      const base = config.base || html.BASE;
      const diagnostics = [];
      const deadline = Date.now() + (config.budgetMs || 22e3);
      let requestCount = 0;
      function note(stage, url, status, detail) {
        diagnostics.push({ stage, host: url ? new URL(url).hostname : "", status, detail: detail || "" });
      }
      function request(url, referer, options) {
        options = options || {};
        url = html.safeURL(url, base);
        if (!url) return Promise.reject(new Error("unsafe_url"));
        if (Date.now() > deadline || ++requestCount > (config.maxRequests || 24))
          return Promise.reject(new Error("request_budget"));
        const headers = { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9,en;q=0.5" };
        if (referer) headers.Referer = referer;
        if (options.range) headers.Range = "bytes=0-1023";
        const init = { method: options.method || "GET", headers, redirect: "follow" };
        return Promise.resolve().then(() => fetcher(url, init)).then(function(r) {
          if (!r || r.status < 200 || r.status >= 300) throw new Error("http_" + (r && r.status));
          const resolved = html.safeURL(r.url || url, url);
          if (!resolved) throw new Error("unsafe_redirect");
          const header = function(name) {
            return r.headers && (typeof r.headers.get === "function" ? r.headers.get(name) : r.headers[name]);
          };
          const type = String(header("content-type") || "").toLowerCase();
          if (options.headersOnly) {
            if (r.body && typeof r.body.cancel === "function") {
              const cancelled = r.body.cancel();
              if (cancelled && cancelled.catch) cancelled.catch(function() {
              });
            }
            return { url: resolved, type, status: r.status, body: "" };
          }
          if (/^video\//.test(type)) throw new Error("binary_as_text");
          const length = Number(header("content-length") || 0);
          if (length > 2e6) throw new Error("response_too_large");
          return r.text().then(function(body) {
            if (body.length > 2e6 || /\n\.\.\.\[truncated\]\s*$/.test(body)) throw new Error("response_too_large");
            return { url: resolved, type, status: r.status, body };
          });
        });
      }
      function probe(url, referer, allowedType) {
        return request(url, referer, { method: "HEAD", headersOnly: true }).then(function(response) {
          if (!allowedType.test(response.type)) throw new Error("not_media_mime");
          return response;
        });
      }
      function verify(url, referer) {
        if (/\.m3u8(?:$|\?)/i.test(url)) {
          return request(url, referer).then(function(master) {
            const parsed = html.parseHLS(master.body, master.url);
            const best = parsed.variants[0];
            const media = best ? request(best.url, referer) : Promise.resolve(master);
            return media.then(function(playlist) {
              const p = html.parseHLS(playlist.body, playlist.url);
              if (p.variants.length || !p.segment) throw new Error("missing_media_playlist");
              const checks = [probe(p.segment, referer, /^(?:video\/|audio\/|application\/(?:octet-stream|mp2t))/)];
              if (p.init) checks.push(probe(p.init, referer, /^(?:video\/|audio\/|application\/octet-stream)/));
              if (p.key) checks.push(probe(p.key, referer, /^(?:application\/octet-stream|binary\/octet-stream)/));
              return Promise.all(checks).then(function() {
                const adaptive = !!best && parsed.externalGroups;
                return {
                  url: best && !adaptive ? playlist.url : master.url,
                  quality: best && best.height ? best.height + "p" : "Calidad no verificada",
                  width: best ? best.width : 0,
                  height: best ? best.height : 0,
                  adaptive,
                  format: "m3u8",
                  referer
                };
              });
            });
          });
        }
        return probe(url, referer, /^video\/(?:mp4|x-m4v)/).then(function(response) {
          return { url: response.url, quality: "Calidad no verificada", height: 0, adaptive: false, format: "mp4", referer };
        });
      }
      function resolve(url, referer, visited, depth) {
        visited = visited || {};
        depth = depth || 0;
        if (depth > 5 || visited[url]) return Promise.resolve([]);
        visited[url] = true;
        if (/\.(?:m3u8|mp4)(?:$|\?)/i.test(url) && !/\/(?:e|embed|d|file|download)\//i.test(new URL(url).pathname)) {
          return verify(url, referer).then((s) => [s]).catch(function(error) {
            note("verify", url, error.message);
            return [];
          });
        }
        return request(url, referer).then(function(page) {
          if (page.url !== url) note("redirect", page.url, "resolved");
          const reason = html.stopReason(page.body);
          if (reason) {
            note("resolve", page.url, reason);
            return [];
          }
          const expanded = unpack(page.body);
          if (expanded.length) note("unpack", page.url, "static_dictionary", String(expanded.length));
          const direct = html.mediaLinks(page.body + "\n" + expanded.join("\n"), page.url);
          const nested = html.followLinks(page.body, page.url);
          if (!direct.length && !nested.length) note(
            "resolve",
            page.url,
            /<script[^>]*\bsrc=|<div[^>]*id=["']root["']/i.test(page.body) ? "dynamic_player_unsupported" : "no_media"
          );
          const tasks = direct.map((link) => () => verify(link, page.url).then((s) => [s]).catch(function(error) {
            note("verify", link, error.message);
            return [];
          })).concat(nested.map((link) => () => resolve(link, page.url, visited, depth + 1)));
          return sequence(tasks).then((groups) => [].concat.apply([], groups));
        }).catch(function(error) {
          note("resolve", url, error.message);
          return [];
        });
      }
      function sequence(tasks) {
        return tasks.reduce((chain, task) => chain.then(function(all) {
          if (Date.now() > deadline) {
            note("budget", "", "deadline");
            return all;
          }
          return task().then((value) => all.concat([value]));
        }), Promise.resolve([]));
      }
      function inspect(pageURL) {
        if (new URL(pageURL).origin !== new URL(base).origin || !/^\/(?:pelicula|episodio)\/[^/]+\/?$/.test(new URL(pageURL).pathname))
          return Promise.reject(new Error("invalid_movie_page"));
        return request(pageURL, base + "/").then(function(page) {
          const reason = html.stopReason(page.body);
          if (reason) throw new Error(reason);
          const parsed = html.playerOptions(page.body, page.url);
          note("options", page.url, "found", String(parsed.options.length));
          return sequence(parsed.options.slice(0, 9).map((option) => function() {
            return resolve(option.url, page.url, {}, 0).then(function(streams) {
              return streams.map((s) => Object.assign({}, s, { language: option.language }));
            });
          })).then(function(groups) {
            const seen = {};
            const streams = [].concat.apply([], groups).filter(function(stream) {
              const key = stream.url + "\n" + stream.language + "\n" + stream.referer;
              if (seen[key]) return false;
              seen[key] = true;
              return true;
            }).sort((a, b) => b.height - a.height);
            return {
              title: parsed.title,
              pageURL: page.url,
              options: parsed.options,
              streams: present(streams),
              diagnostics: diagnostics.slice()
            };
          });
        });
      }
      function present(streams) {
        return streams.map(function(stream, index) {
          const dimensions = stream.width && stream.height ? stream.width + "\xD7" + stream.height : stream.quality;
          const quality = stream.adaptive && stream.height ? "Hasta " + dimensions : dimensions;
          return {
            name: "sky latino",
            title: stream.language + " \xB7 Opci\xF3n " + (index + 1) + " \xB7 " + quality,
            url: stream.url,
            quality: stream.quality,
            language: stream.language === "Subtitulado" || stream.language === "Idioma no indicado" ? "und" : "es",
            headers: { Referer: stream.referer, "User-Agent": UA },
            subtitles: [],
            behaviorHints: { notWebReady: true, proxyHeaders: { request: { Referer: stream.referer, "User-Agent": UA } } }
          };
        });
      }
      function search(details) {
        const titles = (details.titles || [details.title]).filter(Boolean);
        return sequence(titles.slice(0, 2).map((title) => function() {
          const url = base + "/?s=" + encodeURIComponent(title);
          return request(url, base + "/").then(function(page) {
            const reason = html.stopReason(page.body);
            if (reason) throw new Error(reason);
            return html.searchResults(page.body, base, details.type);
          }).catch(function(error) {
            note("search", url, error.message);
            return [];
          });
        })).then(function(groups) {
          const ranked = html.rankResults([].concat.apply([], groups), details);
          const seen = {};
          return ranked.filter(function(item) {
            if (seen[item.url]) return false;
            seen[item.url] = true;
            return true;
          });
        });
      }
      function extract(details) {
        return search(details).then(function(matches) {
          if (!matches.length) return { streams: [], diagnostics: diagnostics.concat([{ stage: "match", status: "no_exact_match" }]) };
          if (details.type === "series") {
            const { createSource } = require_source();
            return createSource({ fetch: fetcher, base }).findEpisode(matches[0].url, details.season, details.episode).then(inspect).catch(function(error) {
              return { streams: [], diagnostics: diagnostics.concat([{ stage: "episode", status: error.message }]) };
            });
          }
          return inspect(matches[0].url);
        });
      }
      return { inspect, search, extract, resolve, verify, diagnostics };
    }
    module2.exports = { createExtractor: createExtractor2, UA };
  }
});

// src/index.js
var { createExtractor } = require_extractor();
function getStreams(tmdbId, mediaType, season, episode) {
  if (!["movie", "tv", "series"].includes(mediaType) || !/^\d+$/.test(String(tmdbId))) return Promise.resolve([]);
  const isSeries = mediaType !== "movie";
  if (isSeries && (!Number.isInteger(Number(season)) || !Number.isInteger(Number(episode)) || Number(season) < 1 || Number(episode) < 1)) return Promise.resolve([]);
  const key = typeof globalThis !== "undefined" && globalThis.TMDB_API_KEY;
  if (!key) return Promise.resolve([]);
  const id = encodeURIComponent(String(tmdbId));
  const url = "https://api.themoviedb.org/3/" + (isSeries ? "tv/" : "movie/") + id + "?language=es-MX&api_key=" + encodeURIComponent(key);
  return Promise.resolve().then(() => fetch(url)).then(function(response) {
    if (!response.ok) throw new Error("metadata_unavailable");
    return response.json();
  }).then(function(meta) {
    if (!meta || !meta.title && !meta.original_title && !meta.name) return [];
    return createExtractor().extract({
      titles: [meta.title || meta.name, meta.original_title || meta.original_name].filter(Boolean),
      year: Number(String(meta.release_date || meta.first_air_date || "").slice(0, 4)) || null,
      type: isSeries ? "series" : "movie",
      season: Number(season),
      episode: Number(episode)
    }).then((report) => report.streams);
  }).catch(function() {
    return [];
  });
}
module.exports = { getStreams };
