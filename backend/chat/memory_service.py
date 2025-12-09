"""
Mem0 Memory Service for Trade Assistant

메모리 구조:
1. 단기 메모리 (Short-term):
   - 문서별 대화 컨텍스트 (doc_{doc_id})
   - 일반채팅 컨텍스트 (gen_chat_{gen_chat_id}) - 채팅방 삭제 시 함께 삭제

2. 장기 메모리 (Long-term):
   - 사용자 선호도 (user_{user_id}) - 무역 조건, 결제 방식 등
   - 거래처별 메모 (buyer_{user_id}_{buyer_name}) - 거래처 특성, 주의사항 등

3. 영구 기록:
   - RDS (MySQL): 전체 대화 히스토리 (DocMessage, GenMessage 테이블)
"""

import os
import re
import logging
from typing import List, Dict, Any, Optional
from mem0 import Memory

logger = logging.getLogger(__name__)


# ==================== 커스텀 프롬프트 ====================

PROMPTS = {
    # 문서 단기 메모리 - 작업 컨텍스트만
    "doc": """
현재 문서 작업의 맥락만 추출하세요.
저장: 작업 내용 요약, 수정 요청사항, 필드 변경 이력
제외: 금액/수량/날짜(RDS), 거래처 정보(buyer), 사용자 선호도(user)
""",

    # 사용자 장기 메모리 - 선호도만
    "user": """
사용자의 일반적인 선호도와 스타일만 추출하세요.
저장: 무역 조건 선호(FOB/CIF), 결제 방식 선호(T/T/L/C), 커뮤니케이션 스타일, 작업 패턴
제외: 특정 거래 정보(금액/수량/날짜/거래처명), 이번 거래 관련 내용
""",

    # 거래처 장기 메모리 - 거래처 특성만
    "buyer": """
거래처(buyer)에 대한 중요 정보만 추출하세요.
저장: 거래처 특성, 선호 조건, 주의사항, 과거 거래 패턴
제외: 단순 거래 내역(금액/수량/날짜)
"""
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
            # API 키 설정
            mem0_key = os.getenv("MEM0_API_KEY")
            if mem0_key and not os.getenv("OPENAI_API_KEY"):
                os.environ["OPENAI_API_KEY"] = mem0_key

            # Qdrant 설정
            qdrant_url = os.getenv("QDRANT_URL")
            qdrant_key = os.getenv("QDRANT_API_KEY")

            if qdrant_url and qdrant_key:
                qdrant_config = {"url": qdrant_url, "api_key": qdrant_key, "collection_name": "trade_memory"}
            else:
                qdrant_config = {"host": os.getenv("QDRANT_HOST", "localhost"),
                                "port": int(os.getenv("QDRANT_PORT", 6333)),
                                "collection_name": "trade_memory"}

            # Mem0 설정
            config = {
                "vector_store": {"provider": "qdrant", "config": qdrant_config},
                "llm": {"provider": "openai", "config": {"model": "gpt-4o-mini", "temperature": 0.1, "max_tokens": 2000}},
                "embedder": {"provider": "openai", "config": {"model": "text-embedding-3-small"}}
            }

            self.memory = Memory.from_config(config)
            self._initialized = True
            logger.info("TradeMemoryService initialized")

        except Exception as e:
            logger.error(f"TradeMemoryService init failed: {e}")
            raise

    # ==================== 공통 헬퍼 ====================

    def _add(self, user_id: str, messages: List[Dict], metadata: Dict, prompt: str = None) -> Dict:
        """메모리 추가 (공통)"""
        kwargs = {"messages": messages, "user_id": user_id, "metadata": metadata}
        if prompt:
            kwargs["prompt"] = prompt
        return self.memory.add(**kwargs)

    def _get(self, user_id: str, query: str = None, limit: int = 10) -> List[Dict]:
        """메모리 조회 (공통)"""
        if query:
            result = self.memory.search(query=query, user_id=user_id, limit=limit)
        else:
            result = self.memory.get_all(user_id=user_id, limit=limit)

        # Mem0 반환값 처리
        if isinstance(result, dict):
            return result.get('results', [])
        return result if isinstance(result, list) else []

    def _delete(self, user_id: str) -> bool:
        """메모리 삭제 (공통)"""
        try:
            self.memory.delete_all(user_id=user_id)
            return True
        except Exception as e:
            logger.error(f"Delete failed for {user_id}: {e}")
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

    def add_doc_memory(self, doc_id: int, user_id: int, messages: List[Dict], metadata: Dict = None) -> Dict:
        """문서 대화 메모리 추가"""
        meta = {"memory_type": "document", "doc_id": doc_id, "user_id": user_id, **(metadata or {})}
        result = self._add(f"doc_{doc_id}", messages, meta, PROMPTS["doc"])
        logger.info(f"Added doc memory: doc_id={doc_id}")
        return result

    def get_doc_memory(self, doc_id: int, query: str = None, limit: int = 10) -> List[Dict]:
        """문서 메모리 조회"""
        return self._get(f"doc_{doc_id}", query, limit)

    def delete_doc_memory(self, doc_id: int) -> bool:
        """문서 메모리 삭제"""
        success = self._delete(f"doc_{doc_id}")
        if success:
            logger.info(f"Deleted doc memory: doc_id={doc_id}")
        return success

    # ==================== 사용자 메모리 (장기) ====================

    def add_user_memory(self, user_id: int, messages: List[Dict], metadata: Dict = None) -> Dict:
        """사용자 선호도 메모리 추가"""
        meta = {"memory_type": "user_preference", "user_id": user_id, **(metadata or {})}
        result = self._add(f"user_{user_id}", messages, meta, PROMPTS["user"])
        logger.info(f"Added user memory: user_id={user_id}")
        return result

    def get_user_memory(self, user_id: int, query: str = None, limit: int = 10) -> List[Dict]:
        """사용자 메모리 조회"""
        return self._get(f"user_{user_id}", query, limit)

    # ==================== 거래처 메모리 (장기) ====================

    def add_buyer_memory(self, user_id: int, buyer_name: str, messages: List[Dict], metadata: Dict = None) -> Dict:
        """거래처 메모 추가"""
        normalized = self._normalize_buyer(buyer_name)
        meta = {"memory_type": "buyer_memo", "user_id": user_id,
                "buyer_name": buyer_name, "buyer_normalized": normalized, **(metadata or {})}
        result = self._add(f"buyer_{user_id}_{normalized}", messages, meta, PROMPTS["buyer"])
        logger.info(f"Added buyer memory: user_id={user_id}, buyer={buyer_name}")
        return result

    def get_buyer_memory(self, user_id: int, buyer_name: str, query: str = None, limit: int = 10) -> List[Dict]:
        """거래처 메모 조회"""
        normalized = self._normalize_buyer(buyer_name)
        return self._get(f"buyer_{user_id}_{normalized}", query, limit)

    # ==================== 일반채팅 메모리 (단기) ====================

    def add_gen_chat_memory(self, gen_chat_id: int, user_id: int, messages: List[Dict], metadata: Dict = None) -> Dict:
        """일반채팅 메모리 추가"""
        meta = {"memory_type": "gen_chat", "gen_chat_id": gen_chat_id, "user_id": user_id, **(metadata or {})}
        result = self._add(f"gen_chat_{gen_chat_id}", messages, meta)
        logger.info(f"Added gen_chat memory: gen_chat_id={gen_chat_id}")
        return result

    def get_gen_chat_memory(self, gen_chat_id: int, query: str = None, limit: int = 10) -> List[Dict]:
        """일반채팅 메모리 조회"""
        return self._get(f"gen_chat_{gen_chat_id}", query, limit)

    def delete_gen_chat_memory(self, gen_chat_id: int) -> bool:
        """일반채팅 메모리 삭제"""
        success = self._delete(f"gen_chat_{gen_chat_id}")
        if success:
            logger.info(f"Deleted gen_chat memory: gen_chat_id={gen_chat_id}")
        return success

    # ==================== 스마트 저장 (자동 분배) ====================

    def save_memory_smart(
        self,
        messages: List[Dict[str, str]],
        user_id: int,
        doc_id: int = None,
        buyer_name: str = None,
        save_doc: bool = True,
        save_user: bool = True,
        save_buyer: bool = True
    ) -> Dict[str, bool]:
        """
        스마트 메모리 저장 - 3개 메모리에 병렬 자동 분배

        Args:
            messages: 대화 메시지
            user_id: 사용자 ID
            doc_id: 문서 ID (있으면 단기 메모리 저장)
            buyer_name: 거래처명 (있으면 거래처 메모리 저장)

        Returns:
            {"doc": bool, "user": bool, "buyer": bool}
        """
        import concurrent.futures

        result = {"doc": False, "user": False, "buyer": False}

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                futures = {}

                if save_doc and doc_id:
                    futures['doc'] = executor.submit(self.add_doc_memory, doc_id, user_id, messages)

                if save_user:
                    futures['user'] = executor.submit(self.add_user_memory, user_id, messages)

                if save_buyer and buyer_name:
                    futures['buyer'] = executor.submit(self.add_buyer_memory, user_id, buyer_name, messages)

                for key, future in futures.items():
                    try:
                        future.result(timeout=10)
                        result[key] = True
                    except Exception as e:
                        logger.warning(f"Smart save {key} failed: {e}")

            logger.info(f"Smart save: doc={result['doc']}, user={result['user']}, buyer={result['buyer']}")

        except Exception as e:
            logger.error(f"Smart save failed: {e}")

        return result

    # ==================== 컨텍스트 빌더 ====================

    def build_context(
        self,
        doc_id: int,
        user_id: int,
        query: str,
        buyer_name: str = None
    ) -> Dict[str, Any]:
        """
        대화 컨텍스트 구성 (병렬 조회)

        Returns:
            {"doc_memories": [...], "user_memories": [...], "buyer_memories": [...]}
        """
        import concurrent.futures

        context = {"doc_memories": [], "user_memories": [], "buyer_memories": []}

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                doc_f = executor.submit(self.get_doc_memory, doc_id, query, 5)
                user_f = executor.submit(self.get_user_memory, user_id, query, 3)
                buyer_f = executor.submit(self.get_buyer_memory, user_id, buyer_name, query, 3) if buyer_name else None

                context["doc_memories"] = doc_f.result()
                context["user_memories"] = user_f.result()
                if buyer_f:
                    context["buyer_memories"] = buyer_f.result()

        except Exception as e:
            logger.error(f"Build context failed: {e}")

        return context


# ==================== 싱글톤 인스턴스 ====================

_memory_service_instance = None

def get_memory_service() -> Optional[TradeMemoryService]:
    """메모리 서비스 인스턴스 반환 (lazy init)"""
    global _memory_service_instance
    if _memory_service_instance is None:
        try:
            _memory_service_instance = TradeMemoryService()
        except Exception as e:
            logger.warning(f"TradeMemoryService init failed (disabled): {e}")
            return None
    return _memory_service_instance
