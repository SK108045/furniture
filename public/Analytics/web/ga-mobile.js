const mobile = matchMedia('(max-width: 767px)');

export function loadMobileStyles() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('ga-mobile.css', import.meta.url);
  const loaded = new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = reject;
  });
  document.head.appendChild(link);
  return loaded;
}

export function mountMobileNavigation(header) {
  const nav = document.querySelector('.portal-nav');
  if (!header || !nav) return;

  nav.id ||= 'portal-navigation';
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'mobile-nav-toggle';
  toggle.setAttribute('aria-label', 'Report navigation');
  toggle.setAttribute('aria-controls', nav.id);
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span aria-hidden="true"></span>';

  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'mobile-nav-backdrop';
  backdrop.tabIndex = -1;
  backdrop.setAttribute('aria-label', 'Close report navigation');
  header.prepend(toggle);
  nav.before(backdrop);

  function setOpen(open) {
    document.body.classList.toggle('mobile-nav-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') === 'false';
    setOpen(open);
    if (open) (nav.querySelector('[aria-current="page"]') || nav.querySelector('a'))?.focus();
  });
  backdrop.addEventListener('click', () => {
    setOpen(false);
    toggle.focus();
  });
  nav.addEventListener('click', event => {
    if (mobile.matches && event.target.closest('a[href]')) setOpen(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
    setOpen(false);
    toggle.focus();
  });
  mobile.addEventListener('change', () => setOpen(false));
  window.addEventListener('pageshow', () => setOpen(false));
}

const titles = {
  snapshot: 'Reports snapshot',
  demographics: 'Demographic details: Country',
  device: 'Tech details: Device category',
  traffic: 'Traffic acquisition',
  campaigns: 'Reports snapshot with campaigns and cohorts',
};
const metrics = {
  users: 'Total users',
  newUsers: 'New users',
  engaged: 'Engaged sessions',
  avgEngagement: 'Average engagement time',
  sessions: 'Sessions',
};

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

export function mountMobileReport(kind, controls) {
  const data = window.NicooReportData;
  const { number, percent, time, ratio } = data;
  const main = document.createElement('main');
  main.id = 'mobile-report';
  document.body.appendChild(main);

  const dialog = document.createElement('dialog');
  dialog.className = 'mobile-range-dialog';
  dialog.setAttribute('aria-labelledby', 'mobile-range-title');
  main.after(dialog);

  let range;
  let current;
  let comparison;
  let metric;

  const group = (dimension, field) => data.ranked(current.groups[dimension], field);
  const metricValue = (report, name) => name === 'avgEngagement' ? ratio(report.seconds, report.users) : report[name];
  const formatMetric = (name, value) => name === 'avgEngagement' ? time(value) : number(value);

  function change(value, previous) {
    if (!previous) return '—';
    const delta = (value - previous) / previous;
    return (delta > 0 ? '+' : '') + percent(delta);
  }

  function card(title, contents, href, linkLabel) {
    return `<section class="mobile-report-card"><h2>${title}</h2>${contents}${
      href ? `<a class="mobile-report-link" href="${href}">${linkLabel} →</a>` : ''
    }</section>`;
  }

  function bars(rows, field, label = row => row.label) {
    const max = rows[0]?.[field] || 1;
    return `<ul class="mobile-report-bars">${rows.map(row =>
      `<li><span>${escapeHtml(label(row))}</span><strong>${number(row[field])}</strong><div aria-hidden="true"><span style="width:${row[field] / max * 100}%"></span></div></li>`
    ).join('')}</ul>`;
  }

  function table(dimension, headings, rows, totals) {
    const headers = [dimension, ...headings];
    const row = (cells, scope) => `<tr>${cells.map((cell, index) => scope || !index
      ? `<th scope="${scope || 'row'}">${escapeHtml(cell)}</th>`
      : `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
    return `<div class="mobile-report-table" role="region" aria-label="${dimension} table" tabindex="0">
      <table><thead>${row(headers, 'col')}</thead>
      <tbody>${rows.map(cells => row(cells)).join('')}</tbody>
      ${totals ? `<tfoot>${row(['Total', ...totals])}</tfoot>` : ''}</table></div>`;
  }

  function detailTable(dimension, headings, rows, values) {
    return card(dimension, `<label class="mobile-report-search">Search table
      <input type="search" placeholder="${dimension}"></label>
      ${table(dimension, headings, rows.map(entry => [entry.label, ...values(entry)]), values(current))}`);
  }

  function chart(points, field, label = metrics[field]) {
    const max = Math.max(1, ...points.map(point => Math.max(point.value, point.previous ?? 0)));
    const magnitude = 10 ** Math.floor(Math.log10(max / 3));
    const step = Math.ceil(max / 3 / magnitude) * magnitude;
    const left = 48, right = 329, top = 12, bottom = 124;
    const x = index => left + (right - left) * (points.length === 1 ? 0.5 : index / (points.length - 1));
    const y = value => bottom - (bottom - top) * value / (3 * step);
    const path = key => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)} ${y(point[key]).toFixed(2)}`).join(' ');
    const compare = typeof points[0]?.previous === 'number';
    return `<div class="mobile-report-chart">
      <svg viewBox="0 0 338 150" role="img" aria-label="${label} over time">
        ${[0, 1, 2, 3].map(tick => {
          const value = tick * step;
          return `<line x1="${left}" x2="${right}" y1="${y(value)}" y2="${y(value)}"/>
            <text x="${left - 5}" y="${y(value) + 4}" text-anchor="end">${formatMetric(field, value)}</text>`;
        }).join('')}
        ${compare ? `<path class="mobile-previous-line" d="${path('previous')}"/>` : ''}
        <path class="mobile-current-line" d="${path('value')}"/>
        ${points.length === 1 ? `<circle cx="${x(0)}" cy="${y(points[0].value)}" r="3"/>` : ''}
        <text x="${left}" y="143">${escapeHtml(points[0]?.label || '')}</text>
        ${points.length > 1 ? `<text x="${right}" y="143" text-anchor="end">${escapeHtml(points.at(-1).label)}</text>` : ''}
      </svg>${compare ? '<div class="mobile-chart-legend"><span>Selected period</span><span>Previous period</span></div>' : ''}
    </div>`;
  }

  function trend(field) {
    return chart(data.series(range, field, 'day', range.compare ? data.previous(range) : null), field);
  }

  function snapshot() {
    const kpis = ['users', 'newUsers', 'engaged', 'avgEngagement'].map(field => {
      const value = metricValue(current, field);
      const delta = comparison && change(value, metricValue(comparison, field));
      return `<button class="mobile-report-metric" type="button" data-metric="${field}" aria-pressed="${metric === field}">
        <span>${metrics[field]}</span><strong>${formatMetric(field, value)}</strong>
        ${delta ? `<small class="${delta.startsWith('-') ? 'mobile-decrease' : 'mobile-increase'}">${delta}</small>` : ''}</button>`;
    });
    const channels = group('channel', 'sessions').map(row => [row.label, number(row.sessions),
      ...(comparison ? [change(row.sessions, comparison.groups.channel.find(entry => entry.label === row.label)?.sessions)] : [])]);
    return [
      card('Activity over time', `<div class="mobile-report-kpis">${kpis.join('')}</div><div data-mobile-trend>${trend(metric)}</div>`),
      card('Active users by Country', '<img class="mobile-report-map" src="ga-world-map.webp" alt="Map highlighting African countries">' +
        bars(group('country', 'users').slice(0, 7), 'users'), 'Demographic details_ Country.html', 'View countries'),
      card('New users by first channel', bars(group('firstChannel', 'newUsers'), 'newUsers'),
        'Traffic acquisition.html', 'View acquisition'),
      card('Sessions by channel', table('Channel', ['Sessions', ...(comparison ? ['Change'] : [])], channels),
        'Traffic acquisition.html', 'View traffic acquisition'),
      card('Views by Page title', bars(group('page', 'views'), 'views', row => data.pageNames[row.label] || row.label),
        'Pages and screens.html', 'View pages and screens'),
    ].join('');
  }

  function campaigns() {
    const activity = [30, 7, 1].map(days => {
      const points = data.activitySeries(range, days);
      return `<div><small>${days}-day active users</small><strong>${number(points.at(-1).value)}</strong></div>`;
    });
    const cohorts = data.cohorts(range).map(row => [row.label, ...Array.from({ length: 6 }, (_, index) =>
      row.periods[index] == null ? '—' : percent(row.periods[index]))]);
    return [
      card('Sessions by channel', bars(group('channel', 'sessions'), 'sessions'), 'Traffic acquisition.html', 'View traffic acquisition'),
      card('Active users by Country', bars(group('country', 'users'), 'users'), 'Demographic details_ Country.html', 'View countries'),
      card('User activity over time', `<div class="mobile-report-kpis">${activity.join('')}</div>${trend('users')}`),
      card('User activity by cohort', table('First visit', Array.from({ length: 6 }, (_, index) => 'Week ' + index), cohorts)),
    ].join('');
  }

  const renderers = {
    snapshot,
    demographics: () => detailTable('Country', controls.engagementHeaders, group('country', 'users'), controls.engagementValues),
    device: () => {
      const rows = group('device', 'users');
      return card('Active users over time', trend('users')) +
        card('Active users by device', bars(rows, 'users')) +
        detailTable('Device category', controls.engagementHeaders, rows, controls.engagementValues);
    },
    traffic: () => card('Sessions over time', trend('sessions')) +
      card('Sessions by channel', bars(group('channel', 'sessions'), 'sessions')) +
      detailTable('Session default channel group', controls.trafficHeaders, group('channel', 'users'), controls.trafficValues),
    campaigns,
  };

  function render() {
    if (!mobile.matches) return;
    range = data.selectedRange();
    current = data.summarize(range);
    comparison = kind === 'snapshot' && range.compare && data.summarize(data.previous(range));
    metric = controls.selectedMetric();
    main.innerHTML = `<div class="mobile-report-head">
      <h1>${titles[kind]}</h1>
      <div class="mobile-report-toolbar">
        <button type="button" class="mobile-date-button" data-date aria-haspopup="dialog">
          <span>${range.days ? 'Last ' + range.days + ' days' : 'Custom range'} · ${data.rangeLabel(range)}</span>
          ${range.compare ? `<small>Compare: ${data.rangeLabel(data.previous(range))}</small>` : ''}</button>
        <button type="button" data-share>Share</button>
        <button type="button" data-download>CSV</button>
      </div><small class="mobile-report-note">Demo data</small>
    </div><div class="mobile-report-grid">${renderers[kind]()}</div>`;
    document.body.classList.add('has-mobile-report');
  }

  function showRange() {
    const max = data.isoDay(data.today());
    dialog.innerHTML = `<form>
      <h2 id="mobile-range-title">Date range</h2>
      <label>Period<select name="preset">
        ${data.presets.map(days => `<option value="${days}"${range.days === days ? ' selected' : ''}>Last ${days} days</option>`).join('')}
        <option value="custom"${range.days ? '' : ' selected'}>Custom range</option>
      </select></label>
      <fieldset data-custom-dates>
        <label>Start date<input name="start" type="date" value="${data.isoDay(range.start)}" max="${max}" required></label>
        <label>End date<input name="end" type="date" value="${data.isoDay(range.end)}" max="${max}" required></label>
      </fieldset>
      <label class="mobile-date-compare"><input type="checkbox" name="compare"${range.compare ? ' checked' : ''}>Compare to previous period</label>
      <p class="mobile-date-error" role="alert"></p>
      <div class="mobile-dialog-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Apply range</button></div>
    </form>`;
    const form = dialog.querySelector('form');
    const preset = form.elements.preset;
    const dates = form.querySelector('[data-custom-dates]');
    function syncCustomDates() {
      dates.hidden = dates.disabled = preset.value !== 'custom';
    }
    preset.addEventListener('change', syncCustomDates);
    syncCustomDates();
    form.querySelector('[data-cancel]').onclick = () => dialog.close();
    form.addEventListener('submit', event => {
      event.preventDefault();
      const compare = form.elements.compare.checked;
      const next = preset.value === 'custom'
        ? data.custom(form.elements.start.value, form.elements.end.value, compare)
        : data.last(Number(preset.value), compare);
      if (!next) {
        form.querySelector('[role="alert"]').textContent = 'Choose a valid range of up to 366 days ending today or earlier.';
        return;
      }
      dialog.close();
      controls.setRange(next);
      render();
      main.querySelector('[data-date]').focus({ preventScroll: true });
    });
    dialog.showModal();
  }

  main.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-date')) showRange();
    if (button.hasAttribute('data-share')) controls.share();
    if (button.hasAttribute('data-download')) controls.download();
    if (!button.dataset.metric) return;
    metric = button.dataset.metric;
    controls.setMetric(metric);
    main.querySelectorAll('[data-metric]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    main.querySelector('[data-mobile-trend]').innerHTML = trend(metric);
  });
  // Let native scrolling take precedence over the legacy wheel handler.
  main.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  dialog.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  main.addEventListener('input', event => {
    if (!event.target.matches('input[type="search"]')) return;
    const query = event.target.value.trim().toLowerCase();
    event.target.closest('section').querySelectorAll('tbody tr').forEach(row => {
      row.hidden = !row.cells[0].textContent.toLowerCase().includes(query);
    });
  });
  mobile.addEventListener('change', () => {
    if (!mobile.matches && dialog.open) dialog.close();
    render();
  });
  addEventListener('pageshow', event => { if (event.persisted) render(); });
  addEventListener('storage', event => { if (event.key === 'nicooReportRangeV2' || event.key === null) render(); });
  render();
}
