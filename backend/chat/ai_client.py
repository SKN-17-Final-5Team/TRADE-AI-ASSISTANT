"""
AI Server Client

ai-server (FastAPI)와 통신하는 클라이언트
Django에서 Agent 호출을 HTTP API로 대체
"""

import os
import json
import logging
import httpx
from typing import Dict, Any, List, Optional, AsyncIterator

logger = logging.getLogger(__name__)

# AI Server URL (환경변수 또는 기본값)
AI_SERVER_URL = os.getenv("AI_SERVER_URL", "http://localhost:8001")


class AIServerClient:
    """AI Server HTTP 클라이언트"""

    def __init__(self, base_url: str = None, timeout: float = 120.0):
        self.base_url = base_url or AI_SERVER_URL
        self.timeout = timeout

    # ==================== Health Check ====================

    async def health_check(self) -> Dict[str, Any]:
        """AI Server 상태 확인"""
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{self.base_url}/health")
            response.raise_for_status()
            return response.json()

    # ==================== Trade Chat ====================

    async def trade_chat(
        self,
        message: str,
        user_id: int,
        context: str = "",
        history: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        무역 채팅 API (비스트리밍)

        Returns:
            {
                "message": str,
                "tools_used": List[ToolInfo]
            }
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/trade/chat",
                json={
                    "message": message,
                    "user_id": user_id,
                    "context": context,
                    "history": history or []
                }
            )
            response.raise_for_status()
            return response.json()

    async def trade_chat_stream(
        self,
        message: str,
        user_id: int,
        context: str = "",
        history: List[Dict] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        무역 채팅 스트리밍 API

        Yields:
            SSE 이벤트 데이터
            - {"type": "init"}
            - {"type": "text", "content": str}
            - {"type": "tool", "tool": ToolInfo}
            - {"type": "done", "tools_used": List[ToolInfo]}
            - {"type": "error", "error": str}
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/trade/chat/stream",
                json={
                    "message": message,
                    "user_id": user_id,
                    "context": context,
                    "history": history or []
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            yield data
                        except json.JSONDecodeError:
                            continue

    # ==================== Document Write ====================

    async def document_write_chat(
        self,
        doc_id: int,
        message: str,
        document_content: str = "",
        history: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        문서 작성 채팅 API (비스트리밍)

        Returns:
            {
                "doc_id": int,
                "message": str,
                "tools_used": List[ToolInfo],
                "is_edit": bool,
                "changes": List[EditChange] | None
            }
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/document/write/chat",
                json={
                    "doc_id": doc_id,
                    "message": message,
                    "document_content": document_content,
                    "history": history or []
                }
            )
            response.raise_for_status()
            return response.json()

    async def document_write_chat_stream(
        self,
        doc_id: int,
        message: str,
        document_content: str = "",
        history: List[Dict] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        문서 작성 스트리밍 API

        Yields:
            SSE 이벤트 데이터
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/document/write/chat/stream",
                json={
                    "doc_id": doc_id,
                    "message": message,
                    "document_content": document_content,
                    "history": history or []
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            yield data
                        except json.JSONDecodeError:
                            continue

    # ==================== Document Read ====================

    async def document_read_chat(
        self,
        doc_id: int,
        message: str,
        document_name: str = "",
        document_type: str = "",
        history: List[Dict] = None
    ) -> Dict[str, Any]:
        """
        문서 읽기 채팅 API (비스트리밍)

        Returns:
            {
                "doc_id": int,
                "message": str,
                "tools_used": List[ToolInfo]
            }
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/document/read/chat",
                json={
                    "doc_id": doc_id,
                    "message": message,
                    "document_name": document_name,
                    "document_type": document_type,
                    "history": history or []
                }
            )
            response.raise_for_status()
            return response.json()

    async def document_read_chat_stream(
        self,
        doc_id: int,
        message: str,
        document_name: str = "",
        document_type: str = "",
        history: List[Dict] = None
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        문서 읽기 스트리밍 API

        Yields:
            SSE 이벤트 데이터
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/api/document/read/chat/stream",
                json={
                    "doc_id": doc_id,
                    "message": message,
                    "document_name": document_name,
                    "document_type": document_type,
                    "history": history or []
                }
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        try:
                            data = json.loads(line[6:])
                            yield data
                        except json.JSONDecodeError:
                            continue

    # ==================== Memory ====================

    async def memory_search(
        self,
        query: str,
        user_id: int = None,
        doc_id: int = None,
        limit: int = 5
    ) -> Dict[str, Any]:
        """메모리 검색"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/memory/search",
                json={
                    "query": query,
                    "user_id": user_id,
                    "doc_id": doc_id,
                    "limit": limit
                }
            )
            response.raise_for_status()
            return response.json()

    async def memory_save(
        self,
        messages: List[Dict],
        user_id: int,
        doc_id: int = None,
        buyer_name: str = None,
        save_user: bool = True,
        save_doc: bool = True,
        save_buyer: bool = False
    ) -> Dict[str, Any]:
        """메모리 저장"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/memory/save",
                json={
                    "messages": messages,
                    "user_id": user_id,
                    "doc_id": doc_id,
                    "buyer_name": buyer_name,
                    "save_user": save_user,
                    "save_doc": save_doc,
                    "save_buyer": save_buyer
                }
            )
            response.raise_for_status()
            return response.json()

    async def memory_build_context(
        self,
        doc_id: int,
        user_id: int,
        query: str
    ) -> Dict[str, Any]:
        """문서 컨텍스트 빌드"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/memory/context",
                json={
                    "doc_id": doc_id,
                    "user_id": user_id,
                    "query": query
                }
            )
            response.raise_for_status()
            return response.json()

    async def memory_delete(
        self,
        trade_id: int,
        doc_ids: List[int]
    ) -> Dict[str, Any]:
        """거래 메모리 삭제"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/api/memory/delete",
                json={
                    "trade_id": trade_id,
                    "doc_ids": doc_ids
                }
            )
            response.raise_for_status()
            return response.json()

    # ==================== Ingest ====================

    async def ingest_document(
        self,
        doc_id: int,
        s3_key: str,
        collection_name: str = "user_documents"
    ) -> Dict[str, Any]:
        """문서 색인"""
        async with httpx.AsyncClient(timeout=300.0) as client:
            response = await client.post(
                f"{self.base_url}/api/ingest/document",
                json={
                    "doc_id": doc_id,
                    "s3_key": s3_key,
                    "collection_name": collection_name
                }
            )
            response.raise_for_status()
            return response.json()

    async def delete_document_index(
        self,
        doc_id: int,
        collection_name: str = "user_documents"
    ) -> Dict[str, Any]:
        """문서 색인 삭제"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                "DELETE",
                f"{self.base_url}/api/ingest/document",
                json={
                    "doc_id": doc_id,
                    "collection_name": collection_name
                }
            )
            response.raise_for_status()
            return response.json()


# ==================== 싱글톤 인스턴스 ====================

_client: Optional[AIServerClient] = None


def get_ai_client() -> AIServerClient:
    """AI Server 클라이언트 싱글톤 반환"""
    global _client
    if _client is None:
        _client = AIServerClient()
    return _client


# ==================== 동기 래퍼 (Django View용) ====================

import asyncio


def sync_trade_chat(message: str, user_id: int, context: str = "", history: List[Dict] = None) -> Dict[str, Any]:
    """동기 무역 채팅 호출"""
    client = get_ai_client()
    return asyncio.run(client.trade_chat(message, user_id, context, history))


def sync_document_write_chat(doc_id: int, message: str, document_content: str = "", history: List[Dict] = None) -> Dict[str, Any]:
    """동기 문서 작성 채팅 호출"""
    client = get_ai_client()
    return asyncio.run(client.document_write_chat(doc_id, message, document_content, history))


def sync_document_read_chat(doc_id: int, message: str, document_name: str = "", document_type: str = "", history: List[Dict] = None) -> Dict[str, Any]:
    """동기 문서 읽기 채팅 호출"""
    client = get_ai_client()
    return asyncio.run(client.document_read_chat(doc_id, message, document_name, document_type, history))
