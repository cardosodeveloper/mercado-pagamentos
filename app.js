/* ---------- Configuração ---------- */
const DEFAULT_COMPANIES = [
  {id:'ebanx', name:'Ebanx', terms:['Ebanx'], re:'\\bebanx\\b'},
  {id:'pagbank', name:'PagBank (PagSeguro)', terms:['PagSeguro','PagBank'], re:'\\bpag ?seguro\\b|\\bpag ?bank\\b'},
  {id:'stone', name:'Stone (Ton)', terms:['StoneCo','Stone Pagamentos','Stone maquininha','Ton maquininha'], re:'\\bstone(co)?\\b'},
  {id:'cielo', name:'Cielo', terms:['Cielo'], re:'\\bcielo\\b'},
  {id:'getnet', name:'Getnet', terms:['Getnet'], re:'\\bgetnet\\b'},
  {id:'rede', name:'Rede (Itaú)', terms:['Rede Itaú','adquirente Rede','maquininha Rede'], re:'rede itaú|itaú rede|adquirente rede|maquininhas? (da )?rede'},
  {id:'mercadopago', name:'Mercado Pago', terms:['Mercado Pago'], re:'\\bmercado ?pago\\b'},
  {id:'picpay', name:'PicPay', terms:['PicPay'], re:'\\bpicpay\\b'},
  {id:'cloudwalk', name:'InfinitePay (CloudWalk)', terms:['InfinitePay','CloudWalk'], re:'\\binfinite ?pay\\b|\\bcloud ?walk\\b'},
  {id:'pagarme', name:'Pagar.me', terms:['Pagar.me'], re:'\\bpagar\\.me\\b'},
  {id:'adyen', name:'Adyen', terms:['Adyen'], re:'\\badyen\\b'},
  {id:'dlocal', name:'dLocal', terms:['dLocal'], re:'\\bdlocal\\b'},
  {id:'safrapay', name:'SafraPay', terms:['SafraPay'], re:'\\bsafra ?pay\\b'},
  {id:'sumup', name:'SumUp', terms:['SumUp'], re:'\\bsumup\\b'},
  {id:'fiserv', name:'Fiserv (Bin)', terms:['Fiserv Brasil','Bin Fiserv'], re:'\\bfiserv\\b'},
  {id:'vero', name:'Vero (Banrisul)', terms:['Vero Banrisul'], re:'\\bvero\\b'},
  {id:'asaas', name:'Asaas', terms:['Asaas'], re:'\\basaas\\b'},
  {id:'iugu', name:'iugu', terms:['iugu'], re:'\\biugu\\b'},
  {id:'vindi', name:'Vindi', terms:['Vindi'], re:'\\bvindi\\b'},
  {id:'efi', name:'Efí Bank', terms:['Efí Bank','Gerencianet'], re:'efí bank|\\bgerencianet\\b'},
  {id:'celcoin', name:'Celcoin', terms:['Celcoin'], re:'\\bcelcoin\\b'},
  {id:'stripe', name:'Stripe', terms:['Stripe Brasil'], re:'\\bstripe\\b'},
  {id:'paypal', name:'PayPal', terms:['PayPal Brasil'], re:'\\bpaypal\\b'},
  {id:'zoop', name:'Zoop', terms:['Zoop pagamentos'], re:'\\bzoop\\b'},
];

const SECTOR_QUERIES = [
  '"mercado de pagamentos" OR "meios de pagamento" OR adquirência OR adquirentes OR subadquirente',
  'maquininhas OR "instituição de pagamento" OR "arranjo de pagamento" OR "antecipação de recebíveis" OR "taxa MDR"',
  '"Pix Automático" OR "Pix por aproximação" OR "Pix parcelado" OR "regras do Pix" OR Drex',
];

const SECTOR_RX = /pagament|adquirên|adquirente|maquininh|\bpix\b|cart(ão|ões) de (crédito|débito)|gateway|checkout|instituiç(ão|ões) de pagamento|arranjo|\bmdr\b|recebíveis|intercâmbio|interchange|\bbandeiras?\b|fintech|\bdrex\b|tap to pay/i;

const CATEGORIES = [
  {id:'res', name:'Resultados', rx:/lucro|receita|resultado|trimestre|balanço|\b[1-4]t ?2\d\b|\btpv\b|guidance|prejuízo|faturamento/i},
  {id:'ma', name:'M&A e investimentos', rx:/aquisiç|aquisição|compra (da|do|de)\b|fusão|\bipo\b|aporte|rodada|valuation|recompra|investimento|nasdaq|nyse|ações/i},
  {id:'reg', name:'Regulação', rx:/banco central|\bbc\b|bacen|regula|resolução|\bcvm\b|\bcade\b|projeto de lei|\blei\b|tribut|imposto|\biof\b|fiscaliz/i},
  {id:'pix', name:'Pix', rx:/\bpix\b/i},
  {id:'prod', name:'Produtos e parcerias', rx:/lança|lançamento|novo produto|nova função|parceria|integraç|maquininha|tap to pay|aproximação|carteira digital/i},
  {id:'ppl', name:'Pessoas e gestão', rx:/\bceo\b|presidente|diretor|executiv|nomeia|assume|deixa o cargo|demiss|layoff|reestrutura/i},
];

const PROXIES = [
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  u => 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(u),
];
const STORE_KEY = 'radar-pagamentos-custom';
const SECTOR_ID = '__setor';

/* ---------- Estado ---------- */
let companies = [];
let items = [];
const seen = new Set();
const selCos = new Set();
const selCats = new Set();
let goodProxy = 0;
let loadId = 0;

const $ = id => document.getElementById(id);

function loadCustom(){
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
}
function saveCustom(list){
  try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch {}
}
function escRx(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function escHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function initCompanies(){
  const custom = loadCustom().map(c => ({...c, custom:true}));
  companies = [...DEFAULT_COMPANIES, ...custom].map(c => ({...c, rx:new RegExp(c.re, 'i'), rxg:new RegExp(c.re, 'gi')}));
}

/* ---------- Busca ---------- */
function newsUrl(q, days){
  const full = '(' + q + ') when:' + days + 'd';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(full) + '&hl=pt-BR&gl=BR&ceid=BR:pt-419';
}
function termQuery(terms){ return terms.map(t => t.includes(' ') ? '"' + t + '"' : t).join(' OR '); }

function buildQueries(list, days, withSector){
  const qs = [];
  for (let i = 0; i < list.length; i += 4){
    const group = list.slice(i, i + 4);
    qs.push(newsUrl(group.map(c => termQuery(c.terms)).join(' OR '), days));
  }
  if (withSector) SECTOR_QUERIES.forEach(q => qs.push(newsUrl(q, days)));
  return qs;
}

async function fetchText(url){
  let lastErr;
  for (let k = 0; k < PROXIES.length; k++){
    const i = (goodProxy + k) % PROXIES.length;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    try {
      const r = await fetch(PROXIES[i](url), {signal:ctrl.signal});
      clearTimeout(timer);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const txt = await r.text();
      if (!/<rss|<channel/i.test(txt)) throw new Error('Resposta não é RSS');
      goodProxy = i;
      return txt;
    } catch (e){ clearTimeout(timer); lastErr = e; }
  }
  throw lastErr || new Error('Falha na busca');
}

function parseRss(xml){
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  return [...doc.querySelectorAll('item')].map(it => {
    const get = sel => (it.querySelector(sel)?.textContent || '').trim();
    const source = get('source');
    let title = get('title');
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    return { title, link:get('link'), date:new Date(get('pubDate')), source: source || 'Fonte não informada' };
  }).filter(n => n.title && !isNaN(n.date));
}

function classify(n){
  n.cos = companies.filter(c => c.rx.test(n.title)).map(c => c.id);
  n.cats = CATEGORIES.filter(c => c.rx.test(n.title)).map(c => c.id);
  n.sector = n.cos.length === 0;
  return n.cos.length > 0 || SECTOR_RX.test(n.title);
}
function keyOf(t){ return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 90); }

function addItems(list){
  let added = 0;
  for (const n of list){
    const k = keyOf(n.title);
    if (seen.has(k)) continue;
    if (!classify(n)) continue;
    seen.add(k); items.push(n); added++;
  }
  return added;
}

async function runQueries(urls, id){
  const prog = $('progress'), bar = prog.querySelector('i');
  let done = 0, failed = 0;
  prog.classList.add('on'); bar.style.width = '4%';
  const queue = [...urls];
  async function worker(){
    while (queue.length){
      const url = queue.shift();
      try {
        const xml = await fetchText(url);
        if (id !== loadId) return;
        addItems(parseRss(xml));
      } catch { failed++; }
      if (id !== loadId) return;
      done++;
      bar.style.width = Math.round(done / urls.length * 100) + '%';
      setStatus('Buscando notícias: ' + done + ' de ' + urls.length + ' consultas concluídas.');
      render();
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  if (id !== loadId) return {failed, total:urls.length};
  prog.classList.remove('on');
  return {failed, total:urls.length};
}

async function load(){
  const id = ++loadId;
  items = []; seen.clear();
  $('refresh').disabled = true;
  render();
  const days = $('period').value;
  const {failed, total} = await runQueries(buildQueries(companies, days, true), id);
  if (id !== loadId) return;
  $('refresh').disabled = false;
  finishStatus(failed, total);
  render();
}

function finishStatus(failed, total){
  const now = new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  if (failed === total){
    setStatus('Nenhuma consulta funcionou. Os proxies públicos podem estar fora do ar ou bloqueados pela sua rede. Confira a conexão e clique em Atualizar de novo em alguns minutos.', true);
    return;
  }
  const sources = new Set(items.map(n => n.source)).size;
  let msg = items.length + ' notícias de ' + sources + ' fontes. Atualizado às ' + now + '.';
  if (failed) msg += ' ' + failed + ' de ' + total + ' consultas falharam; clique em Atualizar para tentar de novo.';
  setStatus(msg, false);
}
function setStatus(t, err){ const s = $('status'); s.textContent = t; s.classList.toggle('err', !!err); }

/* ---------- Filtros e renderização ---------- */
function filtered(){
  const q = keyOf($('search').value);
  let list = items.filter(n => {
    if (selCos.size){
      const hit = n.cos.some(c => selCos.has(c)) || (selCos.has(SECTOR_ID) && n.sector);
      if (!hit) return false;
    }
    if (selCats.size && !n.cats.some(c => selCats.has(c))) return false;
    if (q && !keyOf(n.title + ' ' + n.source).includes(q)) return false;
    return true;
  });
  const dir = $('sort').value === 'old' ? 1 : -1;
  return list.sort((a, b) => (a.date - b.date) * dir);
}

function renderCompanies(){
  const counts = {};
  let sectorCount = 0;
  for (const n of items){ n.cos.forEach(c => counts[c] = (counts[c] || 0) + 1); if (n.sector) sectorCount++; }
  const max = Math.max(1, sectorCount, ...Object.values(counts));
  const sorted = [...companies].sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || a.name.localeCompare(b.name));
  const row = (id, name, n, extra, custom) => `
    <div class="co-wrap">
      <button class="co ${n ? '' : 'zero'} ${extra}" data-co="${id}" aria-pressed="${selCos.has(id)}">
        <span class="nm">${escHtml(name)}</span><span class="ct">${n}</span>
        <span class="bar"><i style="width:${(n / max * 100).toFixed(1)}%"></i></span>
      </button>
      ${custom ? `<button class="del" data-del="${id}" aria-label="Remover ${escHtml(name)}" title="Remover">×</button>` : ''}
    </div>`;
  $('coList').innerHTML =
    row(SECTOR_ID, 'Notícias do setor', sectorCount, 'sector', false) +
    '<div class="sep" role="presentation"></div>' +
    sorted.map(c => row(c.id, c.name, counts[c.id] || 0, '', c.custom)).join('');
  $('clearFilters').hidden = !(selCos.size || selCats.size || $('search').value);
}

function renderCats(){
  $('cats').innerHTML = CATEGORIES.map(c =>
    `<button class="chip" data-cat="${c.id}" aria-pressed="${selCats.has(c.id)}">${c.name}</button>`).join('');
}

function highlight(n){
  let html = escHtml(n.title);
  for (const id of n.cos){
    const c = companies.find(x => x.id === id);
    if (c) html = html.replace(c.rxg, m => '<mark>' + m + '</mark>');
  }
  return html;
}

const dayFmt = new Intl.DateTimeFormat('pt-BR', {weekday:'long', day:'numeric', month:'long'});
function dayLabel(d){
  const today = new Date(); today.setHours(0,0,0,0);
  const that = new Date(d); that.setHours(0,0,0,0);
  const diff = Math.round((today - that) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  const s = dayFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function timeLabel(d){
  const mins = Math.round((Date.now() - d) / 60000);
  if (mins < 60 && mins >= 0) return 'há ' + Math.max(1, mins) + ' min';
  if (mins < 720 && mins >= 0) return 'há ' + Math.round(mins / 60) + ' h';
  return d.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
}

function render(){
  renderCompanies();
  const list = filtered();
  const box = $('list');
  if (!list.length){
    const loading = $('refresh').disabled;
    box.innerHTML = loading
      ? '<div class="empty">Buscando as primeiras notícias…</div>'
      : items.length
        ? '<div class="empty"><strong>Nenhuma notícia com esses filtros.</strong><br>Tire alguma empresa ou categoria da seleção, ou aumente o período.</div>'
        : '<div class="empty"><strong>Ainda não há notícias carregadas.</strong><br>Clique em Atualizar para buscar.</div>';
    return;
  }
  const groups = new Map();
  for (const n of list){
    const k = n.date.toDateString();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(n);
  }
  const nameOf = id => companies.find(c => c.id === id)?.name || id;
  const catOf = id => CATEGORIES.find(c => c.id === id)?.name || id;
  box.innerHTML = [...groups.values()].map(g => `
    <h3 class="day">${dayLabel(g[0].date)}<small>${g.length} ${g.length === 1 ? 'notícia' : 'notícias'}</small></h3>
    ${g.map(n => `
      <article class="news">
        <div class="meta"><span class="src">${escHtml(n.source)}</span><time datetime="${n.date.toISOString()}">${timeLabel(n.date)}</time></div>
        <h3><a href="${escHtml(n.link)}" target="_blank" rel="noopener noreferrer">${highlight(n)}</a></h3>
        <div class="tags">
          ${n.sector ? '<span class="tag sec">Setor</span>' : n.cos.map(c => `<span class="tag">${escHtml(nameOf(c))}</span>`).join('')}
          ${n.cats.map(c => `<span class="tag cat">${catOf(c)}</span>`).join('')}
        </div>
      </article>`).join('')}
  `).join('');
}

/* ---------- Exportação ---------- */
function exportCsv(){
  const list = filtered();
  if (!list.length){ setStatus('Não há notícias para exportar com os filtros atuais.', true); return; }
  const nameOf = id => companies.find(c => c.id === id)?.name || id;
  const catOf = id => CATEGORIES.find(c => c.id === id)?.name || id;
  const cell = v => '"' + String(v).replace(/"/g, '""') + '"';
  const rows = [['Data','Hora','Título','Fonte','Empresas','Categorias','Link']];
  for (const n of list){
    rows.push([
      n.date.toLocaleDateString('pt-BR'),
      n.date.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'}),
      n.title, n.source,
      n.sector ? 'Setor' : n.cos.map(nameOf).join(', '),
      n.cats.map(catOf).join(', '),
      n.link,
    ]);
  }
  const csv = '\uFEFF' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'}));
  a.download = 'radar-pagamentos-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Eventos ---------- */
$('coList').addEventListener('click', e => {
  const del = e.target.closest('[data-del]');
  if (del){
    const id = del.dataset.del;
    saveCustom(loadCustom().filter(c => c.id !== id));
    selCos.delete(id);
    initCompanies();
    items.forEach(classify);
    items = items.filter(n => n.cos.length || SECTOR_RX.test(n.title));
    render();
    return;
  }
  const b = e.target.closest('[data-co]');
  if (!b) return;
  const id = b.dataset.co;
  selCos.has(id) ? selCos.delete(id) : selCos.add(id);
  render();
});
$('cats').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]');
  if (!b) return;
  const id = b.dataset.cat;
  selCats.has(id) ? selCats.delete(id) : selCats.add(id);
  renderCats(); render();
});
$('addForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('addInput').value.trim();
  if (!name) return;
  const id = 'c_' + keyOf(name).replace(/ /g, '_');
  if (companies.some(c => c.id === id || c.name.toLowerCase() === name.toLowerCase())){
    setStatus(name + ' já está na lista.', true); return;
  }
  const list = loadCustom();
  list.push({id, name, terms:[name], re:'\\b' + escRx(name) + '\\b'});
  saveCustom(list);
  $('addInput').value = '';
  initCompanies();
  items.forEach(classify);
  const c = companies.find(x => x.id === id);
  setStatus('Buscando notícias de ' + name + '…');
  const lid = loadId;
  const {failed, total} = await runQueries(buildQueries([c], $('period').value, false), lid);
  if (lid === loadId) finishStatus(failed, total);
  render();
});
$('clearFilters').addEventListener('click', () => {
  selCos.clear(); selCats.clear(); $('search').value = '';
  renderCats(); render();
});
$('search').addEventListener('input', render);
$('sort').addEventListener('change', render);
$('refresh').addEventListener('click', load);
$('period').addEventListener('change', load);
$('export').addEventListener('click', exportCsv);

initCompanies();
renderCats();
load();
