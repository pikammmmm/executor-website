const API_URL = 'https://weao.xyz/api/status/exploits';
let allExecutors = [];

// Page-level filter from subpages
const PAGE_FILTER = window.PAGE_FILTER || 'all';
const IS_COST_FILTER = PAGE_FILTER === 'free' || PAGE_FILTER === 'paid';

let currentPlatform = IS_COST_FILTER ? 'all' : PAGE_FILTER;
let currentType = IS_COST_FILTER ? PAGE_FILTER : 'all';
let currentSort = 'sunc-desc';

function pctClr(p) {
    if (p >= 90) return 'green';
    if (p >= 70) return 'yellow';
    if (p >= 50) return 'orange';
    return 'red';
}

function isExt(t) { return t && t.includes('external'); }

function buildCard(ex) {
    const hasSunc = ex.suncPercentage != null;
    const hasUnc = ex.uncPercentage != null;
    const sunc = hasSunc ? ex.suncPercentage : null;
    const unc = hasUnc ? ex.uncPercentage : null;
    const sc = hasSunc ? pctClr(sunc) : 'red';
    const uc = hasUnc ? pctClr(unc) : 'red';
    const logo = ex.slug?.logo;

    const el = document.createElement('div');
    el.className = 'card';

    let detected = '';
    if (ex.detected) {
        detected = `<div class="card-detected">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Detected${ex.detectionReason ? ' — ' + ex.detectionReason : ''}
        </div>`;
    }

    let scores = '';
    const single = (hasSunc && !hasUnc) || (!hasSunc && hasUnc);
    if (hasSunc || hasUnc) {
        scores = `<div class="card-scores${single ? ' single' : ''}">`;
        if (hasSunc) {
            scores += `<div class="score-box"><div class="score-label">sUNC</div><div class="score-num c-${sc}">${sunc}%</div><div class="score-bar"><div class="score-bar-fill b-${sc}" style="--w:${sunc}%"></div></div></div>`;
        }
        if (hasUnc) {
            scores += `<div class="score-box"><div class="score-label">UNC</div><div class="score-num c-${uc}">${unc}%</div><div class="score-bar"><div class="score-bar-fill b-${uc}" style="--w:${unc}%"></div></div></div>`;
        }
        scores += '</div>';
    }

    let feats = '';
    const f = [];
    if (ex.cost) f.push(ex.cost);
    if (ex.version) f.push('v' + ex.version.replace(/^v/i, ''));
    if (ex.decompiler) f.push('Decompiler');
    if (ex.multiInject) f.push('Multi-Inject');
    if (ex.clientmods) f.push('Client Mods');
    if (ex.raknet) f.push('RakNet');
    if (f.length) feats = `<div class="card-features">${f.map(x => `<span class="feat">${x}</span>`).join('')}</div>`;

    let actions = '';
    const links = [];
    if (ex.websitelink) links.push(`<a href="${ex.websitelink}" target="_blank" class="card-btn">Website</a>`);
    if (ex.discordlink) links.push(`<a href="${ex.discordlink}" target="_blank" class="card-btn">Discord</a>`);
    if (links.length) actions = `<div class="card-actions">${links.join('')}</div>`;

    el.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-top">
            <div class="card-avatar">${logo ? `<img src="${logo}" alt="${ex.title}" onerror="this.parentElement.textContent='${ex.title[0]}'">` : ex.title[0]}</div>
            <div class="card-info">
                <div class="card-name">${ex.title}</div>
                <div class="card-tags">
                    <span class="tag ${ex.free ? 'tag-free' : 'tag-paid'}">${ex.free ? 'Free' : 'Paid'}</span>
                    <span class="tag tag-platform">${ex.platform || '?'}</span>
                    ${isExt(ex.extype) ? '<span class="tag tag-ext">External</span>' : ''}
                </div>
            </div>
        </div>
        ${detected}
        ${scores}
        ${feats}
        <div class="card-status">
            <div class="status-led ${ex.updateStatus ? 'on' : 'off'}"></div>
            <span class="status-txt">${ex.updateStatus ? 'Updated' : 'Outdated'} &middot; ${ex.updatedDate || 'Unknown'}</span>
        </div>
        ${actions}
    `;
    return el;
}

function render() {
    let list = allExecutors.filter(e => !e.hidden);
    if (currentPlatform !== 'all') list = list.filter(e => e.platform === currentPlatform);
    if (currentType === 'executor') list = list.filter(e => e.extype && !e.extype.includes('external'));
    else if (currentType === 'external') list = list.filter(e => e.extype && e.extype.includes('external'));
    else if (currentType === 'free') list = list.filter(e => e.free);
    else if (currentType === 'paid') list = list.filter(e => !e.free);

    list.sort((a, b) => {
        switch (currentSort) {
            case 'sunc-desc': return (b.suncPercentage ?? -1) - (a.suncPercentage ?? -1);
            case 'sunc-asc': return (a.suncPercentage ?? 999) - (b.suncPercentage ?? 999);
            case 'unc-desc': return (b.uncPercentage ?? -1) - (a.uncPercentage ?? -1);
            case 'name-asc': return a.title.localeCompare(b.title);
            case 'name-desc': return b.title.localeCompare(a.title);
            default: return 0;
        }
    });

    const g = document.getElementById('grid');
    g.innerHTML = '';
    list.forEach((ex) => g.appendChild(buildCard(ex)));
    document.getElementById('showing-count').textContent = list.length;
}

function animateCountUp(el, target, suffix) {
    const dur = 1200;
    const start = performance.now();
    function tick(now) {
        const t = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - t, 4);
        el.textContent = Math.round(target * ease) + (suffix || '');
        if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

async function fetchData() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('grid').innerHTML = '';
    try {
        const r = await fetch(API_URL);
        if (!r.ok) throw new Error(r.status);
        allExecutors = await r.json();
        document.getElementById('loading').style.display = 'none';

        // Stats based on filtered view for subpages
        const v = allExecutors.filter(e => !e.hidden);
        let filtered = v;
        if (currentPlatform !== 'all') filtered = filtered.filter(e => e.platform === currentPlatform);
        if (IS_COST_FILTER && PAGE_FILTER === 'free') filtered = filtered.filter(e => e.free);
        if (IS_COST_FILTER && PAGE_FILTER === 'paid') filtered = filtered.filter(e => !e.free);

        animateCountUp(document.getElementById('total-count'), filtered.length, '');
        animateCountUp(document.getElementById('updated-count'), filtered.filter(e => e.updateStatus).length, '');
        const ws = filtered.filter(e => e.suncPercentage != null);
        if (ws.length) animateCountUp(document.getElementById('avg-sunc'), Math.round(ws.reduce((s, e) => s + e.suncPercentage, 0) / ws.length), '%');

        render();
    } catch (e) {
        document.getElementById('loading').innerHTML = `<div class="error-box"><h3>Failed to connect</h3><p>Could not reach the WEAO API. Try a local server or check your connection.</p><button class="retry-btn" onclick="fetchData()">Retry</button></div>`;
    }
}

// Platform filters (only on main page)
document.querySelectorAll('#platform-filters .filter-chip').forEach(b => {
    b.addEventListener('click', () => {
        document.querySelectorAll('#platform-filters .filter-chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        currentPlatform = b.dataset.filter;
        render();
    });
});

// Type filters
document.querySelectorAll('#type-filters .sub-chip').forEach(b => {
    b.addEventListener('click', () => {
        document.querySelectorAll('#type-filters .sub-chip').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        currentType = b.dataset.filter;
        render();
    });
});

// Sort
const sortEl = document.getElementById('sort-select');
if (sortEl) {
    sortEl.addEventListener('change', e => {
        currentSort = e.target.value;
        render();
    });
}

// Scroll-reveal sections
const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
        if (e.isIntersecting) {
            e.target.classList.add('visible');
            revealObs.unobserve(e.target);
        }
    });
}, { threshold: 0, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// Card scroll-in with stagger
const cardObs = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    visible.forEach((e, i) => {
        setTimeout(() => { e.target.classList.add('in-view'); }, i * 60);
        cardObs.unobserve(e.target);
    });
}, { threshold: 0, rootMargin: '0px 0px -20px 0px' });

let isFirstRender = true;
const origRender = render;
render = function() {
    origRender();
    if (isFirstRender) {
        // First load: animate cards in with stagger
        document.querySelectorAll('.card:not(.in-view)').forEach(c => cardObs.observe(c));
        isFirstRender = false;
    } else {
        // Filter change: show cards immediately, no animation delay
        document.querySelectorAll('.card:not(.in-view)').forEach(c => c.classList.add('in-view'));
    }
};

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        const target = document.querySelector(a.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// Parallax background orbs
const orb1 = document.querySelector('.bg-orb-1');
const orb2 = document.querySelector('.bg-orb-2');
const orb3 = document.querySelector('.bg-orb-3');
if (orb1) {
    window.addEventListener('scroll', () => {
        const y = window.scrollY;
        orb1.style.transform = `translate(-50%, ${y * 0.15}px)`;
        orb2.style.transform = `translate(50%, ${y * -0.1}px)`;
        orb3.style.transform = `translate(-30%, ${y * 0.08}px)`;
    }, { passive: true });
}

// Nav morph on scroll
const nav = document.querySelector('nav');
if (nav) {
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 30);
    }, { passive: true });
}

fetchData();
