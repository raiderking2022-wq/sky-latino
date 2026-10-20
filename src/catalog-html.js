'use strict';
const cheerio = require('cheerio-without-node-native');
const { safeURL, text } = require('./html');
const URL = require('./url');

function cleanDescription(value) {
  return text(value).replace(/pelisforte/gi, 'sky latino');
}
function posterURL(value, base) {
  const url = safeURL(value, base);
  // These are source branding placeholders, not posters.
  return url && !/\/(?:fbpf|logo|netflix|disney)[^/]*\.(?:jpg|png|webp)/i.test(url) ? url : undefined;
}
function sourceID(type, url) {
  const slug = new URL(url).pathname.split('/').filter(Boolean)[1];
  return 'sky:' + (type === 'series' ? 's:' : 'm:') + slug;
}
function parseID(id) {
  const match = /^sky:([ms]):([a-z0-9-]{1,200})(?::(\d{1,3}):(\d{1,4}))?$/.exec(id);
  if (!match || (match[1] === 'm' && match[4])) return null;
  return {
    type: match[1] === 's' ? 'series' : 'movie',
    slug: match[2],
    season: match[3] ? Number(match[3]) : null,
    episode: match[4] ? Number(match[4]) : null
  };
}
function cards(html, base, type) {
  const $ = cheerio.load(html);
  const seen = {};
  const results = [];
  const list = $('.post-lst').first();
  const articles = list.length ? list.find('article') : $('article');
  articles.each(function (_, element) {
    const item = $(element);
    let url;
    let itemType;
    item.find('a').each(function (_, link) {
      const candidate = safeURL($(link).attr('href'), base);
      if (!candidate || new URL(candidate).origin !== new URL(base).origin) return;
      const route = /^\/(pelicula|serie)\/[a-z0-9-]+\/?$/i.exec(new URL(candidate).pathname);
      if (!route) return;
      itemType = route[1] === 'serie' ? 'series' : 'movie';
      if (type && itemType !== type) return;
      url = candidate;
    });
    if (!url || seen[url]) return;
    seen[url] = true;
    const name = text(item.find('.entry-title, h2, h3').first().text());
    if (!name) return;
    const year = (text(item.find('.year, .post-yr, .entry-meta, .post-ql').text()).match(/\b(19\d{2}|20\d{2})\b/) || [])[1];
    const img = item.find('img').first();
    const poster = posterURL(img.attr('data-src') || img.attr('src'), base);
    const meta = { id: sourceID(itemType, url), type: itemType, name, posterShape: 'poster' };
    if (poster) meta.poster = poster;
    if (year) meta.releaseInfo = year;
    results.push({ url, meta });
  });
  const next = [];
  $('a[href]').each(function (_, element) {
    const url = safeURL($(element).attr('href'), base);
    if (url && new URL(url).origin === new URL(base).origin && /\/page\/\d+\/?/.test(url) && !next.includes(url)) next.push(url);
  });
  return { items: results, pagination: next };
}
function episodeLinks(html, base, seriesID) {
  const $ = cheerio.load(html);
  const found = {};
  const episodes = [];
  const listLinks = $('#episode_by_temp a[href]');
  const episodeCards = $('article.episodes a[href]');
  const links = listLinks.length ? listLinks : episodeCards.length ? episodeCards : $('a[href]');
  links.each(function (_, element) {
    const link = $(element);
    const url = safeURL(link.attr('href'), base);
    if (!url || new URL(url).origin !== new URL(base).origin ||
        !/^\/episodio\/[a-z0-9-]+\/?$/.test(new URL(url).pathname)) return;
    const candidate = text(link.closest('article, li').text()) + ' ' + new URL(url).pathname;
    const number = /(?:^|[\s/-])(\d{1,3})x(\d{1,4})(?:$|[\s/-])/i.exec(candidate);
    if (!number) return;
    const season = Number(number[1]), episode = Number(number[2]);
    const id = seriesID + ':' + season + ':' + episode;
    if (found[id]) return;
    found[id] = true;
    episodes.push({ id, title: text(link.closest('article').find('h2,h3,.entry-title').first().text()) || season + '×' + episode, season, episode, url });
  });
  return episodes.sort((a, b) => a.season - b.season || a.episode - b.episode);
}
function detail(html, url, type) {
  const $ = cheerio.load(html);
  const id = sourceID(type, url);
  const name = text($('h1').first().text());
  if (!name || /(?:404|no encontrado|not found)/i.test(name)) throw new Error('not_found');
  const poster = posterURL($('.post-thumbnail img, .poster img').first().attr('src'), url);
  const description = cleanDescription($('.description, .entry-content').first().text()).slice(0, 2000);
  const year = ($('title').text().match(/\((19\d{2}|20\d{2})\)/) || [])[1];
  const meta = { id, type, name, posterShape: 'poster' };
  if (poster) meta.poster = poster;
  if (description) meta.description = description;
  if (year) meta.releaseInfo = year;
  if (type === 'series') {
    meta.videos = episodeLinks(html, url, id).map(function (episode) {
      const video = Object.assign({}, episode); delete video.url; return video;
    });
  }
  const seasons = [];
  $('[data-season]').each(function (_, element) {
    const number = Number($(element).attr('data-season'));
    if (Number.isInteger(number) && number > 0 && number <= 100 && !seasons.includes(number)) seasons.push(number);
  });
  const inline = html.match(/var\s+torofilm_public\s*=\s*(\{[^;]+\})/);
  let ajax;
  try { ajax = inline ? JSON.parse(inline[1]) : null; } catch (_) { ajax = null; }
  const post = $('[data-post][data-season]').first().attr('data-post');
  return { meta, episodes: episodeLinks(html, url, id), seasons, ajax, post };
}

module.exports = { cards, detail, episodeLinks, sourceID, parseID, cleanDescription };
