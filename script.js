const FIREBASE_URL = "%%FIREBASE_URL%%";

const PAGE_SIZE = 500;

// ── State ──────────────────────────────────────────────────────────────────
let allItems = [];          // deduplicated, sorted master list
let filteredItems = [];     // result of current filters
let visibleCount = PAGE_SIZE;
let activeLetter = null;    // currently selected A-Z letter (null = all)

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    buildAlphabet();
    fetchData();
    setInterval(fetchData, 30000);

    document.getElementById('search-input').addEventListener('input', () => {
        visibleCount = PAGE_SIZE;
        applyFilters();
    });

    document.getElementById('clear-search').addEventListener('click', () => {
        document.getElementById('search-input').value = '';
        visibleCount = PAGE_SIZE;
        applyFilters();
    });

    ['filter-available', 'filter-taken', 'filter-unclear'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            visibleCount = PAGE_SIZE;
            applyFilters();
        });
    });

    document.getElementById('load-more-btn').addEventListener('click', () => {
        visibleCount += PAGE_SIZE;
        renderTable();
    });
});

// ── Fetch ──────────────────────────────────────────────────────────────────
async function fetchData() {
    try {
        const res = await fetch(FIREBASE_URL);
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        if (!data) return;

        // Deduplicate each category and build master list
        const dedup = (arr) => [...new Set((arr || []).map(s => s.trim().toLowerCase()).filter(Boolean))];

        const available = dedup(data.available);
        const taken     = dedup(data.taken);
        const unclear   = dedup(data.unclear);

        // A name should appear in only one category (last write wins: available > unclear > taken)
        const seenAvailable = new Set(available);
        const seenUnclear   = new Set(unclear.filter(n => !seenAvailable.has(n)));
        const seenTaken     = new Set(taken.filter(n => !seenAvailable.has(n) && !seenUnclear.has(n)));

        allItems = [
            ...[...seenAvailable].map(n => ({ name: n, status: 'available' })),
            ...[...seenTaken].map(n => ({ name: n, status: 'taken' })),
            ...[...seenUnclear].map(n => ({ name: n, status: 'unclear' })),
        ].sort((a, b) => a.name.localeCompare(b.name));

        // Update counts in sidebar
        document.getElementById('count-available').textContent = seenAvailable.size.toLocaleString();
        document.getElementById('count-taken').textContent = seenTaken.size.toLocaleString();
        document.getElementById('count-unclear').textContent = seenUnclear.size.toLocaleString();
        document.getElementById('total-count').textContent = allItems.length.toLocaleString();

        if (data.last_updated) {
            const d = new Date(data.last_updated * 1000);
            document.getElementById('last-updated').textContent = d.toLocaleTimeString();
        }

        updateAlphabetState();
        applyFilters();

    } catch (e) {
        console.error('Fetch failed:', e);
    }
}

// ── Filters ────────────────────────────────────────────────────────────────
function applyFilters() {
    const query       = document.getElementById('search-input').value.trim().toLowerCase();
    const showAvail   = document.getElementById('filter-available').checked;
    const showTaken   = document.getElementById('filter-taken').checked;
    const showUnclear = document.getElementById('filter-unclear').checked;

    filteredItems = allItems.filter(item => {
        // Status filter
        if (item.status === 'available' && !showAvail) return false;
        if (item.status === 'taken'     && !showTaken) return false;
        if (item.status === 'unclear'   && !showUnclear) return false;

        // Letter filter (sidebar) — only applied when no search query
        if (!query && activeLetter) {
            if (!item.name.startsWith(activeLetter)) return false;
        }

        // Search — PREFIX match (e.g. "ba" only shows names starting with "ba")
        if (query) {
            if (!item.name.startsWith(query)) return false;
        }

        return true;
    });

    // Banner
    updateBanner(query);
    visibleCount = PAGE_SIZE;
    renderTable();
}

// ── Render ─────────────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('results-body');
    const loadWrap = document.getElementById('load-more-wrap');
    const showingInfo = document.getElementById('showing-info');

    if (filteredItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="msg">No results found.</td></tr>`;
        loadWrap.classList.add('hidden');
        return;
    }

    const slice = filteredItems.slice(0, visibleCount);

    tbody.innerHTML = slice.map(item => `
        <tr>
            <td>${escHtml(item.name)}</td>
            <td><span class="badge ${item.status}">${item.status}</span></td>
        </tr>
    `).join('');

    if (filteredItems.length > visibleCount) {
        loadWrap.classList.remove('hidden');
        showingInfo.textContent = `Showing ${visibleCount.toLocaleString()} of ${filteredItems.length.toLocaleString()}`;
    } else {
        loadWrap.classList.add('hidden');
        showingInfo.textContent = '';
    }
}

// ── Alphabet sidebar ───────────────────────────────────────────────────────
function buildAlphabet() {
    const grid = document.getElementById('alphabet-grid');
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
        const btn = document.createElement('button');
        btn.className = 'letter-btn';
        btn.id = `letter-${letter}`;
        btn.textContent = letter;
        btn.addEventListener('click', () => selectLetter(letter));
        grid.appendChild(btn);
    });
}

function selectLetter(letter) {
    const lower = letter.toLowerCase();

    // Check if the letter has been reached at all yet
    const hasAny = allItems.some(item => item.name.startsWith(lower));

    if (!hasAny) {
        showToast(`Script hasn't reached '${letter}' yet — check back later.`);
        return;
    }

    // Toggle off if already active
    if (activeLetter === lower) {
        activeLetter = null;
        document.getElementById(`letter-${letter}`).classList.remove('active');
    } else {
        activeLetter = lower;
        document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`letter-${letter}`).classList.add('active');
        // Clear the search when using the letter selector
        document.getElementById('search-input').value = '';
    }

    visibleCount = PAGE_SIZE;
    applyFilters();
}

function updateAlphabetState() {
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(letter => {
        const btn = document.getElementById(`letter-${letter}`);
        if (!btn) return;
        const hasAny = allItems.some(item => item.name.startsWith(letter.toLowerCase()));
        btn.classList.toggle('unreached', !hasAny);
    });
}

// ── Banner ─────────────────────────────────────────────────────────────────
function updateBanner(query) {
    const banner = document.getElementById('active-filter-banner');
    let msg = null;

    if (query) {
        msg = `Showing names starting with "<strong>${escHtml(query)}</strong>"`;
    } else if (activeLetter) {
        msg = `Showing names starting with "<strong>${activeLetter.toUpperCase()}</strong>"`;
    }

    if (msg) {
        banner.classList.remove('hidden');
        banner.innerHTML = `<span>${msg}</span><button onclick="clearAllFilters()">Clear</button>`;
    } else {
        banner.classList.add('hidden');
    }
}

function clearAllFilters() {
    document.getElementById('search-input').value = '';
    activeLetter = null;
    document.querySelectorAll('.letter-btn').forEach(b => b.classList.remove('active'));
    visibleCount = PAGE_SIZE;
    applyFilters();
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

// ── Utils ──────────────────────────────────────────────────────────────────
function escHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
