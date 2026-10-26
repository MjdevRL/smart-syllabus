import { esc, webUrl, withBase, formatDate } from './util.mjs';
import { resolveNotice, renderNotice, stack } from './notices.mjs';

export const uniPath = (u) => `/universities/${u.id}/`;

const FACT_LABEL = {
  unverified: '<span class="tag verify">Unverified · personal research</span>',
  partly: '<span class="tag verify">Partly checked</span>',
  verified: '<span class="tag official">✓ Checked against official sources</span>',
};
const COST_INCLUDES = { tuition: 'tuition only', tuition_living: 'tuition + living costs' };

export function renderUniversityList(unis, base) {
  const rows = unis.map((u) => `<tr><td class="num">${esc(u.personal_rank || '—')}</td><td><a href="${esc(withBase(base, uniPath(u)))}"><b>${esc(u.university)}</b></a><br><span class="dim">${esc(u.course)}</span></td><td>${esc(u.country || '')}</td><td class="num">${esc(u.ib_score_range || '')}</td><td>${esc(u.extra_exams || '')}</td><td class="num">${esc(u.yearly_cost || '')}${u.cost_currency ? ' ' + esc(u.cost_currency) : ''}</td><td class="num">${(u.review_flags || []).length ? `<span class="tag verify">${u.review_flags.length} to check</span>` : '<span class="tag official">none</span>'}</td></tr>`);
  return `<div class="table-wrap"><table class="data uni-table"><caption>All figures are as written in my research spreadsheet and are not yet verified against official sources. "Personal rank" is my own opinion, not an official ranking.</caption><thead><tr><th scope="col">Personal rank</th><th scope="col">University and course</th><th scope="col">Country</th><th scope="col">IB range</th><th scope="col">Tests / requirements</th><th scope="col">Yearly cost</th><th scope="col">Review flags</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

export function renderUniversity(u, ctx) {
  const where = `University "${u.university} – ${u.course}"`;
  const at = {};
  for (const a of u.notices || []) {
    const n = resolveNotice(a, ctx, where);
    if (!n) continue;
    (at[a.placement || 'bottom'] ||= []).push(renderNotice(n));
  }
  const after = (k) => (at[k] ? `<div style="padding:10px 14px">${stack(at[k])}</div>` : '');
  const kv = (label, value) => `<div class="kv"><span>${label}</span><b>${value || '<span class="dim">Not recorded</span>'}</b></div>`;
  const site = webUrl(u.website);
  const course = webUrl(u.course_page);
  const cost = u.yearly_cost ? esc(u.yearly_cost) + (u.cost_currency ? ' ' + esc(u.cost_currency) : ' <span class="dim">(currency not stated)</span>') + (COST_INCLUDES[u.cost_includes] ? ` · ${COST_INCLUDES[u.cost_includes]}` : '') : '';
  return `<article class="sheet"><div class="tape"></div>
<nav aria-label="Breadcrumb" class="eyebrow"><ol class="crumbs" style="list-style:none;padding:0"><li><a href="${esc(withBase(ctx.base, ''))}">Home</a></li><li><span aria-hidden="true">→ </span><a href="${esc(withBase(ctx.base, 'universities/'))}">Universities</a></li><li><span aria-hidden="true">→ </span><span aria-current="page">${esc(u.university)}</span></li></ol></nav>
<h1 class="page-title">${esc(u.university)}</h1>
<p class="lede">${esc(u.course)}</p>
<div class="label-row">${FACT_LABEL[u.fact_status] || FACT_LABEL.unverified}${u.last_verified ? `<span class="tag">Last verified ${formatDate(u.last_verified)}</span>` : ''}</div>
${stack(at.top || [])}
<div class="card"><div class="card-head"><div class="card-name">The facts</div><div class="status">as researched</div></div>
${kv('Country', esc(u.country))}${kv('Location', esc(u.location))}
${kv('Official course page', course ? `<a href="${esc(course)}" target="_blank" rel="noopener">Open ↗</a>` : '')}
${kv('University website', site ? `<a href="${esc(site)}" target="_blank" rel="noopener">${esc(u.website)} ↗</a>` : '')}
${kv('IB score range', esc(u.ib_score_range))}${after('after_requirements')}
${kv('Extra exams / requirements', esc(u.extra_exams))}${after('after_tests')}
${kv('Likely yearly cost (estimate)', cost)}${after('after_costs')}
${kv('Likely first salary (estimate)', esc(u.first_salary))}${after('after_salary')}
${u.source_url ? kv('Main source', `<a href="${esc(webUrl(u.source_url))}" target="_blank" rel="noopener">Source ↗</a>`) : ''}
</div>
${u.other_notes ? `<h3 style="margin-top:26px">Notes</h3><p>${esc(u.other_notes)}</p>` : ''}
<div class="card"><div class="card-head" style="background:var(--purple)"><div class="card-name">My personal take</div><div class="status">personal opinion</div></div>
${kv('Personal ranking', esc(u.personal_rank))}
${kv('International recognition (my score)', u.recognition_score != null ? esc(u.recognition_score) + ' / 100' : '')}
${kv('Return on investment (my score)', u.roi_score != null ? esc(u.roi_score) + ' / 100' : '')}
${u.rank_justification ? `<div class="card-body"><p>${esc(u.rank_justification)}</p></div>` : ''}
</div>${after('after_ranking')}
${(u.review_flags || []).length ? `<div class="note pink" style="margin-top:22px"><span class="stamp" style="animation:none">needs review</span><ul class="flag-list">${u.review_flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
${stack(at.bottom || [])}
</article>`;
}
