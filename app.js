let tg = window.Telegram.WebApp;
let tenant_id = null;
let activeCall = null;
let notificationSound = new Audio('notification.mp3');
let initData = window.Telegram.WebApp.initData || '';

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    tg.expand();
    tg.ready();
    checkAuth();
});

// Вспомогательные функции для UI
function showAuthScreen() {
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('mainScreen').classList.add('hidden');
}

function showMainScreen() {
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    connectWebSocket(); // Подключаем WebSocket при входе
}

function showTab(tabName) {
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.add('hidden'));
    document.getElementById(`${tabName}List`).classList.remove('hidden');
    
    // Обновляем активную кнопку
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Загружаем данные для таба
    if (tabName === 'domofons') {
        loadDomofons();
    } else {
        loadApartments();
    }
}

// Функции для работы с API
async function checkAuth() {
    const userId = tg.initDataUnsafe?.user?.id;
    if (!userId) {
        showAuthScreen();
        return;
    }
    
    // Ищем tenant_id по chat_id в маппинге
    for (let [tid, chatId] of Object.entries(CHAT_ID_MAPPING)) {
        if (chatId === userId.toString()) {
            tenant_id = parseInt(tid);
            showMainScreen();
            loadDomofons();
            return;
        }
    }
    showAuthScreen();
}

// Добавляем кэш для данных
const cache = {
    domofons: null,
    apartments: null,
    lastUpdate: {
        domofons: 0,
        apartments: 0
    }
};

const CACHE_LIFETIME = 5 * 60 * 1000; // 5 минут

// Функции для работы с лоадером
function showLoader(id) {
    document.getElementById(id).classList.add('loading');
}

function hideLoader(id) {
    document.getElementById(id).classList.remove('loading');
}

// Обновляем функцию sendPhone
async function sendPhone() {
    const phone = document.getElementById('phoneInput').value.replace(/\D/g, '');
    
    // Ищем tenant_id по номеру телефона в маппинге
    for (let [tid, phoneNum] of Object.entries(PHONE_MAPPING)) {
        if (phoneNum.toString() === phone) {
            tenant_id = parseInt(tid);
            showMainScreen();
            loadDomofons();
            return;
        }
    }
    
    tg.showAlert('Номер телефона не найден');
}

// Обновляем функцию loadDomofons с кэшированием
async function loadDomofons() {
    const now = Date.now();
    
    // Проверяем кэш
    if (cache.domofons && (now - cache.lastUpdate.domofons < CACHE_LIFETIME)) {
        renderDomofons(cache.domofons);
        return;
    }

    try {
        showLoader('domofonsLoader');
        const response = await fetch(`${API_URL}/domo.domofon`, {
            headers: {
                'x-api-key': API_TOKEN,
                'Content-Type': 'application/json'
            },
            params: { tenant_id }
        });
        
        const domofons = await response.json();
        
        // Обновляем кэш
        cache.domofons = domofons;
        cache.lastUpdate.domofons = now;
        
        renderDomofons(domofons);
    } catch (error) {
        console.error('Ошибка загрузки домофонов:', error);
        tg.showAlert('Ошибка загрузки списка домофонов');
        document.getElementById('domofonsList').innerHTML = `
            <div class="error-message">
                Не удалось загрузить список домофонов
                <button onclick="loadDomofons()">Повторить</button>
            </div>
        `;
    } finally {
        hideLoader('domofonsLoader');
    }
}

// Функция рендеринга домофонов
function renderDomofons(domofons) {
    const container = document.getElementById('domofonsList');
    container.innerHTML = domofons.map(domofon => `
        <div class="domofon-card fade-in">
            <h3>${domofon.name}</h3>
            <div class="domofon-actions">
                <button onclick="getDomophoneSnapshot(${domofon.id}, this)">📷 Камера</button>
                <button onclick="openDoor(${domofon.id}, this)">🔓 Открыть</button>
            </div>
        </div>
    `).join('');
}

async function loadApartments() {
    try {
        const response = await fetch(`${API_URL}/domo.apartment`, {
            headers: {
                'x-api-key': API_TOKEN,
                'Content-Type': 'application/json'
            },
            params: { tenant_id }
        });
        
        const apartments = await response.json();
        const container = document.getElementById('apartmentsList');
        container.innerHTML = apartments.map(apt => `
            <div class="apartment-card">
                <h3>Квартира ${apt.location?.apartments_number || ''}</h3>
                <p>Адрес: ${apt.location?.readable_address || 'Не указан'}</p>
                <p>Оплачено до: ${apt.paid_before || 'Не указано'}</p>
                ${apt.tenants ? `
                    <div class="tenants-list">
                        <h4>Жильцы:</h4>
                        ${apt.tenants.map(tenant => `
                            <div class="tenant">
                                <p>${tenant.name} (${tenant.status?.role === 1 ? '👑 Владелец' : '👤 Жилец'})</p>
                                <p>📱 ${formatPhone(tenant.phone)}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки квартир:', error);
        tg.showAlert('Ошибка загрузки списка квартир');
    }
}

// Обновляем функции действий с кнопками
async function getDomophoneSnapshot(domofonId, button) {
    try {
        button.disabled = true;
        const response = await api.domofon.getMediaUrls([domofonId]);
        
        if (response && response[0]?.jpeg) {
            // Создаем модальное окно для просмотра снимка
            const modalHtml = `
                <div class="snapshot-modal fade-in">
                    <div class="snapshot-header">
                        <h3>📷 Снимок с камеры</h3>
                        <button onclick="closeSnapshotModal()">✕</button>
                    </div>
                    <div class="snapshot-content">
                        <img src="${response[0].jpeg}" alt="Снимок с камеры">
                    </div>
                </div>
                <div class="modal-overlay" onclick="closeSnapshotModal()"></div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer);
        } else {
            tg.showAlert('⚠️ Снимок недоступен');
        }
    } catch (error) {
        console.error('Ошибка получения снимка:', error);
        tg.showAlert('❌ Ошибка получения снимка');
    } finally {
        button.disabled = false;
    }
}

function closeSnapshotModal() {
    const modal = document.querySelector('.snapshot-modal');
    const overlay = document.querySelector('.modal-overlay');
    if (modal && overlay) {
        modal.classList.add('fade-out');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            modal.parentElement.remove();
        }, 300);
    }
}

async function openDoor(domofonId, button) {
    try {
        button.disabled = true;
        const response = await fetch(`${API_URL}/domo.domofon/${domofonId}/open`, {
            method: 'POST',
            headers: {
                'x-api-key': API_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ door_id: 0 }),
            params: { tenant_id }
        });
        
        if (response.ok) {
            tg.showAlert('Дверь открыта');
        } else {
            throw new Error('Ошибка открытия двери');
        }
    } catch (error) {
        console.error('Ошибка открытия двери:', error);
        tg.showAlert('Ошибка открытия двери');
    } finally {
        button.disabled = false;
    }
}

// Вспомогательные функции
function formatPhone(phone) {
    if (!phone) return '';
    const cleaned = phone.toString().replace(/\D/g, '');
    return `+${cleaned.slice(0, 1)} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
}

// Добавляем функцию для обработки входящих звонков
function handleIncomingCall(callData) {
    activeCall = callData;
    
    // Создаем и показываем модальное окно со звонком
    const modalHtml = `
        <div class="call-modal fade-in">
            <div class="call-header">
                <h3>🔔 Входящий вызов</h3>
                <p class="call-time">${new Date().toLocaleTimeString()}</p>
            </div>
            ${callData.snapshot_url ? `
                <div class="call-snapshot">
                    <img src="${callData.snapshot_url}" alt="Снимок с камеры">
                </div>
            ` : '<p class="no-snapshot">Снимок недоступен</p>'}
            <div class="call-actions">
                <button onclick="handleCall('accept', ${callData.domofon_id})" class="accept-btn">
                    🔓 Открыть дверь
                </button>
                <button onclick="handleCall('reject')" class="reject-btn">
                    ⛔️ Отклонить
                </button>
            </div>
        </div>
        <div class="modal-overlay"></div>
    `;
    
    // Добавляем модальное окно на страницу
    const modalContainer = document.createElement('div');
    modalContainer.innerHTML = modalHtml;
    document.body.appendChild(modalContainer);
    
    // Воспроизводим звук уведомления
    notificationSound.play();
}

// Функция обработки действий со звонком
async function handleCall(action, domofonId) {
    if (action === 'accept') {
        await openDoor(domofonId);
    }
    
    // Закрываем модальное окно
    const modal = document.querySelector('.call-modal');
    const overlay = document.querySelector('.modal-overlay');
    if (modal && overlay) {
        modal.classList.add('fade-out');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            modal.parentElement.remove();
        }, 300);
    }
    
    activeCall = null;
    notificationSound.pause();
    notificationSound.currentTime = 0;
}

// Добавляем обработчик WebSocket для получения уведомлений
let ws;

function connectWebSocket() {
    ws = new WebSocket(`wss://domo-dev.profintel.ru/tg-bot/ws/${tenant_id}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'call') {
            handleIncomingCall(data);
        }
    };
    
    ws.onclose = () => {
        // Переподключаемся при обрыве соединения
        setTimeout(connectWebSocket, 5000);
    };
}

// Обновляем API клиент для работы со всеми endpoints
const api = {
    // Методы для работы с домофонами
    domofon: {
        // GET /domo.domofon - Получение списка домофонов
        getList: async () => {
            return await apiRequest('GET', '/domo.domofon', { tenant_id });
        },

        // POST /domo.domofon/{intercom_id}/open - Открытие двери
        openDoor: async (intercom_id) => {
            return await apiRequest('POST', `/domo.domofon/${intercom_id}/open`, 
                { tenant_id }, { door_id: 0 });
        },

        // POST /domo.domofon/urlsOnType - Получение ссылок на медиа
        getMediaUrls: async (intercoms_id, media_type = ["JPEG"]) => {
            return await apiRequest('POST', '/domo.domofon/urlsOnType',
                { tenant_id }, { intercoms_id, media_type });
        }
    },

    // Методы для работы с квартирами
    apartment: {
        // GET /domo.apartment - Получение списка квартир
        getList: async () => {
            return await apiRequest('GET', '/domo.apartment', { tenant_id });
        },

        // GET /domo.apartment/{apartment_id} - Получение информации о квартире
        getInfo: async (apartment_id) => {
            return await apiRequest('GET', `/domo.apartment/${apartment_id}`, { tenant_id });
        },

        // GET /domo.apartment/{apartment_id}/domofon - Получение спска домофонов квартиры
        getDomofons: async (apartment_id) => {
            return await apiRequest('GET', `/domo.apartment/${apartment_id}/domofon`, { tenant_id });
        }
    },

    // Методы для работы с жильцами
    tenant: {
        // POST /check-tenant - Проверка жильца
        check: async (phone) => {
            return await apiRequest('POST', '/check-tenant', null, { phone });
        }
    }
};

// Функция для выполнения API запросов
async function apiRequest(method, endpoint, params = null, body = null) {
    try {
        const url = new URL(API_URL + endpoint);
        if (params) {
            Object.keys(params).forEach(key => 
                url.searchParams.append(key, params[key]));
        }

        const options = {
            method,
            headers: {
                'x-api-key': API_TOKEN,
                'Content-Type': 'application/json',
                'accept': 'application/json'
            }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}

// Функция загрузки и отображения квартир с домофонами
async function loadApartmentsWithDomofons() {
    try {
        showLoader('apartmentsLoader');
        const apartments = await api.apartment.getList();
        
        const apartmentsWithDomofons = await Promise.all(
            apartments.map(async (apt) => {
                const domofons = await api.apartment.getDomofons(apt.id);
                return { ...apt, domofons };
            })
        );

        renderApartments(apartmentsWithDomofons);
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        tg.showAlert('Ошибка загрузки данных');
    } finally {
        hideLoader('apartmentsLoader');
    }
}

// Функция рендеринга квартир с домофонами
function renderApartments(apartments) {
    const container = document.getElementById('apartmentsList');
    container.innerHTML = apartments.map(apt => `
        <div class="apartment-card fade-in">
            <h3>Квартира ${apt.location?.apartments_number || ''}</h3>
            <p>Адрес: ${apt.location?.readable_address || 'Не указан'}</p>
            
            ${apt.domofons?.length ? `
                <div class="apartment-domofons">
                    <h4>Домофоны:</h4>
                    ${apt.domofons.map(domofon => `
                        <div class="domofon-item">
                            <span>${domofon.name}</span>
                            <div class="domofon-actions">
                                <button onclick="getDomophoneSnapshot(${domofon.id}, this)">
                                    📷 Камера
                                </button>
                                <button onclick="openDoor(${domofon.id}, this)">
                                    🔓 Открыть
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            ` : '<p>Нет доступных домофонов</p>'}
        </div>
    `).join('');
}

// Обновленная функция открытия двери
async function openDoor(domofonId, button) {
    try {
        button.disabled = true;
        await api.domofon.openDoor(domofonId);
        tg.showAlert('Дверь открыта');
    } catch (error) {
        console.error('Ошибка открытия двери:', error);
        tg.showAlert('Ошибка открытия двери');
    } finally {
        button.disabled = false;
    }
}

// Обновленная функция получения снимка с камеры
async function getDomophoneSnapshot(domofonId, button) {
    try {
        button.disabled = true;
        const response = await api.domofon.getMediaUrls([domofonId]);
        
        if (response && response[0]?.jpeg) {
            // Создаем модальное окно для просмотра снимка
            const modalHtml = `
                <div class="snapshot-modal fade-in">
                    <div class="snapshot-header">
                        <h3>📷 Снимок с камеры</h3>
                        <button onclick="closeSnapshotModal()">✕</button>
                    </div>
                    <div class="snapshot-content">
                        <img src="${response[0].jpeg}" alt="Снимок с камеры">
                    </div>
                </div>
                <div class="modal-overlay" onclick="closeSnapshotModal()"></div>
            `;
            
            const modalContainer = document.createElement('div');
            modalContainer.innerHTML = modalHtml;
            document.body.appendChild(modalContainer);
        } else {
            tg.showAlert('⚠️ Снимок недоступен');
        }
    } catch (error) {
        console.error('Ошибка получения снимка:', error);
        tg.showAlert('❌ Ошибка получения снимка');
    } finally {
        button.disabled = false;
    }
}

function closeSnapshotModal() {
    const modal = document.querySelector('.snapshot-modal');
    const overlay = document.querySelector('.modal-overlay');
    if (modal && overlay) {
        modal.classList.add('fade-out');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            modal.parentElement.remove();
        }, 300);
    }
}

// Добавляем функцию проверки соединения
async function checkConnection() {
    try {
        await fetch(API_URL + '/health');
        return true;
    } catch {
        return false;
    }
}

// Добавляем обработчик офлайн/онлайн состояния
window.addEventListener('online', async () => {
    if (await checkConnection()) {
        tg.showAlert('Соединение восстановлено');
        if (tenant_id) {
            loadDomofons();
        }
    }
});

window.addEventListener('offline', () => {
    tg.showAlert('Отсутствует подключение к интернету');
});