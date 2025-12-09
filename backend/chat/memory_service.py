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
from typing import List, Dict, Any, Optional
from mem0 import Memory

logger = logging.getLogger(__name__)


# ==================== 커스텀 프롬프트 ====================

PROMPTS = {
    # 문서 단기 메모리 - 세션 요약
    "doc": """
현재 문서 작업 세션의 핵심 내용만 요약하세요.
저장: 작업 목표, 수정 요청사항, 완료된 작업, 현재 진행 상황
제외: 인사말, 단순 확인, 구체적 금액/수량/날짜(RDS에 저장됨)
""",

    # 일반채팅 단기 메모리 - 대화 요약
    "gen_chat": """
현재 대화 세션의 핵심 내용만 요약하세요.
저장: 대화 주제, 질문/답변 요약, 논의된 무역 관련 정보
제외: 인사말, 단순 확인, 반복 내용
""",

    # 사용자 장기 메모리 - 선호도만
    "user": """
사용자의 일반적인 선호도와 스타일만 추출하세요.
저장할 정보:
- 무역 조건 선호 (예: "FOB 조건 선호", "CIF 조건을 주로 사용")
- 결제 방식 선호 (예: "T/T 결제 선호", "L/C 사용")
- 커뮤니케이션 스타일 (예: "상세한 설명 선호", "간결한 답변 선호")
- 자주 거래하는 품목/지역 패턴
제외: 특정 거래 정보(금액/수량/날짜), 일회성 요청, 거래처 정보
""",

    # 거래처 장기 메모리 - 거래처 특성만
    "buyer": """
거래처(buyer)에 대한 중요 정보만 추출하세요.
저장할 정보:
- 거래처 특성 (예: "품질 요구 높음", "가격 민감")
- 선호 조건 (예: "항상 FOB 요청", "샘플 필수 요구")
- 주의사항 (예: "결제 지연 이력", "클레임 까다로움")
- 커뮤니케이션 특성 (예: "빠른 응답 요구", "상세 문서 선호")
제외: 단순 거래 내역(금액/수량/날짜), 일회성 거래 정보
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

            # Mem0 설정
            config = {
                "vector_store": {"provider": "qdrant", "config": qdrant_config},
                "llm": {
                    "provider": "openai",
                    "config": {
                        "model": "gpt-4o-mini",
                        "temperature": 0.1,
                        "max_tokens": 2000
                    }
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
        """거래처명 정규화 (소문자, 공백→언더스코어, 특수문자 제거)"""
        if not name:
            return ""
        normalized = name.lower().strip()
        normalized = re.sub(r'\s+', '_', normalized)
        normalized = re.sub(r'[^a-z0-9_가-힣]', '', normalized)
        return normalized

    # ==================== 문서 메모리 (단기 - 세션 요약) ====================

    def add_doc_memory(self, doc_id: int, user_id: int, messages: List[Dict], metadata: Dict = None) -> Dict:
        """문서 작업 세션 요약 저장"""
        meta = {"memory_type": "doc_session", "doc_id": doc_id, "user_id": user_id, **(metadata or {})}
        result = self._add(f"doc_{doc_id}", messages, meta, PROMPTS["doc"])
        logger.info(f"Added doc session memory: doc_id={doc_id}")
        return result

    def get_doc_memory(self, doc_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """문서 세션 메모리 조회"""
        return self._get(f"doc_{doc_id}", query, limit)

    def delete_doc_memory(self, doc_id: int) -> bool:
        """문서 메모리 삭제"""
        success = self._delete(f"doc_{doc_id}")
        if success:
            logger.info(f"Deleted doc memory: doc_id={doc_id}")
        return success

    # ==================== Trade 메모리 삭제 (문서 일괄 삭제) ====================

    def delete_trade_memory(self, trade_id: int, doc_ids: List[int]) -> bool:
        """Trade 삭제 시 관련 모든 문서 메모리 삭제"""
        success_count = 0
        for doc_id in doc_ids:
            if self.delete_doc_memory(doc_id):
                success_count += 1

        logger.info(f"Deleted trade memory: trade_id={trade_id}, {success_count}/{len(doc_ids)} docs")
        return success_count == len(doc_ids)

    # ==================== 사용자 메모리 (장기 - 선호도) ====================

    def add_user_memory(self, user_id: int, messages: List[Dict], metadata: Dict = None) -> Dict:
        """사용자 선호도 저장 (장기)"""
        meta = {"memory_type": "user_preference", "user_id": user_id, **(metadata or {})}
        result = self._add(f"user_{user_id}", messages, meta, PROMPTS["user"])
        logger.info(f"Added user preference: user_id={user_id}")
        return result

    def get_user_memory(self, user_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """사용자 선호도 조회"""
        return self._get(f"user_{user_id}", query, limit)

    # ==================== 거래처 메모리 (장기 - 거래처별 메모) ====================

    def add_buyer_memory(self, user_id: int, buyer_name: str, messages: List[Dict], metadata: Dict = None) -> Dict:
        """거래처 메모 저장 (장기)"""
        normalized = self._normalize_buyer(buyer_name)
        if not normalized:
            logger.warning(f"Invalid buyer name: {buyer_name}")
            return {}

        meta = {
            "memory_type": "buyer_memo",
            "user_id": user_id,
            "buyer_name": buyer_name,
            "buyer_normalized": normalized,
            **(metadata or {})
        }
        result = self._add(f"buyer_{user_id}_{normalized}", messages, meta, PROMPTS["buyer"])
        logger.info(f"Added buyer memo: user_id={user_id}, buyer={buyer_name}")
        return result

    def get_buyer_memory(self, user_id: int, buyer_name: str, query: str = None, limit: int = 5) -> List[Dict]:
        """거래처 메모 조회"""
        normalized = self._normalize_buyer(buyer_name)
        if not normalized:
            return []
        return self._get(f"buyer_{user_id}_{normalized}", query, limit)

    # ==================== 일반채팅 메모리 (단기 - 대화 요약) ====================

    def add_gen_chat_memory(self, gen_chat_id: int, user_id: int, messages: List[Dict], metadata: Dict = None) -> Dict:
        """일반채팅 대화 요약 저장"""
        meta = {"memory_type": "gen_chat_session", "gen_chat_id": gen_chat_id, "user_id": user_id, **(metadata or {})}
        result = self._add(f"gen_chat_{gen_chat_id}", messages, meta, PROMPTS["gen_chat"])
        logger.info(f"Added gen_chat session memory: gen_chat_id={gen_chat_id}")
        return result

    def get_gen_chat_memory(self, gen_chat_id: int, query: str = None, limit: int = 5) -> List[Dict]:
        """일반채팅 세션 메모리 조회"""
        return self._get(f"gen_chat_{gen_chat_id}", query, limit)

    def delete_gen_chat_memory(self, gen_chat_id: int) -> bool:
        """일반채팅 메모리 삭제"""
        success = self._delete(f"gen_chat_{gen_chat_id}")
        if success:
            logger.info(f"Deleted gen_chat memory: gen_chat_id={gen_chat_id}")
        return success

    # ==================== 컨텍스트 빌더 ====================

    def build_doc_context(
        self,
        doc_id: int,
        user_id: int,
        query: str,
        buyer_name: str = None
    ) -> Dict[str, Any]:
        """
        문서 채팅용 컨텍스트 구성 (병렬 조회)

        Returns:
            {
                "doc_memories": [...],    # 현재 문서 세션 요약
                "user_memories": [...],   # 사용자 선호도
                "buyer_memories": [...],  # 거래처 메모 (있으면)
                "context_summary": "..."
            }
        """
        import concurrent.futures

        context = {"doc_memories": [], "user_memories": [], "buyer_memories": [], "context_summary": ""}

        try:
            with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
                doc_f = executor.submit(self.get_doc_memory, doc_id, query, 3)
                user_f = executor.submit(self.get_user_memory, user_id, query, 3)
                buyer_f = executor.submit(self.get_buyer_memory, user_id, buyer_name, query, 3) if buyer_name else None

                context["doc_memories"] = doc_f.result()
                context["user_memories"] = user_f.result()
                if buyer_f:
                    context["buyer_memories"] = buyer_f.result()

            # 요약 생성
            parts = []
            if context["doc_memories"]:
                parts.append(f"문서 작업 이력 {len(context['doc_memories'])}건")
            if context["user_memories"]:
                parts.append(f"사용자 선호도 {len(context['user_memories'])}건")
            if context["buyer_memories"]:
                parts.append(f"거래처 메모 {len(context['buyer_memories'])}건")
            context["context_summary"] = ", ".join(parts) if parts else ""

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
        """
        일반채팅용 컨텍스트 구성

        Returns:
            {
                "chat_memories": [...],   # 현재 채팅 세션 요약
                "user_memories": [...],   # 사용자 선호도
                "context_summary": "..."
            }
        """
        import concurrent.futures

        context = {"chat_memories": [], "user_memories": [], "context_summary": ""}

        try:
            if is_first_message:
                # 첫 메시지면 단기 메모리 스킵 (새 채팅방)
                context["user_memories"] = self.get_user_memory(user_id, query, 3)
            else:
                with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                    chat_f = executor.submit(self.get_gen_chat_memory, gen_chat_id, query, 3)
                    user_f = executor.submit(self.get_user_memory, user_id, query, 3)

                    context["chat_memories"] = chat_f.result()
                    context["user_memories"] = user_f.result()

            # 요약 생성
            parts = []
            if context["chat_memories"]:
                parts.append(f"대화 이력 {len(context['chat_memories'])}건")
            if context["user_memories"]:
                parts.append(f"사용자 선호도 {len(context['user_memories'])}건")
            context["context_summary"] = ", ".join(parts) if parts else ""

        except Exception as e:
            logger.error(f"Build gen_chat context failed: {e}")

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
