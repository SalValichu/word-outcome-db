const FIREBASE_URL = "https://word-outcomes-default-rtdb.firebaseio.com//outcomes.json";

let globalData = {
    available: [],
    taken: [],
    unclear: []
};

function init() {
    fetchData();
    setInterval(fetchData, 30000);

    document.getElementById('search-input').addEventListener('input', renderTable);
    document.getElementById('filter-available').addEventListener('change', renderTable);
    document.getElementById('filter-taken').addEventListener('change', renderTable);
    document.getElementById('filter-unclear').addEventListener('change', renderTable);
}

async function fetchData() {
    if (FIREBASE_URL.includes("YOUR-FIREBASE-PROJECT-ID")) {
        document.getElementById('results-body').innerHTML = `<tr><td colspan="2" class="loading" style="color: red;">Setup required! Please update the FIREBASE_URL in script.js and sync.py.</td></tr>`;
        return;
    }

    try {
        const response = await fetch(FIREBASE_URL);
        if (!response.ok) throw new Error("Failed to fetch");

        const data = await response.json();
        if (data) {
            globalData.available = data.available || [];
            globalData.taken = data.taken || [];
            globalData.unclear = data.unclear || [];

            document.getElementById('count-available').textContent = globalData.available.length;
            document.getElementById('count-taken').textContent = globalData.taken.length;
            document.getElementById('count-unclear').textContent = globalData.unclear.length;

            if (data.last_updated) {
                const date = new Date(data.last_updated * 1000);
                document.getElementById('last-updated').textContent = date.toLocaleTimeString();
            }

            renderTable();
        }
    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function renderTable() {
    const searchQuery = document.getElementById('search-input').value.toLowerCase();
    const showAvailable = document.getElementById('filter-available').checked;
    const showTaken = document.getElementById('filter-taken').checked;
    const showUnclear = document.getElementById('filter-unclear').checked;

    const tbody = document.getElementById('results-body');
    tbody.innerHTML = '';

    let allItems = [];

    if (showAvailable) allItems = allItems.concat(globalData.available.map(name => ({ name, status: 'available' })));
    if (showTaken) allItems = allItems.concat(globalData.taken.map(name => ({ name, status: 'taken' })));
    if (showUnclear) allItems = allItems.concat(globalData.unclear.map(name => ({ name, status: 'unclear' })));

    if (searchQuery) {
        allItems = allItems.filter(item => item.name.toLowerCase().includes(searchQuery));
    }

    allItems.sort((a, b) => a.name.localeCompare(b.name));

    if (allItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="loading">No results found</td></tr>`;
        return;
    }

    const renderLimit = 500;
    const itemsToRender = allItems.slice(0, renderLimit);

    const rowsHTML = itemsToRender.map(item => `
        <tr>
            <td>${item.name}</td>
            <td><span class="status-badge status-${item.status}">${item.status}</span></td>
        </tr>
    `).join('');

    let extraHTML = '';
    if (allItems.length > renderLimit) {
        extraHTML = `<tr><td colspan="2" class="loading">Showing first ${renderLimit} of ${allItems.length} results. Use search to find specific users.</td></tr>`;
    }

    tbody.innerHTML = rowsHTML + extraHTML;
}

document.addEventListener('DOMContentLoaded', init);
