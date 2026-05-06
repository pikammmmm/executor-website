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

// Always proxy logo images via images.weserv.nl. We can't attempt the direct
// URL first because browsers log net::ERR_SSL_PROTOCOL_ERROR to the console
// regardless of any onerror handler — the only way to keep the console clean
// on affected machines is to never request the direct URL at all.
function proxyLogoUrl(url) {
    if (!url) return '';
    return 'https://images.weserv.nl/?url=' + encodeURIComponent(url.replace(/^https?:\/\//, ''));
}

function imgFallbackHandler(letter) {
    const safeLetter = String(letter).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `(function(img){img.onerror=null;img.parentElement.textContent='${safeLetter}';})(this)`;
}

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
    if (ex.keysystem) f.push('Key System');
    if (f.length) feats = `<div class="card-features">${f.map(x => `<span class="feat">${x}</span>`).join('')}</div>`;

    let badges = '';
    const b = [];
    if (ex.beta) b.push('<span class="tag tag-beta">Beta</span>');
    if (ex.elementCertified) b.push('<span class="tag tag-certified">Certified</span>');
    if (ex.hasIssues) b.push('<span class="tag tag-issues">Has Issues</span>');
    if (b.length) badges = b.join('');

    let desc = '';
    const fullDesc = ex.slug?.fullDescription;
    if (fullDesc && fullDesc !== 'No description currently available. Check back soon!') {
        const short = fullDesc.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        const truncated = short.length > 120 ? short.substring(0, 120) + '...' : short;
        desc = `<div class="card-desc">${truncated}</div>`;
    }

    const owner = ex.slug?.owner;
    let ownerHtml = '';
    if (owner) ownerHtml = `<div class="card-owner">by ${owner}</div>`;

    let actions = '';
    const links = [];
    if (ex.websitelink) links.push(`<a href="${ex.websitelink}" target="_blank" class="card-btn">Website</a>`);
    if (ex.discordlink) links.push(`<a href="${ex.discordlink}" target="_blank" class="card-btn">Discord</a>`);
    if (ex.purchaselink) links.push(`<a href="${ex.purchaselink}" target="_blank" class="card-btn card-btn-buy">Buy</a>`);
    if (links.length) actions = `<div class="card-actions">${links.join('')}</div>`;

    el.innerHTML = `
        <div class="card-glow"></div>
        <div class="card-top">
            <div class="card-avatar">${logo ? `<img src="${proxyLogoUrl(logo)}" alt="${ex.title}" onerror="${imgFallbackHandler(ex.title[0])}">` : ex.title[0]}</div>
            <div class="card-info">
                <div class="card-name">${ex.title}</div>
                <div class="card-tags">
                    <span class="tag ${ex.free ? 'tag-free' : 'tag-paid'}">${ex.free ? 'Free' : 'Paid'}</span>
                    <span class="tag tag-platform">${ex.platform || '?'}</span>
                    ${isExt(ex.extype) ? '<span class="tag tag-ext">External</span>' : ''}
                    ${badges}
                </div>
            </div>
        </div>
        ${ownerHtml}
        ${detected}
        ${desc}
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

async function tryFetch(url, options) {
    const r = await fetch(url, options);
    if (!r.ok) throw new Error(r.status);
    return r.json();
}

async function fetchData() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('grid').innerHTML = '';
    try {
        let data;
        // If a previous visit on this machine failed the direct call, skip it
        // to avoid logging the SSL error to the console again.
        const skipDirect = (() => {
            try { return localStorage.getItem('weao_skip_direct') === '1'; } catch (_) { return false; }
        })();

        if (!skipDirect) {
            try {
                data = await tryFetch(API_URL);
            } catch (e1) {
                try { localStorage.setItem('weao_skip_direct', '1'); } catch (_) {}
            }
        }
        if (data == null) {
            try {
                data = await tryFetch('https://corsproxy.io/?' + encodeURIComponent(API_URL));
            } catch (e2) {
                data = await tryFetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(API_URL));
            }
        }

        allExecutors = Array.isArray(data) ? data : [];
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
        document.getElementById('loading').innerHTML = `<div class="error-box"><h3>Failed to connect</h3><p>Could not reach the WEAO API. This may be a CORS or network issue.</p><button class="retry-btn" onclick="fetchData()">Retry</button></div>`;
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
}, { threshold: 0, rootMargin: '0px 0px -60px 0px' });
document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

// Card scroll-in with stagger + random directions
const cardObs = new IntersectionObserver((entries) => {
    const visible = entries.filter(e => e.isIntersecting);
    visible.forEach((e, i) => {
        const card = e.target;
        const directions = ['slide-up', 'slide-left', 'slide-right', 'slide-scale'];
        const dir = directions[i % directions.length];
        card.classList.add(dir);
        setTimeout(() => {
            card.classList.add('in-view');
        }, i * 80);
        cardObs.unobserve(card);
    });
}, { threshold: 0, rootMargin: '0px 0px -30px 0px' });

let isFirstRender = true;
const origRender = render;
render = function() {
    origRender();
    if (isFirstRender) {
        document.querySelectorAll('.card:not(.in-view)').forEach(c => cardObs.observe(c));
        isFirstRender = false;
    } else {
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

// Parallax background orbs + page cards + stats on scroll
const orb1 = document.querySelector('.bg-orb-1');
const orb2 = document.querySelector('.bg-orb-2');
const orb3 = document.querySelector('.bg-orb-3');

let ticking = false;
window.addEventListener('scroll', () => {
    if (!ticking) {
        requestAnimationFrame(() => {
            const y = window.scrollY;

            // Orb parallax
            if (orb1) {
                orb1.style.transform = `translate(-50%, ${y * 0.2}px)`;
                orb2.style.transform = `translate(50%, ${y * -0.12}px)`;
                orb3.style.transform = `translate(-30%, ${y * 0.1}px)`;
            }

            // Nav morph
            const nav = document.querySelector('nav');
            if (nav) nav.classList.toggle('scrolled', y > 30);

            // Parallax tilt on page cards
            document.querySelectorAll('.page-card').forEach((card, i) => {
                const rect = card.getBoundingClientRect();
                const visible = rect.top < window.innerHeight && rect.bottom > 0;
                if (visible) {
                    const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
                    const shift = (progress - 0.5) * 10;
                    card.style.transform = `translateY(${shift * (i % 2 === 0 ? -1 : 1)}px)`;
                }
            });

            // Parallax on stat items
            document.querySelectorAll('.stat-item').forEach((stat, i) => {
                const rect = stat.getBoundingClientRect();
                if (rect.top < window.innerHeight) {
                    const progress = (window.innerHeight - rect.top) / window.innerHeight;
                    stat.style.transform = `translateY(${(1 - progress) * 15}px)`;
                    stat.style.opacity = Math.min(progress * 1.5, 1);
                }
            });

            // Score bars re-trigger animation when visible
            document.querySelectorAll('.score-bar-fill').forEach(bar => {
                const rect = bar.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    bar.classList.add('bar-visible');
                }
            });

            // Toolbar fade on scroll
            const toolbar = document.querySelector('.toolbar');
            if (toolbar) {
                const rect = toolbar.getBoundingClientRect();
                if (rect.top < window.innerHeight) {
                    const progress = Math.min((window.innerHeight - rect.top) / 200, 1);
                    toolbar.style.opacity = progress;
                    toolbar.style.transform = `translateY(${(1 - progress) * 20}px)`;
                }
            }

            ticking = false;
        });
        ticking = true;
    }
}, { passive: true });

// Mouse-tracking glow on cards
document.addEventListener('mousemove', (e) => {
    document.querySelectorAll('.card').forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const glow = card.querySelector('.card-glow');
        if (glow) {
            glow.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255,255,255,0.05) 0%, transparent 50%)`;
        }
    });

    // Subtle tilt on page cards based on mouse
    document.querySelectorAll('.page-card').forEach(card => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / rect.width;
        const dy = (e.clientY - cy) / rect.height;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 2) {
            card.style.setProperty('--rx', (dy * -4).toFixed(2) + 'deg');
            card.style.setProperty('--ry', (dx * 4).toFixed(2) + 'deg');
        }
    });
});

// Hero text shimmer on load
window.addEventListener('load', () => {
    document.querySelectorAll('.hero-line').forEach((line, i) => {
        setTimeout(() => line.classList.add('shimmer-done'), 600 + i * 300);
    });

    // Stagger page cards entrance
    document.querySelectorAll('.page-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        setTimeout(() => {
            card.style.transition = 'opacity 0.8s cubic-bezier(0.22, 1, 0.36, 1), transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 400 + i * 100);
    });
});

fetchData();
