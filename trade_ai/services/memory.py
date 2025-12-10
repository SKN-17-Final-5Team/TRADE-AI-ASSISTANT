"""
Mem0 Memory Service for Trade Assistant

메모리 구조:
1. 단기 메모리 (Short-term) - 세션 요약:
   - 문서별 작업 요약 (doc_{doc_id}) - Trade 삭제 시 함께 삭제
   - 일반채팅 대화 요약 (gen_chat_{gen_chat_id}) - 채팅방 삭제 시 함께 삭제

2. 장기 메모리 (Long-term) - 영구 보관:
   - 사용자 선호도 (user_{user_id}) - 무역 조건, 결제 방식 등
   - 거래처별 메모 (buyer_{user_id}_{buyer_name}) - 거래처 특성, 주의사항 등

3. 영구 기록:
   - RDS (MySQL): 전체 대화 히스토리 (DocMessage, GenMessage 테이블)
"""

import os
import re
import logging
import concurrent.futures
from typing import List, Dict, Any, Optional

from mem0 import Memory

logger = logging.getLogger(__name__)


# ==================== 커스텀 프롬프트 ====================

PROMPTS = {
    "doc": """현재 문서 작업 세션의 핵심 내용만 요약하세요.
저장: 작업 목표, 수정 요청사항, 완료된 작업, 현재 진행 상황
제외: 인사말, 단순 확인, 구체적 금액/수량/날짜(RDS에 저장됨)""",

    "gen_chat": """현재 대화 세션의 핵심 내용만 요약하세요.
저장: 대화 주제, 질문/답변 요약, 논의된 무역 관련 정보
제외: 인사말, 단순 확인, 반복 내용""",

    "user": """사용자의 일반적인 선호도와 스타일만 추출하세요.
저장: 무역 조건 선호(FOB/CIF 등), 결제 방식(T/T/L/C), 자주 거래하는 품목/지역
제외: 특정 거래 정보(금액/수량/날짜), 일회성 요청, 거래처 정보""",

    "buyer": """거래처(buyer)에 대한 중요 정보만 추출하세요.
저장: 거래처 특성, 선호 조건, 주의사항, 커뮤니케이션 특성
제외: 단순 거래 내역(금액/수량/날짜), 일회성 거래 정보"""
}


class TradeMemoryService:
    """Mem0 메모리 관리 서비스 (싱글톤)"""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._init_memory()

    def _init_memory(self):
        """Mem0 초기화"""
        try:
            # Qdrant 설정
            qdrant_url = os.getenv("QDRANT_URL")
            qdrant_key = os.getenv("QDRANT_API_KEY")

            if qdrant_url and qdrant_key:
                qdrant_config = {
                    "url": qdrant_url,
                    "api_key": qdrant_key,
                    "collection_name": "trade_memory"
                }
            else:
                qdrant_config = {
                    "host": os.getenv("QDRANT_HOST", "localhost"),
                    "port": int(os.getenv("QDRANT_PORT", 6333)),
                    "collection_name": "trade_memory"
                }

            config = {
                "vector_store": {"provider": "qdrant", "config": qdrant_config},
                "llm": {
                    "provider": "openai",
                    "config": {"model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 2000}
                },
                "embedder": {
                    "provider": "openai",
                    "config": {"model": "text-embedding-3-small"}
                }
            }

            self.memory = Memory.from_config(config)
            self._initialized = True
            logger.info("TradeMemoryService initialized")

        except Exception as e:
            logger.error(f"TradeMemoryService init failed: {e}")
            raise

    # ==================== 내부 헬퍼 ====================

    def _add(self, user_id: str, messages: List[Dict], metadata: Dict, prompt: str = None) -> Dict:
        """메모리 추가"""
        try:
            kwargs = {"messages": messages, "user_id": user_id, "metadata": metadata}
            if prompt:
                kwargs["prompt"] = prompt
            return self.memory.add(**kwargs)
        except Exception as e:
            logger.error(f"Memory add failed for {user_id}: {e}")
            return {}

    def _get(self, user_id: str, query: str = None, limit: int = 10) -> List[Dict]:
        """메모리 조회"""
        try:
            if query:
                result = self.memory.search(query=query, user_id=user_id, limit=limit)
            else:
                result = self.memory.get_all(user_id=user_id, limit=limit)

            if isinstance(result, dict):
                return result.get('results', [])
            return result if isinstance(result, list) else []
        except Exception as e:
            logger.error(f"Memory get failed for {user_id}: {e}")
            return []

    def _delete(self, user_id: str) -> bool:
        """메모리 삭제 (Qdrant 직접 삭제 - user_id 필터링)"""
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.models import Filter, FieldCondition, MatchValue

            qdrant_url = os.getenv("QDRANT_URL")
            qdrant_key = os.getenv("QDRANT_API_KEY")

            if qdrant_url and qdrant_key:
                client = QdrantClient(url=qdrant_url, api_key=qdrant_key)
            else:
                client = QdrantClient(
                    host=os.getenv("QDRANT_HOST", "localhost"),
                    port=int(os.getenv("QDRANT_PORT", 6333))
                )

            # user_id 필터로 해당 메모리만 삭제
            client.delete(
                collection_name="trade_memory",
                points_selector=Filter(
                    must=[FieldCondition(key="user_id", match=MatchValue(value=user_id))]
                )
            )
            logger.info(f"Deleted memories for user_id={user_id}")
            return True
        except Exception as e:
            logger.error(f"Memory delete failed for {user_id}: {e}")
            return False

    @staticmethod
    def _normalize_buyer(name: str) -> str:
        """거래처명 정규화"""
        if not name:
            return ""
        normalized = name.lower().strip()
        normalized = re.sub(r'\s+', '_', normalized)
        normalized = re.sub(r'[^a-z0-9_가-힣]', '', normalized)
        return normalized

    # ==================== 문서 메모리 (단기) ====================

    def add_doc_memory(self, doc_id: int, user_id: int, messages: List[Dict]) -> Dict:
        """문서 세션 메모리 저장"""
        return self._add(
            f"doc_{doc_id}",
            messages,
            {"memory_type": "doc_session", "doc_id": doc_id, "user_id": user_id},
            PROMPTS["doc"]
        )

    def get_doc_memory(self, doc_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """문서 세션 메모리 조회"""
        return self._get(f"doc_{doc_id}", query, limit)

    def delete_doc_memory(self, doc_id: int) -> bool:
        """문서 메모리 삭제"""
        return self._delete(f"doc_{doc_id}")

    def delete_trade_memory(self, trade_id: int, doc_ids: List[int]) -> int:
        """Trade 삭제 시 관련 문서 메모리 일괄 삭제"""
        success_count = sum(1 for doc_id in doc_ids if self.delete_doc_memory(doc_id))
        logger.info(f"Deleted trade memory: trade_id={trade_id}, {success_count}/{len(doc_ids)} docs")
        return success_count

    # ==================== 사용자 메모리 (장기) ====================

    def add_user_memory(self, user_id: int, messages: List[Dict]) -> Dict:
        """사용자 선호도 저장"""
        return self._add(
            f"user_{user_id}",
            messages,
            {"memory_type": "user_preference", "user_id": user_id},
            PROMPTS["user"]
        )

    def get_user_memory(self, user_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """사용자 선호도 조회"""
        return self._get(f"user_{user_id}", query, limit)

    # ==================== 거래처 메모리 (장기) ====================

    def add_buyer_memory(self, user_id: int, buyer_name: str, messages: List[Dict]) -> Dict:
        """거래처 메모 저장"""
        normalized = self._normalize_buyer(buyer_name)
        if not normalized:
            return {}
        return self._add(
            f"buyer_{user_id}_{normalized}",
            messages,
            {"memory_type": "buyer_memo", "user_id": user_id, "buyer_name": buyer_name},
            PROMPTS["buyer"]
        )

    def get_buyer_memory(self, user_id: int, buyer_name: str, query: str = None, limit: int = 5) -> List[Dict]:
        """거래처 메모 조회"""
        normalized = self._normalize_buyer(buyer_name)
        if not normalized:
            return []
        return self._get(f"buyer_{user_id}_{normalized}", query, limit)

    # ==================== 일반채팅 메모리 (단기) ====================

    def add_gen_chat_memory(self, gen_chat_id: int, user_id: int, messages: List[Dict]) -> Dict:
        """일반채팅 세션 메모리 저장"""
        return self._add(
            f"gen_chat_{gen_chat_id}",
            messages,
            {"memory_type": "gen_chat_session", "gen_chat_id": gen_chat_id, "user_id": user_id},
            PROMPTS["gen_chat"]
        )

    def get_gen_chat_memory(self, gen_chat_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """일반채팅 세션 메모리 조회"""
        return self._get(f"gen_chat_{gen_chat_id}", query, limit)

    def delete_gen_chat_memory(self, gen_chat_id: int) -> bool:
        """일반채팅 메모리 삭제"""
        return self._delete(f"gen_chat_{gen_chat_id}")

    # ==================== API 호환 메서드 ====================

    def search_user_memory(self, user_id: int, query: str, limit: int = 5) -> List[Dict]:
        """API용 사용자 메모리 검색"""
        return self.get_user_memory(user_id, query, limit)

    def search_doc_memory(self, doc_id: int, query: str, limit: int = 5) -> List[Dict]:
        """API용 문서 메모리 검색"""
        return self.get_doc_memory(doc_id, query, limit)

    # ==================== 스마트 메모리 저장 ====================

    def save_memory_smart(
        self,
        messages: List[Dict],
        user_id: int,
        doc_id: int = None,
        gen_chat_id: int = None,
        buyer_name: str = None,
        save_doc: bool = True,
        save_user: bool = True,
        save_buyer: bool = False
    ) -> Dict[str, Any]:
        """
        스마트 메모리 저장 - 조건에 따라 자동 분배

        Args:
            messages: 대화 메시지 [{"role": "user", "content": "..."}, ...]
            user_id: 사용자 ID
            doc_id: 문서 ID (문서 채팅 시)
            gen_chat_id: 일반채팅 ID (일반 채팅 시)
            buyer_name: 거래처명
            save_doc: 단기 메모리 저장 여부
            save_user: 사용자 장기 메모리 저장 여부
            save_buyer: 거래처 메모리 저장 여부
        """
        results = {"doc": 0, "gen_chat": 0, "user": 0, "buyer": 0, "total": 0}

        try:
            # 단기 메모리
            if save_doc:
                if doc_id:
                    result = self.add_doc_memory(doc_id, user_id, messages)
                    if result:
                        results["doc"] = 1
                if gen_chat_id:
                    result = self.add_gen_chat_memory(gen_chat_id, user_id, messages)
                    if result:
                        results["gen_chat"] = 1

            # 장기 메모리
            if save_user:
                result = self.add_user_memory(user_id, messages)
                if result:
                    results["user"] = 1

            if save_buyer and buyer_name:
                result = self.add_buyer_memory(user_id, buyer_name, messages)
                if result:
                    results["buyer"] = 1

            results["total"] = results["doc"] + results["gen_chat"] + results["user"] + results["buyer"]
            logger.info(f"Memory saved: user={user_id}, doc={doc_id}, gen_chat={gen_chat_id}, buyer={buyer_name}")

        except Exception as e:
            logger.error(f"Smart memory save failed: {e}")

        return results

    # ==================== 컨텍스트 빌더 ====================

    def build_doc_context(
        self,
        doc_id: int,
        user_id: int,
        query: str,
        buyer_name: str = None
    ) -> Dict[str, Any]:
        """문서 채팅용 컨텍스트 (병렬 조회)"""
        context = {"doc_memories": [], "user_memories": [], "buyer_memories": [], "context_summary": ""}

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = {
                    "doc": executor.submit(self.get_doc_memory, doc_id, query, 3),
                    "user": executor.submit(self.get_user_memory, user_id, query, 3),
                }
                if buyer_name:
                    futures["buyer"] = executor.submit(self.get_buyer_memory, user_id, buyer_name, query, 3)

                context["doc_memories"] = futures["doc"].result()
                context["user_memories"] = futures["user"].result()
                if "buyer" in futures:
                    context["buyer_memories"] = futures["buyer"].result()

            # 요약
            parts = []
            if context["doc_memories"]:
                parts.append(f"문서 이력 {len(context['doc_memories'])}건")
            if context["user_memories"]:
                parts.append(f"사용자 선호 {len(context['user_memories'])}건")
            if context["buyer_memories"]:
                parts.append(f"거래처 메모 {len(context['buyer_memories'])}건")
            context["context_summary"] = ", ".join(parts)

        except Exception as e:
            logger.error(f"Build doc context failed: {e}")

        return context

    def build_gen_chat_context(
        self,
        gen_chat_id: int,
        user_id: int,
        query: str,
        is_first_message: bool = False
    ) -> Dict[str, Any]:
        """일반채팅용 컨텍스트"""
        context = {"chat_memories": [], "user_memories": [], "context_summary": ""}

        try:
            if is_first_message:
                context["user_memories"] = self.get_user_memory(user_id, query, 3)
            else:
                with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                    chat_f = executor.submit(self.get_gen_chat_memory, gen_chat_id, query, 3)
                    user_f = executor.submit(self.get_user_memory, user_id, query, 3)
                    context["chat_memories"] = chat_f.result()
                    context["user_memories"] = user_f.result()

            parts = []
            if context["chat_memories"]:
                parts.append(f"대화 이력 {len(context['chat_memories'])}건")
            if context["user_memories"]:
                parts.append(f"사용자 선호 {len(context['user_memories'])}건")
            context["context_summary"] = ", ".join(parts)

        except Exception as e:
            logger.error(f"Build gen_chat context failed: {e}")

        return context


# ==================== 싱글톤 인스턴스 반환 ====================

def get_memory_service() -> Optional[TradeMemoryService]:
    """메모리 서비스 인스턴스 반환"""
    try:
        return TradeMemoryService()
    except Exception as e:
        logger.warning(f"TradeMemoryService disabled: {e}")
        return None
