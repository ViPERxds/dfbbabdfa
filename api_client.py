from dataclasses import dataclass
from typing import Optional, Dict, List, Any
import httpx
import logging
from enum import Enum
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

class MediaType(Enum):
    JPEG = "JPEG"
    MP4 = "MP4"
    
@dataclass
class TenantInfo:
    tenant_id: int
    name: str
    telegram_chat_id: str
    is_super_user: bool = False

@dataclass
class DomophoneInfo:
    id: str
    name: str
    tenant_id: int

class ApiClientError(Exception):
    """Базовый класс для ошибок API клиента"""
    pass

class ApiClient:
    def __init__(self, base_url: str, api_token: str):
        self.base_url = base_url.rstrip('/')
        self._headers = {
            'x-api-key': api_token,
            'Content-Type': 'application/json',
            'accept': 'application/json'
        }
        self._client_config = {
            'timeout': httpx.Timeout(10.0),
            'limits': httpx.Limits(max_keepalive_connections=5, max_connections=10),
            'headers': self._headers
        }

    @asynccontextmanager
    async def _make_request(self):
        """Контекстный менеджер для выполнения HTTP-запросов"""
        async with httpx.AsyncClient(**self._client_config) as client:
            yield client

    async def _handle_response(self, response: httpx.Response) -> Dict[str, Any]:
        """Обработка ответа от API"""
        try:
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP ошибка: {e.response.status_code} - {e.response.text}")
            raise ApiClientError(f"HTTP ошибка: {e.response.status_code}")
        except Exception as e:
            logger.error(f"Неожиданная ошибка: {str(e)}")
            raise ApiClientError(f"Неожиданная ошибка: {str(e)}")

    async def check_tenant(self, tenant_id: int) -> Optional[TenantInfo]:
        """Получение информации о пользователе"""
        phone_mapping = {
            22063: 79002288610,
            22064: 79156562250,
            22065: 79205451794
        }
        chat_id_mapping = {
            22063: "1061531514",
            22064: "901275122",
            22065: "5748749118"
        }

        try:
            phone = phone_mapping.get(tenant_id, 79156562250)
            async with self._make_request() as client:
                response = await client.post(
                    f"{self.base_url}/check-tenant",
                    json={"phone": phone}
                )
                data = await self._handle_response(response)
                
                return TenantInfo(
                    tenant_id=data.get('tenant_id'),
                    name=data.get('name', 'Неизвестный'),
                    telegram_chat_id=chat_id_mapping.get(tenant_id, ''),
                    is_super_user=data.get('is_super_user', False)
                )
        except Exception as e:
            logger.error(f"Ошибка при проверке пользователя: {str(e)}", exc_info=True)
            return None

    async def get_camera_snapshot(self, domofon_id: int, tenant_id: int) -> Optional[str]:
        """Получение URL снимка с камеры"""
        try:
            payload = {
                "intercoms_id": [domofon_id],
                "media_type": [MediaType.JPEG.value]
            }
            
            async with self._make_request() as client:
                response = await client.post(
                    f"{self.base_url}/domo.domofon/urlsOnType",
                    json=payload,
                    params={"tenant_id": tenant_id}
                )
                data = await self._handle_response(response)
                return data[0].get('jpeg') if data else None
                
        except Exception as e:
            logger.error(f"Ошибка при получении снимка: {str(e)}", exc_info=True)
            return None

    async def open_door(self, domophone_id: int, tenant_id: int) -> bool:
        """Открытие двери домофона"""
        try:
            async with self._make_request() as client:
                response = await client.post(
                    f"{self.base_url}/domo.domofon/{domophone_id}/open",
                    json={"door_id": 0},
                    params={"tenant_id": tenant_id}
                )
                await self._handle_response(response)
                return True
        except Exception as e:
            logger.error(f"Ошибка при открытии двери: {str(e)}", exc_info=True)
            return False 