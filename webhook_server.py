from quart import Quart, request, jsonify
from telegram import Bot, InlineKeyboardMarkup, InlineKeyboardButton
from telegram.error import TelegramError
from dataclasses import dataclass
from typing import Optional, Tuple, Dict, Any
import os
from dotenv import load_dotenv
from api_client import ApiClient, ApiClientError
import logging
import asyncio
from datetime import datetime

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@dataclass
class WebhookConfig:
    telegram_token: str
    api_url: str
    api_token: str

    @classmethod
    def from_env(cls):
        load_dotenv()
        return cls(
            telegram_token=os.getenv('TELEGRAM_TOKEN', ''),
            api_url=os.getenv('API_URL', ''),
            api_token=os.getenv('API_TOKEN', '')
        )

class DomophoneWebhookServer:
    def __init__(self):
        self.config = WebhookConfig.from_env()
        self.app = Quart(__name__)
        self.app.config['PROVIDE_AUTOMATIC_OPTIONS'] = True
        self.bot = Bot(token=self.config.telegram_token)
        self.api_client = ApiClient(self.config.api_url, self.config.api_token)
        self._setup_routes()

    def _setup_routes(self):
        @self.app.route('/webhook/call', methods=['POST'])
        async def handle_call():
            try:
                data = await request.get_json()
                logger.info(f"📥 Получены данные: {data}")

                domofon_id = int(data.get('domofon_id'))
                tenant_id = int(data.get('tenant_id'))

                if not domofon_id or not tenant_id:
                    return jsonify({
                        'error': 'Отсутствуют обязательные параметры',
                        'status': 'error'
                    }), 400

                user_info = await self.api_client.check_tenant(tenant_id)
                if not user_info or not user_info.telegram_chat_id:
                    return jsonify({
                        'error': 'Пользователь не найден',
                        'status': 'error'
                    }), 404

                snapshot_url = await self.api_client.get_camera_snapshot(domofon_id, tenant_id)
                await self._send_notification(user_info.telegram_chat_id, snapshot_url, domofon_id)
                
                return jsonify({
                    'success': True,
                    'status': 'success',
                    'message': 'Уведомление успешно отправлено'
                })
                
            except Exception as e:
                logger.error(f"❌ Ошибка при обработке вызова: {str(e)}")
                return jsonify({
                    'error': str(e),
                    'status': 'error'
                }), 500

    async def _send_notification(self, chat_id: str, snapshot_url: Optional[str], domofon_id: int):
        """Отправка уведомления в Telegram"""
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🔓 Открыть дверь", callback_data=f"open_{domofon_id}"),
            ],
            [
                InlineKeyboardButton("⛔️ Не открывать", callback_data=f"ignore_{domofon_id}")
            ]
        ])
        
        notification_text = (
            "🔔 *Входящий вызов в домофон!*\n\n"
            "👋 Кто-то хочет войти\n"
            "⏰ Время: {}\n\n"
            "Пожалуйста, выберите действие:"
        ).format(
            datetime.now().strftime("%H:%M:%S")
        )
        
        try:
            if snapshot_url:
                await self.bot.send_photo(
                    chat_id=chat_id,
                    photo=snapshot_url,
                    caption=notification_text,
                    parse_mode='Markdown',
                    reply_markup=keyboard
                )
            else:
                await self.bot.send_message(
                    chat_id=chat_id,
                    text=notification_text + "\n\n⚠️ _Снимок с камеры недоступен_",
                    parse_mode='Markdown',
                    reply_markup=keyboard
                )
        except Exception as e:
            logger.error(f"Ошибка отправки уведомления: {str(e)}")
            raise

    def run(self, host='0.0.0.0', port=5000):
        """Запуск сервера"""
        logger.info(f"Запуск webhook сервера на http://{host}:{port}")
        self.app.run(host=host, port=port)

if __name__ == '__main__':
    server = DomophoneWebhookServer()
    server.run() 