
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyBVs1nDI6iSllSxSLlYqsd97GA_33nJTbU",
    authDomain: "current-calc.firebaseapp.com",
    databaseURL: "https://current-calc-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "current-calc",
    storageBucket: "current-calc.firebasestorage.app",
    messagingSenderId: "42380708178",
    appId: "1:42380708178:web:b9780af8179938b949928b"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const WORKER_URL = 'https://currency-updater-worker.carbonsrv.workers.dev/';

let isAuthenticated = false;
let currentUser = null;
let isUpdating = false;
let initialLoadComplete = false;

// Compact UX Status Controller
const statusController = {
    pill: document.getElementById('statusPill'),
    subtitle: document.getElementById('statusSubtitle'),
    
    icons: {
        cloud: `<svg class="cloud-icon-compact" viewBox="0 0 24 24"><path class="cloud-base" d="M18.5 12c.8 0 1.5.2 2.2.6 1.3.7 2.1 2 2.3 3.4.1 1.4-.5 2.8-1.5 3.7-.9.8-2.1 1.3-3.3 1.3H6.5c-1.8 0-3.4-1-4.2-2.6-.8-1.6-.6-3.5.5-4.9.9-1.2 2.3-1.9 3.8-1.9.1 0 .2 0 .3.1C7.2 8.3 9.9 6 13 6c2.8 0 5.3 1.7 6.4 4.2.3.1.7.1 1.1.1z"/></svg>`,
        cache: `<svg class="cloud-icon-compact" viewBox="0 0 24 24"><path class="cloud-base" d="M18.5 12c.8 0 1.5.2 2.2.6 1.3.7 2.1 2 2.3 3.4.1 1.4-.5 2.8-1.5 3.7-.9.8-2.1 1.3-3.3 1.3H6.5c-1.8 0-3.4-1-4.2-2.6-.8-1.6-.6-3.5.5-4.9.9-1.2 2.3-1.9 3.8-1.9.1 0 .2 0 .3.1C7.2 8.3 9.9 6 13 6c2.8 0 5.3 1.7 6.4 4.2.3.1.7.1 1.1.1z"/><circle cx="18" cy="18" r="4" fill="#27ae60"/><path d="M16 18l1.5 1.5 3-3" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        static: `<svg class="cloud-icon-compact" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" opacity="0.4"/><path d="M9 12h6M9 15h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
        error: `<svg class="cloud-icon-compact" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="currentColor" opacity="0.2"/><path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
        offline: `<svg class="cloud-icon-compact" viewBox="0 0 24 24"><path class="cloud-base" d="M18.5 12c.8 0 1.5.2 2.2.6 1.3.7 2.1 2 2.3 3.4.1 1.4-.5 2.8-1.5 3.7-.9.8-2.1 1.3-3.3 1.3H6.5c-1.8 0-3.4-1-4.2-2.6-.8-1.6-.6-3.5.5-4.9.9-1.2 2.3-1.9 3.8-1.9.1 0 .2 0 .3.1C7.2 8.3 9.9 6 13 6c2.8 0 5.3 1.7 6.4 4.2.3.1.7.1 1.1.1z" opacity="0.4"/><line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    },

    titles: {
        cloud: 'Хмара',
        cache: 'Кеш',
        static: 'Статика',
        error: 'Помилка',
        offline: 'Офлайн'
    },

    set(state, subtitle = null, loading = false) {
        const isLoading = loading || state === 'cloud';
        this.pill.className = `status-pill status-${state} ${isLoading ? 'loading active' : ''}`;
        this.pill.innerHTML = `
            <div class="status-icon-compact">
                ${this.icons[state]}
                <div class="sync-ring"></div>
            </div>
            <div class="status-text-compact">
                <div class="status-title-compact">
                    ${this.titles[state]}
                    ${isLoading ? '<div class="live-dot"></div>' : ''}
                </div>
                <div class="status-subtitle-compact">${subtitle || this.getDefaultSubtitle(state)}</div>
            </div>
        `;
        this.subtitle = this.pill.querySelector('.status-subtitle-compact');
    },

    updateSubtitle(text) {
        if (this.subtitle) this.subtitle.textContent = text;
    },

    getDefaultSubtitle(state) {
        const defaults = {
            cloud: 'Завантаження...',
            cache: 'Актуальні дані',
            static: 'API недоступне',
            error: 'Немає з\'єднання',
            offline: 'Дані застарілі'
        };
        return defaults[state];
    }
};

const currencySymbols = { UAH: '₴', USD: '$', EUR: '€' };
const currencyNames = { UAH: 'ГРН', USD: 'USD', EUR: 'EUR' };
const currencyOrder = ['UAH', 'USD', 'EUR'];

const SIGNIFICANT_CHANGE_THRESHOLD = 0.005;
const UPDATE_COOLDOWN = 30000;
const LOCAL_CACHE_KEY = 'currencycalc-last-rates-v2';
const LOCAL_CACHE_MAX_AGE = 12 * 60 * 60 * 1000;

let currentDisplay = '1';
let currentCurrency = 'USD';
let exchangeRates = {
    privatbank: { USD: {}, EUR: {} },
    monobank: { USD: {}, EUR: {} },
    nbu: { usd: null, pln: null },
    raiffeisen: { USD: { buy: 37.15, sell: 38.45 }, EUR: { buy: 40.05, sell: 41.35 } },
    ukreximbank: { USD: { buy: 37.10, sell: 38.30 }, EUR: { buy: 40.00, sell: 41.20 } }
};
let privatbankAvailable = false;
let monobankAvailable = false;
let isFirstInput = true;
let lastUpdateTime = 0;
let rtdbListener = null;

function getTodayDate() {
    return new Date().toISOString().split('T')[0];
}

async function initAuth() {
    return new Promise(async (resolve) => {
        const timeout = setTimeout(() => resolve(false), 5000);
        try {
            if (isAuthenticated && currentUser) {
                clearTimeout(timeout);
                resolve(true);
                return;
            }
            const userCredential = await signInAnonymously(auth);
            currentUser = userCredential.user;
            isAuthenticated = true;
            clearTimeout(timeout);
            resolve(true);
        } catch (error) {
            console.error('Auth error:', error);
            clearTimeout(timeout);
            resolve(false);
        }
    });
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        isAuthenticated = true;
        setupRealtimeListener();
    } else {
        isAuthenticated = false;
        currentUser = null;
    }
});

async function loadFromRTDBCache() {
    try {
        const today = getTodayDate();
        const ratesRef = ref(db, `exchangeRates/${today}`);
        const snapshot = await get(ratesRef);
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('RTDB cache error:', error);
        return null;
    }
}

function setupRealtimeListener() {
    if (rtdbListener) {
        rtdbListener();
        rtdbListener = null;
    }
    
    const today = getTodayDate();
    const ratesRef = ref(db, `exchangeRates/${today}`);
    
    rtdbListener = onValue(ratesRef, (snapshot) => {
        if (snapshot.exists()) {
            handleRatesUpdate(snapshot.val(), true);
            if (!initialLoadComplete) initialLoadComplete = true;
        }
    }, (error) => {
        console.error('RTDB listener error:', error);
    });
}

function handleRatesUpdate(data, isRealtime = false) {
    let changed = false;
    const oldRates = JSON.parse(JSON.stringify(exchangeRates));
    
    if (data.privatbank) {
        if (hasSignificantChange(oldRates.privatbank, data.privatbank)) changed = true;
        exchangeRates.privatbank = data.privatbank;
        privatbankAvailable = true;
    }
    
    if (data.monobank) {
        if (hasSignificantChange(oldRates.monobank, data.monobank)) changed = true;
        exchangeRates.monobank = data.monobank;
        monobankAvailable = true;
    }

    if (data.nbu) {
        exchangeRates.nbu = data.nbu;
    }

    if (data.nbu) {
        exchangeRates.nbu = data.nbu;
    }
    
    calculateRates();
    
    if (isRealtime && changed && !isUpdating) {
        statusController.set('cache', 'Нові курси!');
        setTimeout(() => statusController.set('cache'), 2000);
    }
}

function hasSignificantChange(oldRates, newRates) {
    if (!oldRates || !newRates) return true;
    const currencies = ['USD', 'EUR'];
    const types = ['buy', 'sell'];
    
    for (const curr of currencies) {
        for (const type of types) {
            const oldVal = oldRates[curr]?.[type];
            const newVal = newRates[curr]?.[type];
            if (!oldVal || !newVal) continue;
            if (Math.abs(newVal - oldVal) / oldVal > SIGNIFICANT_CHANGE_THRESHOLD) return true;
        }
    }
    return false;
}

function saveRatesToLocalCache() {
    try {
        const payload = {
            timestamp: Date.now(),
            rates: { monobank: exchangeRates.monobank, privatbank: exchangeRates.privatbank },
            available: { monobank: monobankAvailable, privatbank: privatbankAvailable }
        };
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
        console.warn('Local cache save failed:', error);
    }
}

function loadFromLocalCache() {
    try {
        const raw = localStorage.getItem(LOCAL_CACHE_KEY);
        if (!raw) return false;
        const payload = JSON.parse(raw);
        if (!payload?.timestamp || !payload?.rates) return false;
        if (Date.now() - payload.timestamp > LOCAL_CACHE_MAX_AGE) return false;

        if (payload.rates.monobank) {
            exchangeRates.monobank = payload.rates.monobank;
            monobankAvailable = !!payload.available?.monobank;
        }
        if (payload.rates.privatbank) {
            exchangeRates.privatbank = payload.rates.privatbank;
            privatbankAvailable = !!payload.available?.privatbank;
        }
        calculateRates();
        return monobankAvailable || privatbankAvailable;
    } catch (error) {
        return false;
    }
}

async function loadExchangeRates(forceUpdate = false) {
    const btn = document.getElementById('refresh-btn');
    const now = Date.now();
    
    if (!forceUpdate && (now - lastUpdateTime < UPDATE_COOLDOWN)) {
        statusController.set('cache', 'Зачекайте...', false);
        setTimeout(() => statusController.set('cache'), 1500);
        return;
    }
    
    if (isUpdating) return;
    isUpdating = true;
    lastUpdateTime = now;
    
    btn.disabled = true;
    btn.classList.add('updating');
    statusController.set('cloud', 'Оновлення...', true);
    
    try {
        statusController.updateSubtitle('Запит до Worker...');
        const response = await fetch(WORKER_URL);
        const result = await response.json();
        
        if (result.success) {
            handleRatesUpdate(result.data, false);
            saveRatesToLocalCache();
            statusController.set('cache', 'Оновлено!', false);
            setTimeout(() => statusController.set('cache'), 2000);
        } else {
            throw new Error(result.error || 'Помилка Worker');
        }
    } catch (error) {
        console.error('Update error:', error);
        statusController.set('error', 'Помилка', false);
    } finally {
        isUpdating = false;
        btn.disabled = false;
        btn.classList.remove('updating');
    }
}

// Calculator functions
function updateDisplay() {
    document.getElementById('display').textContent = currentDisplay;
    const toggleBtn = document.getElementById('currency-toggle');
    toggleBtn.textContent = currencyNames[currentCurrency];
    document.getElementById('amount-title').textContent = `${parseFloat(currentDisplay).toFixed(2)} ${currencyNames[currentCurrency]} =`;
}

function appendToDisplay(value) {
    if (isFirstInput && !['+','-','*','/'].includes(value)) {
        currentDisplay = value;
        isFirstInput = false;
    } else if (['+','-','*','/'].includes(value) && ['+','-','*','/'].includes(currentDisplay.slice(-1))) {
        currentDisplay = currentDisplay.slice(0, -1) + value;
    } else {
        currentDisplay += value;
    }
    updateDisplay();
    calculateRates();
}

function backspace() {
    if (currentDisplay.length > 1) {
        currentDisplay = currentDisplay.slice(0, -1);
    } else {
        currentDisplay = '1';
        isFirstInput = true;
    }
    updateDisplay();
    calculateRates();
}

function clearDisplay() {
    currentDisplay = '1';
    isFirstInput = true;
    updateDisplay();
    calculateRates();
}

function plusMinus() {
    if (currentDisplay.startsWith('-')) {
        currentDisplay = currentDisplay.substring(1);
    } else if (currentDisplay !== '0') {
        currentDisplay = '-' + currentDisplay;
    }
    updateDisplay();
    calculateRates();
}

function cycleCurrency() {
    const idx = currencyOrder.indexOf(currentCurrency);
    setCurrency(currencyOrder[(idx + 1) % currencyOrder.length]);
}

function setCurrency(currency) {
    if (currentCurrency !== currency) {
        currentCurrency = currency;
        updateDisplay();
        calculateRates();
    }
}

function calculate() {
    try {
        currentDisplay = eval(currentDisplay).toString();
        updateDisplay();
        calculateRates();
    } catch (error) {
        document.getElementById('results').innerHTML = `<div class="error-message">Невірний вираз</div>`;
    }
}

function calculateRates() {
    try {
        let amount = parseFloat(currentDisplay);
        if (isNaN(amount)) amount = 1;
        
        document.getElementById('amount-title').textContent = `${amount.toFixed(2)} ${currencyNames[currentCurrency]} =`;
        const resultsDiv = document.getElementById('results');
        const timeStr = new Date().toLocaleTimeString('uk-UA', {hour: '2-digit', minute:'2-digit'});
        
        let html = '';
        html += `
            <div class="bank-card monobank-card ${!monobankAvailable ? 'error' : ''}">
                <div class="bank-header">
                    <div class="bank-logo ${!monobankAvailable ? 'error-logo' : ''}">M</div>
                    <div>Monobank ${!monobankAvailable ? '<span class="static-data-message">(статика)</span>' : ''}</div>
                </div>
                ${monobankAvailable ? generateRows('monobank', amount) : generateError()}
                <div class="update-info">${timeStr}</div>
            </div>`;
        html += `
            <div class="bank-card privatbank-card ${!privatbankAvailable ? 'error' : ''}">
                <div class="bank-header">
                    <div class="bank-logo ${!privatbankAvailable ? 'error-logo' : ''}">П</div>
                    <div>ПриватБанк <span class="cashless-message">картки</span> ${!privatbankAvailable ? '<span class="static-data-message">(статика)</span>' : ''}</div>
                </div>
                ${privatbankAvailable ? generateRows('privatbank', amount) : generateError()}
            </div>`;
        html += `
            <div class="bank-card raiffeisen-card">
                <div class="bank-header">
                    <div class="bank-logo">Р</div>
                    <div>Райффайзен <span class="static-data-message">(статика)</span></div>
                </div>
                ${generateRows('raiffeisen', amount)}
            </div>`;
        html += `
            <div class="bank-card ukreximbank-card">
                <div class="bank-header">
                    <div class="bank-logo">У</div>
                    <div>Укрексімбанк <span class="static-data-message">(статика)</span></div>
                </div>
                ${generateRows('ukreximbank', amount)}
            </div>`;

        // NBU Card
        const nbu = exchangeRates.nbu;
        const nbuAvailable = nbu.usd || nbu.pln;
        html += `
            <div class="bank-card nbu-card ${!nbuAvailable ? 'error' : ''}">
                <div class="bank-header">
                    <div class="bank-logo ${!nbuAvailable ? 'error-logo' : ''}">Н</div>
                    <div>Нацбанк України ${!nbuAvailable ? '<span class="static-data-message">(статика)</span>' : ''}</div>
                </div>
                ${nbuAvailable ? generateNBURows(amount) : generateError()}
            </div>`;

        resultsDiv.innerHTML = html;
    } catch (error) {
        console.error('Calculate error:', error);
    }
}

function generateRows(bank, amount) {
    if (currentCurrency === 'UAH') {
        return `
            <div class="rate-row"><span>USD купівля:</span><span class="rate-value">${(amount / exchangeRates[bank].USD.buy).toFixed(2)} $</span></div>
            <div class="rate-row"><span>USD продаж:</span><span class="rate-value">${(amount / exchangeRates[bank].USD.sell).toFixed(2)} $</span></div>
            <div class="rate-row"><span>EUR купівля:</span><span class="rate-value">${(amount / exchangeRates[bank].EUR.buy).toFixed(2)} €</span></div>`;
    } else {
        const curr = currentCurrency;
        const other = curr === 'USD' ? 'EUR' : 'USD';
        const crossRate = curr === 'USD' 
            ? (exchangeRates[bank].EUR.buy / exchangeRates[bank].USD.sell)
            : (exchangeRates[bank].USD.buy / exchangeRates[bank].EUR.sell);
        return `
            <div class="rate-row"><span>UAH купівля:</span><span class="rate-value">${(amount * exchangeRates[bank][curr].buy).toFixed(2)} ₴</span></div>
            <div class="rate-row"><span>UAH продаж:</span><span class="rate-value">${(amount * exchangeRates[bank][curr].sell).toFixed(2)} ₴</span></div>
            <div class="rate-row"><span>${other}:</span><span class="rate-value">${(amount * crossRate).toFixed(2)} ${currencySymbols[other]}</span></div>`;
    }
}

function generateNBURows(amount) {
    const nbu = exchangeRates.nbu;
    if (!nbu.usd && !nbu.pln) return generateError();

    if (currentCurrency === 'UAH') {
        return `
            <div class="rate-row"><span>USD офіційний:</span><span class="rate-value">${nbu.usd ? (amount / nbu.usd).toFixed(2) + ' $' : 'Н/Д'}</span></div>
            <div class="rate-row"><span>PLN офіційний:</span><span class="rate-value">${nbu.pln ? (amount / nbu.pln).toFixed(2) + ' zł' : 'Н/Д'}</span></div>`;
    } else {
        const curr = currentCurrency;
        if (curr === 'USD') {
            return `
                <div class="rate-row"><span>UAH офіційний:</span><span class="rate-value">${nbu.usd ? (amount * nbu.usd).toFixed(2) + ' ₴' : 'Н/Д'}</span></div>
                <div class="rate-row"><span>PLN офіційний:</span><span class="rate-value">${(nbu.usd && nbu.pln) ? (amount * (nbu.pln / nbu.usd)).toFixed(2) + ' zł' : 'Н/Д'}</span></div>`;
        } else if (curr === 'EUR') {
            // NBU EUR is not currently fetched by Worker, but we can show USD/PLN cross if needed
            return `
                <div class="rate-row"><span>USD офіційний:</span><span class="rate-value">Н/Д</span></div>
                <div class="rate-row"><span>PLN офіційний:</span><span class="rate-value">Н/Д</span></div>
                <div class="error-message" style="font-size: 9px">Курс EUR НБУ не налаштовано</div>`;
        }
        return generateError();
    }
}

function generateError() {
    return `<div class="error-message">Не вдалося завантажити актуальні курси</div><div class="static-data-message">Використовуються статичні дані</div>`;
}

window.cycleCurrency = cycleCurrency;
window.loadExchangeRates = loadExchangeRates;
window.clearDisplay = clearDisplay;
window.appendToDisplay = appendToDisplay;
window.backspace = backspace;
window.plusMinus = plusMinus;
window.calculate = calculate;

document.addEventListener('DOMContentLoaded', () => {
    currentDisplay = '1';
    currentCurrency = 'USD';
    updateDisplay();
    document.getElementById('currency-toggle').addEventListener('click', cycleCurrency);
    
    statusController.set('cache', 'Завантаження кешу...', true);
    if (loadFromLocalCache()) {
        statusController.set('cache', 'Локальний кеш', false);
    }
    
    initAuth().then(() => {
        loadFromRTDBCache().then(data => {
            if (data) {
                handleRatesUpdate(data, false);
                statusController.set('cache', 'Кеш завантажено', false);
            } else {
                statusController.set('cloud', 'Очікування...', true);
            }
        });
    });
    
    setTimeout(() => {
        loadExchangeRates(true);
    }, 100);
    
    setInterval(() => {
        const now = Date.now();
        if (now - lastUpdateTime > 10 * 60 * 1000 && !isUpdating) {
            loadExchangeRates(false);
        }
    }, 60000);
});
