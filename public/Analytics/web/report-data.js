(() => {
  const dayMs = 86_400_000;
  const dateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi', year: 'numeric', month: '2-digit', day: '2-digit' });
  const shortDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
  const longDate = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
  const numbers = new Intl.NumberFormat('en-KE');
  const rangeKey = 'nicooReportRangeV2';
  const presets = [7, 30, 90];
  // Each sampled visitor represents eight demo visitors with the same activity.
  const trafficMultiplier = 8;
  const realtimeStepMs = 6_000;

  const locations = [
    ['Kenya', 62, ['Nairobi', 'Mombasa', 'Nakuru', 'Kisumu', 'Eldoret']],
    ['Uganda', 12, ['Kampala', 'Entebbe']],
    ['Tanzania', 10, ['Dar es Salaam', 'Arusha']],
    ['Rwanda', 5, ['Kigali']],
    ['South Africa', 4, ['Johannesburg', 'Cape Town']],
    ['Nigeria', 3, ['Lagos', 'Abuja']],
    ['Ethiopia', 2, ['Addis Ababa']],
    ['Burundi', 1, ['Bujumbura']],
    ['South Sudan', 1, ['Juba']],
  ];
  const channels = [
    ['Organic Search', 42, 'google'],
    ['Direct', 29, '(direct)'],
    ['Organic Social', 11, 'instagram.com'],
    ['Referral', 8, 'partner sites'],
    ['Paid Search', 6, 'google / cpc'],
    ['Email', 3, 'newsletter'],
    ['Unassigned', 1, '(unassigned)'],
  ];
  const pageWeights = [
    ['Home', 35], ['Collection', 29], ['About', 11], ['Visit', 10],
    ['Checkout', 6], ['Account', 5], ['Sign in', 4],
  ];
  const pageNames = Object.fromEntries(pageWeights.map(([page]) => [page, 'Nicoo Furniture Hub – ' + page]));
  const devices = [
    ['mobile', 76, [['Chrome', 65], ['Safari', 21], ['Samsung Internet', 10], ['Firefox', 4]],
      [['Android', 78], ['iOS', 22]], [['360×800', 55], ['390×844', 45]]],
    ['desktop', 20, [['Chrome', 64], ['Edge', 16], ['Safari', 12], ['Firefox', 8]],
      [['Windows', 73], ['macOS', 20], ['Linux', 7]], [['1920×1080', 60], ['1366×768', 40]]],
    ['tablet', 4, [['Chrome', 59], ['Safari', 41]],
      [['Android', 58], ['iPadOS', 42]], [['800×1280', 60], ['820×1180', 40]]],
  ];
  const ageBands = [['18–24', 19], ['25–34', 36], ['35–44', 26], ['45–54', 12], ['55–64', 5], ['65+', 2]];
  const languages = [['English', 70], ['Swahili', 24], ['French', 5], ['Other', 1]];
  const providersByCountry = {
    Kenya: [['Safaricom', 65], ['Airtel Kenya', 22], ['Other', 13]],
  };
  const eventNames = ['page_view', 'session_start', 'user_engagement', 'first_visit', 'scroll', 'click', 'form_start', 'form_submit'];

  function random(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let value = Math.imul(state ^ (state >>> 15), state | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pick(rows, rng) {
    let target = rng() * rows.reduce((sum, row) => sum + row[1], 0);
    return rows.find(row => (target -= row[1]) < 0);
  }

  function isoDay(day) { return new Date(day * dayMs).toISOString().slice(0, 10); }
  function today() { return Date.parse(dateFormat.format(new Date()) + 'T00:00:00Z') / dayMs; }
  function dateLabel(day, withYear = false) { return (withYear ? longDate : shortDate).format(day * dayMs); }
  function makeRange(start, end, days = null, compare = true) { return { start, end, days, compare }; }
  function last(days, compare = true, end = today()) { return makeRange(end - days + 1, end, days, compare); }
  function previous(range) { return makeRange(range.start - (range.end - range.start + 1), range.start - 1); }
  function rangeLabel(range) {
    return dateLabel(range.start, new Date(range.start * dayMs).getUTCFullYear() !== new Date(range.end * dayMs).getUTCFullYear()) +
      ' – ' + dateLabel(range.end, true);
  }

  function custom(start, end, compare) {
    const first = Date.parse(start + 'T00:00:00Z') / dayMs;
    const last = Date.parse(end + 'T00:00:00Z') / dayMs;
    if (!Number.isInteger(first) || !Number.isInteger(last) || isoDay(first) !== start || isoDay(last) !== end ||
      first > last || last > today() || last - first >= 366) return null;
    return makeRange(first, last, null, compare);
  }

  function selectedRange() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(rangeKey)); } catch {}
    if (presets.includes(saved?.days)) return last(saved.days, saved.compare !== false);
    if (saved?.start && saved.end) {
      const range = custom(saved.start, saved.end, saved.compare !== false);
      if (range) return range;
    }
    const oldDays = Number((localStorage.getItem('nicooGaRange') || '').match(/\d+/)?.[0]);
    return last(presets.includes(oldDays) ? oldDays : 90);
  }

  function saveRange(range) {
    localStorage.setItem(rangeKey, JSON.stringify({
      days: range.days, start: isoDay(range.start), end: isoDay(range.end), compare: range.compare,
    }));
  }

  function usersBorn(day) {
    const noise = random(day * 193)();
    const weekday = (day + 4) % 7;
    return Math.round(83 + 32 * noise + 9 * Math.sin(day * 0.14) - (weekday === 0 ? 15 : weekday === 6 ? 8 : 0));
  }

  function visitor(id) {
    const rng = random(id * 14387);
    const [country, , cities] = pick(locations, rng);
    const [device, , browsers, systems, resolutions] = pick(devices, rng);
    const [firstChannel, , source] = pick(channels, rng);
    return {
      id, country, city: cities[Math.floor(rng() * cities.length)], device, firstChannel, source,
      browser: pick(browsers, rng)[0], system: pick(systems, rng)[0], resolution: pick(resolutions, rng)[0],
      language: pick(languages, rng)[0], provider: pick(providersByCountry[country] || [['Other', 100]], rng)[0],
      age: pick(ageBands, rng)[0],
    };
  }

  function activity(user, isNew, rng, realtime = false) {
    const sessionCount = 1 + Number(!realtime && rng() < 0.23);
    const sessions = Array.from({ length: sessionCount }, (_, i) => {
      const channel = isNew && i === 0 || rng() < 0.60 ? user.firstChannel : pick(channels, rng)[0];
      const maxViews = realtime ? 3 : 4;
      const views = Array.from({ length: 1 + Math.floor(rng() ** 1.25 * maxViews) }, () => pick(pageWeights, rng)[0]);
      const seconds = 2 + Math.round(rng() ** 2.2 * 95);
      return { channel, views, seconds, engaged: seconds >= 10 || views.length > 1, scroll: rng() < 0.49, click: rng() < 0.25 };
    });
    const formStart = sessions.some(s => s.views.includes('Visit')) && rng() < 0.11;
    return { user, isNew, sessions, formStart, formSubmit: formStart && rng() < 0.46 };
  }

  const dailyCache = new Map();
  function daily(day) {
    if (dailyCache.has(day)) return dailyCache.get(day);
    const rng = random(day * 571 + 3);
    const ids = new Set(Array.from({ length: usersBorn(day) }, (_, i) => day * 256 + i));
    const size = ids.size + 30 + Math.floor(rng() * 27);
    while (ids.size < size) {
      const birth = day - 1 - Math.floor(rng() ** 1.85 * 55);
      ids.add(birth * 256 + Math.floor(rng() * usersBorn(birth)));
    }
    const activities = Array.from(ids, id => {
      const record = activity(visitor(id), Math.floor(id / 256) === day, rng);
      record.hour = 7 + Math.floor(rng() * 15);
      return record;
    });
    dailyCache.set(day, activities);
    return activities;
  }

  function counter() {
    return { users: new Set(), newUsers: 0, sessions: 0, engaged: 0, seconds: 0, views: 0, count: 0, landing: 0 };
  }
  function getCounter(group, label) {
    if (!group.has(label)) group.set(label, counter());
    return group.get(label);
  }
  function toRow([label, value], multiplier) {
    return {
      label,
      users: value.users.size * multiplier,
      newUsers: value.newUsers * multiplier,
      sessions: value.sessions * multiplier,
      engaged: value.engaged * multiplier,
      seconds: value.seconds * multiplier,
      views: value.views * multiplier,
      count: value.count * multiplier,
      landing: value.landing * multiplier,
    };
  }
  function sumSession(target, session) {
    target.sessions++;
    target.engaged += Number(session.engaged);
    target.seconds += session.seconds;
    target.views += session.views.length;
  }
  function observeVisit(target, record) {
    target.users.add(record.user.id);
    target.newUsers += Number(record.isNew);
  }

  function summarize(activities, multiplier = trafficMultiplier) {
    const total = counter();
    const dimensions = ['country', 'city', 'firstChannel', 'source', 'device', 'browser', 'system', 'resolution', 'language', 'provider', 'age'];
    const groups = Object.fromEntries([...dimensions, 'channel', 'page', 'event'].map(name => [name, new Map()]));
    for (const name of eventNames) getCounter(groups.event, name);
    for (const name of Object.keys(pageNames)) getCounter(groups.page, name);
    for (const [name] of locations) getCounter(groups.country, name);
    for (const [name] of channels) {
      getCounter(groups.channel, name);
      getCounter(groups.firstChannel, name);
    }

    function event(name, id, amount = 1) {
      const row = groups.event.get(name);
      row.count += amount;
      row.users.add(id);
      total.count += amount;
    }

    for (const record of activities) {
      const { user, sessions } = record;
      const dimensionsForUser = dimensions.map(name => getCounter(groups[name], user[name]));
      const aggregates = [total, ...dimensionsForUser];
      aggregates.forEach(row => observeVisit(row, record));
      if (record.isNew) event('first_visit', user.id);
      if (record.formStart) event('form_start', user.id);
      if (record.formSubmit) event('form_submit', user.id);
      const firstChannel = getCounter(groups.channel, sessions[0].channel);
      firstChannel.count += Number(record.isNew) + Number(record.formStart) + Number(record.formSubmit);
      for (const session of sessions) {
        const channel = getCounter(groups.channel, session.channel);
        channel.count += 1 + session.views.length + Number(session.engaged) + Number(session.scroll) + Number(session.click);
        channel.users.add(user.id);
        aggregates.forEach(row => sumSession(row, session));
        sumSession(channel, session);
        event('session_start', user.id);
        event('page_view', user.id, session.views.length);
        if (session.engaged) event('user_engagement', user.id);
        if (session.scroll) event('scroll', user.id);
        if (session.click) event('click', user.id);
        groups.page.get(session.views[0]).landing++;
        session.views.forEach(name => {
          const page = groups.page.get(name);
          page.users.add(user.id);
          page.views++;
          page.seconds += session.seconds / session.views.length;
        });
      }
    }
    return {
      ...toRow(['Total', total], multiplier),
      groups: Object.fromEntries(Object.entries(groups).map(([name, map]) => [name, Array.from(map, row => toRow(row, multiplier))])),
    };
  }

  function* records(range) {
    for (let day = range.start; day <= range.end; day++) yield* daily(day);
  }

  function metricValue(row, metric) {
    return metric === 'avgEngagement' ? ratio(row.seconds, row.users) : row[metric];
  }

  function series(range, metric, grain = 'day', previousRange = null, dimension = '', label = '') {
    function valueFor(target) {
      const summary = summarize(records(target));
      const row = dimension ? summary.groups[dimension].find(row => row.label === label) : summary;
      return row ? metricValue(row, metric) : 0;
    }
    if (grain === 'hour') {
      return Array.from({ length: 24 }, (_, hour) => {
        const atHour = target => metricValue(summarize(Array.from(records(target)).filter(r => r.hour === hour)), metric);
        return { label: String(hour).padStart(2, '0') + ':00', value: atHour(range), previous: previousRange && atHour(previousRange) };
      });
    }
    const step = grain === 'week' ? 7 : grain === 'month' ? 30 : 1;
    const points = [];
    for (let from = range.start; from <= range.end; from += step) {
      const end = Math.min(from + step - 1, range.end);
      const value = valueFor(makeRange(from, end));
      const offset = previousRange ? previousRange.start - range.start : 0;
      const compare = previousRange && valueFor(makeRange(from + offset, end + offset));
      points.push({ label: dateLabel(end), value, previous: compare });
    }
    return points;
  }

  function activitySeries(range, windowDays) {
    const results = [];
    for (let day = range.start; day <= range.end; day++) {
      const unique = new Set();
      for (let sourceDay = Math.max(range.start, day - windowDays + 1); sourceDay <= day; sourceDay++) {
        for (const visit of daily(sourceDay)) unique.add(visit.user.id);
      }
      results.push({ label: dateLabel(day), value: unique.size * trafficMultiplier });
    }
    return results;
  }

  function cohorts(range) {
    const rows = [];
    const start = Math.max(range.start, range.end - 41);
    for (let startDay = start; startDay <= range.end; startDay += 7) {
      const end = Math.min(startDay + 6, range.end);
      const members = new Set(Array.from(records(makeRange(startDay, end))).filter(row => row.isNew).map(row => row.user.id));
      const periods = Array.from({ length: 6 }, (_, i) => {
        const first = startDay + i * 7;
        if (first > range.end) return null;
        const retained = new Set(Array.from(records(makeRange(first, Math.min(first + 6, range.end))))
          .map(r => r.user.id).filter(id => members.has(id))).size;
        return ratio(retained, members.size);
      });
      rows.push({ label: dateLabel(startDay) + ' – ' + dateLabel(end), periods });
    }
    return rows;
  }

  function realtime(minutes, now = Date.now()) {
    const slotsPerMinute = 60_000 / realtimeStepMs;
    const end = Math.floor(now / realtimeStepMs);
    const start = end - minutes * slotsPerMinute + 1;
    const activities = [];
    const minuteUsers = Array(minutes).fill(0);
    // Both reports use the same rolling window of seeded, individual demo visits.
    for (let slot = start; slot <= end; slot++) {
      const rng = random(slot * 71);
      if (rng() >= 0.46) continue;
      minuteUsers[Math.floor((slot - start) / slotsPerMinute)]++;
      activities.push(activity(visitor(slot), rng() < 0.67, rng, true));
    }
    return { ...summarize(activities, 1), minuteUsers };
  }

  function ratio(value, whole) { return whole ? value / whole : 0; }
  function ranked(rows, metric) {
    return [...rows].sort((a, b) => b[metric] - a[metric] || a.label.localeCompare(b.label));
  }

  window.NicooReportData = {
    presets, last, previous, selectedRange, saveRange, custom, today, isoDay, dateLabel, rangeLabel, pageNames,
    summarize: range => summarize(records(range)), series, activitySeries, cohorts, realtime, realtimeStepMs, ratio, ranked,
    number: value => numbers.format(Math.round(value)),
    percent: value => (value * 100).toFixed(1) + '%',
    time(value) {
      const seconds = Math.round(value);
      return seconds < 60 ? seconds + 's' : Math.floor(seconds / 60) + 'm ' + String(seconds % 60).padStart(2, '0') + 's';
    },
  };
})();
