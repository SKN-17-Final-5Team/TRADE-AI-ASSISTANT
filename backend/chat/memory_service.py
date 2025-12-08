"""
Mem0 Memory Service for Trade Assistant

This module provides memory management for:
1. Short-term memory: Current document conversation context (doc_id based)
2. Long-term memory: User preferences and patterns (user_id based)
"""

import os
import logging
from typing import List, Dict, Any, Optional

# 타임존 설정 (Asia/Seoul)
os.environ['TZ'] = 'Asia/Seoul'
try:
    import time
    time.tzset()
except AttributeError:
    pass  # Windows에서는 tzset() 미지원

from mem0 import Memory

logger = logging.getLogger(__name__)


class TradeMemoryService:
    """
    메모리 관리 서비스

    - RDS: 전체 대화 히스토리 저장
    - Mem0: 중요 정보 추출 및 컨텍스트 관리
    """

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        try:
            # MEM0_API_KEY를 OPENAI_API_KEY로 설정 (Mem0 내부에서 OpenAI 사용)
            mem0_api_key = os.getenv("MEM0_API_KEY")
            if mem0_api_key and not os.getenv("OPENAI_API_KEY"):
                os.environ["OPENAI_API_KEY"] = mem0_api_key
                logger.info("Set OPENAI_API_KEY from MEM0_API_KEY")

            # Qdrant 연결 설정
            qdrant_url = os.getenv("QDRANT_URL")
            qdrant_api_key = os.getenv("QDRANT_API_KEY")

            if qdrant_url and qdrant_api_key:
                # 클라우드 Qdrant 사용
                qdrant_config = {
                    "url": qdrant_url,
                    "api_key": qdrant_api_key,
                    "collection_name": "trade_memory"
                }
                logger.info(f"Using cloud Qdrant: {qdrant_url}")
            else:
                # 로컬 Qdrant 사용
                qdrant_config = {
                    "host": os.getenv("QDRANT_HOST", "localhost"),
                    "port": int(os.getenv("QDRANT_PORT", 6333)),
                    "collection_name": "trade_memory"
                }
                logger.info("Using local Qdrant")

            # Mem0 초기화
            config = {
                "vector_store": {
                    "provider": "qdrant",
                    "config": qdrant_config
                },
                "llm": {
                    "provider": "openai",
                    "config": {
                        "model": "gpt-4o-mini",
                        "temperature": 0.1,
                        "max_tokens": 2000,
                    }
                },
                "embedder": {
                    "provider": "openai",
                    "config": {
                        "model": "text-embedding-3-small"
                    }
                }
            }

            self.memory = Memory.from_config(config)
            self._initialized = True
            logger.info("TradeMemoryService initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize TradeMemoryService: {e}")
            import traceback
            traceback.print_exc()
            raise

    # ==================== Document Memory (Short-term) ====================

    def add_doc_memory(
        self,
        doc_id: int,
        user_id: int,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        문서 대화 메모리 추가 (단기 메모리)

        Args:
            doc_id: 문서 ID
            user_id: 사용자 ID
            messages: 대화 메시지 [{"role": "user/assistant", "content": "..."}]
            metadata: 추가 메타데이터 (doc_type, trade_id 등)

        Returns:
            추가된 메모리 정보
        """
        try:
            # 메타데이터 구성
            mem_metadata = {
                "memory_type": "document",
                "doc_id": doc_id,
                "user_id": user_id,
                **(metadata or {})
            }

            # Mem0에 메모리 추가
            result = self.memory.add(
                messages=messages,
                user_id=f"doc_{doc_id}",  # 문서별 컨텍스트
                metadata=mem_metadata
            )

            logger.info(f"Added doc memory: doc_id={doc_id}, user_id={user_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to add doc memory: {e}")
            raise

    def get_doc_memory(
        self,
        doc_id: int,
        query: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        문서 메모리 조회

        Args:
            doc_id: 문서 ID
            query: 검색 쿼리 (없으면 전체 조회)
            limit: 최대 결과 수

        Returns:
            메모리 목록
        """
        try:
            if query:
                # 쿼리 기반 검색
                result = self.memory.search(
                    query=query,
                    user_id=f"doc_{doc_id}",
                    limit=limit
                )
            else:
                # 전체 메모리 조회
                result = self.memory.get_all(
                    user_id=f"doc_{doc_id}",
                    limit=limit
                )

            # Mem0 반환값 처리: dict 또는 list
            if isinstance(result, dict):
                memories = result.get('results', [])
            elif isinstance(result, list):
                memories = result
            else:
                memories = []

            logger.info(f"Retrieved {len(memories)} memories for doc_id={doc_id}")
            return memories

        except Exception as e:
            logger.error(f"Failed to get doc memory: {e}")
            import traceback
            traceback.print_exc()
            return []

    def delete_doc_memory(self, doc_id: int) -> bool:
        """
        문서 메모리 삭제

        Args:
            doc_id: 문서 ID

        Returns:
            성공 여부
        """
        try:
            # 해당 문서의 모든 메모리 삭제
            self.memory.delete_all(user_id=f"doc_{doc_id}")
            logger.info(f"Deleted all memories for doc_id={doc_id}")
            return True

        except Exception as e:
            logger.error(f"Failed to delete doc memory: {e}")
            return False

    # ==================== Trade Memory (Delete cascade) ====================

    def delete_trade_memory(self, trade_id: int, doc_ids: List[int]) -> bool:
        """
        무역 플로우 삭제 시 관련 모든 문서 메모리 삭제

        Args:
            trade_id: 무역 ID
            doc_ids: 삭제할 문서 ID 목록

        Returns:
            성공 여부
        """
        try:
            success_count = 0
            for doc_id in doc_ids:
                if self.delete_doc_memory(doc_id):
                    success_count += 1

            logger.info(
                f"Deleted memories for trade_id={trade_id}: "
                f"{success_count}/{len(doc_ids)} documents"
            )
            return success_count == len(doc_ids)

        except Exception as e:
            logger.error(f"Failed to delete trade memory: {e}")
            return False

    # ==================== User Memory (Long-term) ====================

    def add_user_memory(
        self,
        user_id: int,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        사용자 장기 메모리 추가

        Args:
            user_id: 사용자 ID
            messages: 대화 메시지
            metadata: 추가 메타데이터

        Returns:
            추가된 메모리 정보
        """
        try:
            mem_metadata = {
                "memory_type": "user",
                "user_id": user_id,
                **(metadata or {})
            }

            result = self.memory.add(
                messages=messages,
                user_id=f"user_{user_id}",
                metadata=mem_metadata
            )

            logger.info(f"Added user memory: user_id={user_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to add user memory: {e}")
            raise

    def get_user_memory(
        self,
        user_id: int,
        query: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        사용자 장기 메모리 조회

        Args:
            user_id: 사용자 ID
            query: 검색 쿼리
            limit: 최대 결과 수

        Returns:
            메모리 목록
        """
        try:
            if query:
                result = self.memory.search(
                    query=query,
                    user_id=f"user_{user_id}",
                    limit=limit
                )
            else:
                result = self.memory.get_all(
                    user_id=f"user_{user_id}",
                    limit=limit
                )

            # Mem0 반환값 처리: dict 또는 list
            if isinstance(result, dict):
                memories = result.get('results', [])
            elif isinstance(result, list):
                memories = result
            else:
                memories = []

            logger.info(f"Retrieved {len(memories)} user memories for user_id={user_id}")
            return memories

        except Exception as e:
            logger.error(f"Failed to get user memory: {e}")
            import traceback
            traceback.print_exc()
            return []

    # ==================== Trade Memory (Cross-document) ====================

    def get_trade_memory(
        self,
        trade_id: int,
        doc_ids: List[int],
        query: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        무역 플로우 내 모든 문서 메모리 조회 (다른 문서 참조용)

        Args:
            trade_id: 무역 ID
            doc_ids: 해당 무역의 모든 문서 ID 목록
            query: 검색 쿼리
            limit: 최대 결과 수

        Returns:
            메모리 목록
        """
        try:
            all_memories = []
            per_doc_limit = max(2, limit // len(doc_ids)) if doc_ids else limit

            for doc_id in doc_ids:
                memories = self.get_doc_memory(
                    doc_id=doc_id,
                    query=query,
                    limit=per_doc_limit
                )
                for mem in memories:
                    mem['source_doc_id'] = doc_id
                all_memories.extend(memories)

            # 최신순 정렬 후 limit 적용
            all_memories = all_memories[:limit]

            logger.info(
                f"Retrieved {len(all_memories)} memories for trade_id={trade_id} "
                f"from {len(doc_ids)} documents"
            )
            return all_memories

        except Exception as e:
            logger.error(f"Failed to get trade memory: {e}")
            return []

    # ==================== Context Building ====================

    def build_context(
        self,
        doc_id: int,
        user_id: int,
        current_query: str,
        include_user_memory: bool = True,
        trade_id: Optional[int] = None,
        sibling_doc_ids: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        대화 컨텍스트 구성 (최적화: 병렬 조회, 타임아웃 3초)

        Args:
            doc_id: 문서 ID
            user_id: 사용자 ID
            current_query: 현재 사용자 질문
            include_user_memory: 사용자 장기 메모리 포함 여부
            trade_id: 무역 ID (같은 무역 내 다른 문서 참조용)
            sibling_doc_ids: 같은 무역의 다른 문서 ID 목록

        Returns:
            {
                "doc_memories": [...],  # 현재 문서 관련 메모리
                "trade_memories": [...],  # 같은 무역 내 다른 문서 대화 메모리
                "user_memories": [...],  # 사용자 관련 메모리
                "context_summary": "..."  # 컨텍스트 요약
            }
        """
        import concurrent.futures

        context = {
            "doc_memories": [],
            "trade_memories": [],
            "user_memories": [],
            "context_summary": ""
        }

        try:
            # 병렬로 모든 메모리 조회 (ThreadPoolExecutor 사용)
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                # 1. 현재 문서 메모리 조회 태스크
                doc_future = executor.submit(
                    self.get_doc_memory,
                    doc_id=doc_id,
                    query=current_query,
                    limit=5
                )

                # 2. 같은 무역 내 다른 문서 대화 메모리 조회 태스크 (옵션)
                trade_future = None
                if trade_id and sibling_doc_ids:
                    other_doc_ids = [d for d in sibling_doc_ids if d != doc_id]
                    if other_doc_ids:
                        trade_future = executor.submit(
                            self.get_trade_memory,
                            trade_id=trade_id,
                            doc_ids=other_doc_ids,
                            query=current_query,
                            limit=5
                        )

                # 3. 사용자 장기 메모리 조회 태스크 (옵션)
                user_future = None
                if include_user_memory:
                    user_future = executor.submit(
                        self.get_user_memory,
                        user_id=user_id,
                        query=current_query,
                        limit=3
                    )

                # 결과 수집 (타임아웃 없음 - 메모리 조회 완료까지 대기)
                context["doc_memories"] = doc_future.result()

                if trade_future:
                    context["trade_memories"] = trade_future.result()

                if user_future:
                    context["user_memories"] = user_future.result()

            # 컨텍스트 요약 생성
            summary_parts = []

            if context["doc_memories"]:
                summary_parts.append(
                    f"현재 문서에서 {len(context['doc_memories'])}개의 관련 대화가 있었습니다."
                )

            if context["trade_memories"]:
                summary_parts.append(
                    f"같은 무역의 다른 문서에서 {len(context['trade_memories'])}개의 관련 대화가 있습니다."
                )

            if context["user_memories"]:
                summary_parts.append(
                    f"사용자의 {len(context['user_memories'])}개 이전 선호사항이 있습니다."
                )

            context["context_summary"] = " ".join(summary_parts)

            logger.info(
                f"Built context for doc_id={doc_id}, user_id={user_id}: "
                f"{len(context['doc_memories'])} doc memories, "
                f"{len(context['trade_memories'])} trade memories, {len(context['user_memories'])} user memories"
            )

        except Exception as e:
            logger.error(f"Failed to build context: {e}")

        return context

    # ==================== General Chat Memory ====================

    def add_gen_chat_memory(
        self,
        gen_chat_id: int,
        user_id: int,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        일반 채팅 메모리 추가 (단기 메모리)

        Args:
            gen_chat_id: 일반 채팅 세션 ID
            user_id: 사용자 ID
            messages: 대화 메시지 [{"role": "user/assistant", "content": "..."}]
            metadata: 추가 메타데이터

        Returns:
            추가된 메모리 정보
        """
        try:
            mem_metadata = {
                "memory_type": "gen_chat",
                "gen_chat_id": gen_chat_id,
                "user_id": user_id,
                **(metadata or {})
            }

            result = self.memory.add(
                messages=messages,
                user_id=f"gen_chat_{gen_chat_id}",  # 채팅 세션별 컨텍스트
                metadata=mem_metadata
            )

            logger.info(f"Added gen_chat memory: gen_chat_id={gen_chat_id}, user_id={user_id}")
            return result

        except Exception as e:
            logger.error(f"Failed to add gen_chat memory: {e}")
            raise

    def get_gen_chat_memory(
        self,
        gen_chat_id: int,
        query: Optional[str] = None,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        일반 채팅 메모리 조회

        Args:
            gen_chat_id: 일반 채팅 세션 ID
            query: 검색 쿼리 (없으면 전체 조회)
            limit: 최대 결과 수

        Returns:
            메모리 목록
        """
        try:
            if query:
                result = self.memory.search(
                    query=query,
                    user_id=f"gen_chat_{gen_chat_id}",
                    limit=limit
                )
            else:
                result = self.memory.get_all(
                    user_id=f"gen_chat_{gen_chat_id}",
                    limit=limit
                )

            if isinstance(result, dict):
                memories = result.get('results', [])
            elif isinstance(result, list):
                memories = result
            else:
                memories = []

            logger.info(f"Retrieved {len(memories)} memories for gen_chat_id={gen_chat_id}")
            return memories

        except Exception as e:
            logger.error(f"Failed to get gen_chat memory: {e}")
            return []

    def build_gen_chat_context(
        self,
        gen_chat_id: int,
        user_id: int,
        current_query: str,
        include_user_memory: bool = True,
        is_first_message: bool = False
    ) -> Dict[str, Any]:
        """
        일반 채팅 컨텍스트 구성 (최적화: 첫 메시지면 단기 메모리 스킵, 병렬 조회)

        Args:
            gen_chat_id: 일반 채팅 세션 ID
            user_id: 사용자 ID
            current_query: 현재 사용자 질문
            include_user_memory: 사용자 장기 메모리 포함 여부
            is_first_message: 첫 메시지 여부 (True면 단기 메모리 스킵)

        Returns:
            {
                "chat_memories": [...],  # 현재 채팅 세션 관련 메모리
                "user_memories": [...],  # 사용자 장기 메모리
                "context_summary": "..."  # 컨텍스트 요약
            }
        """
        import concurrent.futures

        context = {
            "chat_memories": [],
            "user_memories": [],
            "context_summary": ""
        }

        try:
            # 첫 메시지면 단기 메모리 스킵 (새 채팅방이라 조회할 메모리 없음)
            if is_first_message:
                logger.info(f"First message - skipping chat memory lookup for gen_chat_id={gen_chat_id}")
                # 장기 메모리만 조회
                if include_user_memory:
                    user_memories = self.get_user_memory(
                        user_id=user_id,
                        query=current_query,
                        limit=3
                    )
                    context["user_memories"] = user_memories
            else:
                # 병렬로 두 메모리 조회 (ThreadPoolExecutor 사용)
                with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                    # 단기 메모리 조회 태스크
                    chat_future = executor.submit(
                        self.get_gen_chat_memory,
                        gen_chat_id=gen_chat_id,
                        query=current_query,
                        limit=5
                    )

                    # 장기 메모리 조회 태스크 (옵션)
                    user_future = None
                    if include_user_memory:
                        user_future = executor.submit(
                            self.get_user_memory,
                            user_id=user_id,
                            query=current_query,
                            limit=3
                        )

                    # 결과 수집 (타임아웃 없음 - 메모리 조회 완료까지 대기)
                    context["chat_memories"] = chat_future.result()

                    if user_future:
                        context["user_memories"] = user_future.result()

            # 컨텍스트 요약 생성
            summary_parts = []

            if context["chat_memories"]:
                summary_parts.append(
                    f"현재 대화에서 {len(context['chat_memories'])}개의 관련 정보가 있습니다."
                )

            if context["user_memories"]:
                summary_parts.append(
                    f"사용자의 {len(context['user_memories'])}개 이전 선호사항이 있습니다."
                )

            context["context_summary"] = " ".join(summary_parts)

            logger.info(
                f"Built gen_chat context: gen_chat_id={gen_chat_id}, user_id={user_id}, first_msg={is_first_message}: "
                f"{len(context['chat_memories'])} chat memories, {len(context['user_memories'])} user memories"
            )

        except Exception as e:
            logger.error(f"Failed to build gen_chat context: {e}")

        return context

    # ==================== Utility ====================

    def get_memory_stats(self, doc_id: int = None, user_id: int = None) -> Dict[str, int]:
        """
        메모리 통계 조회

        Args:
            doc_id: 문서 ID (선택)
            user_id: 사용자 ID (선택)

        Returns:
            통계 정보
        """
        stats = {}

        try:
            if doc_id:
                doc_memories = self.get_doc_memory(doc_id, limit=1000)
                stats["doc_memory_count"] = len(doc_memories)

            if user_id:
                user_memories = self.get_user_memory(user_id, limit=1000)
                stats["user_memory_count"] = len(user_memories)

        except Exception as e:
            logger.error(f"Failed to get memory stats: {e}")

        return stats


# Singleton instance (lazy initialization)
_memory_service_instance = None

def get_memory_service():
    """Get or create memory service instance (lazy initialization)"""
    global _memory_service_instance
    if _memory_service_instance is None:
        try:
            _memory_service_instance = TradeMemoryService()
        except Exception as e:
            logger.warning(f"⚠️ TradeMemoryService 초기화 실패 (메모리 기능 비활성화): {e}")
            return None
    return _memory_service_instance

# For backwards compatibility
memory_service = None  # Will be initialized on first use
