// Основная логика приложения
class TelegramWebApp {
    constructor() {
        this.tg = window.Telegram.WebApp;
        this.API_URL = 'https://domo-dev.profintel.ru/tg-bot';
        this.API_TOKEN = 'SecretToken';
        this.currentScreen = 'main';
        
        // Инициализируем после создания объекта
        setTimeout(() => this.initApp(), 100);
    }

    async initApp() {
        try {
            console.log('Starting initialization...');
            
            // Проверяем, что Telegram.WebApp доступен
            if (!this.tg) {
                throw new Error('Telegram WebApp is not available');
            }

            this.tg.ready();
            this.setThemeClass();
            
            // Сразу показываем экран авторизации
            this.showPhoneAuthScreen();
            this.setupBackButton();

        } catch (error) {
            console.error('Initialization error:', error);
            this.showError('Ошибка инициализации приложения');
        }
    }

    showError(message) {
        // Скрываем экран загрузки
        document.getElementById('loadingScreen').classList.add('hidden');
        
        // Показываем ошибку
        const errorScreen = document.createElement('div');
        errorScreen.className = 'screen error-screen';
        errorScreen.innerHTML = `
            <div class="error-message">
                <p>⚠️ ${message}</p>
                <button onclick="location.reload()">Попробовать снова</button>
            </div>
        `;
        document.getElementById('app').appendChild(errorScreen);
    }

    showPhoneAuthScreen() {
        console.log('Showing phone auth screen');
        this.hideAllScreens();
        const authScreen = document.getElementById('authScreen');
        authScreen.classList.remove('hidden');
        
        // Очищаем существующие кнопки
        const existingButton = authScreen.querySelector('.auth-button');
        if (existingButton) {
            existingButton.remove();
        }
        
        // Добавляем кнопку для получения номера телефона
        const authButton = document.createElement('button');
        authButton.className = 'button auth-button';
        authButton.innerHTML = '📱 Отправить номер телефона';
        authButton.onclick = async () => {
            try {
                // Хардкодим номер для тестирования
                const testPhone = '79002288610';
                await this.checkAuth(testPhone);
            } catch (error) {
                console.error('Auth error:', error);
                this.showError('Ошибка авторизации');
            }
        };
        
        authScreen.appendChild(authButton);
    }

    setupBackButton() {
        this.tg.BackButton.onClick(() => {
            if (this.currentScreen === 'domofon-control') {
                this.showDomofonsScreen();
            } else if (this.currentScreen === 'domofons') {
                this.showMainScreen();
            }
        });
    }

    async checkAuth(phone) {
        try {
            console.log('Checking auth for phone:', phone);
            const response = await fetch(`${this.API_URL}/check-tenant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.API_TOKEN
                },
                body: JSON.stringify({ phone: parseInt(phone) })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.tenant_id = data.tenant_id;
                this.showMainScreen();
            } else {
                throw new Error('Auth failed');
            }
        } catch (error) {
            console.error('Auth error:', error);
            this.showError('Ошибка авторизации');
        }
    }

    async showMainScreen() {
        this.currentScreen = 'main';
        this.tg.BackButton.hide();
        this.hideAllScreens();
        document.getElementById('mainScreen').classList.remove('hidden');
        
        // Создаем кнопки главного меню
        const mainMenu = document.createElement('div');
        mainMenu.className = 'main-menu';
        mainMenu.innerHTML = `
            <button class="menu-button" onclick="app.showApartmentsScreen()">
                🏠 Посмотреть квартиры
            </button>
            <button class="menu-button" onclick="app.showDomofonsScreen()">
                🚪 Посмотреть домофоны
            </button>
        `;
        document.getElementById('mainScreen').appendChild(mainMenu);
    }

    async showDomofonsScreen() {
        this.currentScreen = 'domofons';
        this.tg.BackButton.show();
        this.hideAllScreens();
        const domofonsScreen = document.getElementById('domofonsScreen');
        domofonsScreen.classList.remove('hidden');

        const domofons = await this.getDomofons();
        const domofonsList = document.createElement('div');
        domofonsList.className = 'domofons-list';

        domofons.forEach(domofon => {
            const domofonCard = document.createElement('div');
            domofonCard.className = 'domofon-card';
            domofonCard.innerHTML = `
                <div class="domofon-info">
                    <span class="domofon-name">📷 Камера ${domofon.name}</span>
                </div>
                <div class="domofon-controls">
                    <button class="button" onclick="app.getSnapshot(${domofon.id})">
                        📷 Снимок
                    </button>
                    ${!domofon.name.toLowerCase().includes('консьерж') ? `
                        <button class="button success" onclick="app.openDoor(${domofon.id})">
                            🔓 Открыть
                        </button>
                    ` : ''}
                </div>
            `;
            domofonsList.appendChild(domofonCard);
        });

        domofonsScreen.innerHTML = '';
        domofonsScreen.appendChild(domofonsList);
    }

    async showApartmentsScreen() {
        this.currentScreen = 'apartments';
        this.tg.BackButton.show();
        this.hideAllScreens();
        const apartmentsScreen = document.getElementById('apartmentsScreen');
        apartmentsScreen.classList.remove('hidden');

        const apartments = await this.getApartments();
        const apartmentsList = document.createElement('div');
        apartmentsList.className = 'apartments-list';

        apartments.forEach(apartment => {
            const apartmentCard = document.createElement('div');
            apartmentCard.className = 'apartment-card';
            const location = apartment.location || {};
            
            apartmentCard.innerHTML = `
                <h3>Квартира #${apartment.id}</h3>
                <p>📍 Адрес: ${location.readable_address || 'Не указан'}</p>
                <p>🚪 Номер квартиры: ${location.apartments_number || 'Не указан'}</p>
                ${apartment.tenants ? `
                    <div class="tenants-list">
                        <h4>👥 Жильцы:</h4>
                        ${apartment.tenants.map(tenant => `
                            <div class="tenant">
                                <p>${tenant.name} (${tenant.status?.role === 1 ? '👑 Владелец' : '👤 Жилец'})</p>
                                <p>📱 ${this.formatPhone(tenant.phone)}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
            apartmentsList.appendChild(apartmentCard);
        });

        apartmentsScreen.innerHTML = '';
        apartmentsScreen.appendChild(apartmentsList);
    }

    formatPhone(phone) {
        if (!phone || phone.length !== 11) return phone;
        return `+${phone[0]} (${phone.slice(1,4)}) ${phone.slice(4,7)}-${phone.slice(7,9)}-${phone.slice(9)}`;
    }

    hideAllScreens() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    async getDomofons() {
        try {
            const response = await fetch(`${this.API_URL}/domo.apartment?tenant_id=${this.tenant_id}`, {
                headers: {
                    'x-api-key': this.API_TOKEN
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Ошибка получения списка домофонов:', error);
            return [];
        }
    }

    async openDoor(domofonId) {
        try {
            const response = await fetch(`${this.API_URL}/domo.domofon/${domofonId}/open`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.API_TOKEN
                },
                body: JSON.stringify({
                    door_id: 0,
                    tenant_id: this.tenant_id
                })
            });
            return response.ok;
        } catch (error) {
            console.error('Ошибка открытия двери:', error);
            return false;
        }
    }

    async getSnapshot(domofonId) {
        try {
            const response = await fetch(`${this.API_URL}/domo.domofon/urlsOnType`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.API_TOKEN
                },
                body: JSON.stringify({
                    intercoms_id: [domofonId],
                    media_type: ["JPEG"],
                    tenant_id: this.tenant_id
                })
            });
            const data = await response.json();
            return data[0]?.jpeg;
        } catch (error) {
            console.error('Ошибка получения снимка:', error);
            return null;
        }
    }

    setThemeClass() {
        // Применяем тему Telegram
        document.documentElement.className = this.tg.colorScheme;
    }

    // Метод для отправки данных в бот
    sendDataToBot(data) {
        this.tg.sendData(JSON.stringify(data));
    }
}