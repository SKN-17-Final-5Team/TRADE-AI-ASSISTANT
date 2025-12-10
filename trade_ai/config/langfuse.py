"""Langfuse 설정 및 프롬프트 로딩 유틸리티 - 프롬프트 캐싱 지원"""

import logging
from pathlib import Path

from .settings import get_settings

logger = logging.getLogger(__name__)

# Langfuse 클라이언트 싱글톤
_langfuse_client = None
_langfuse_enabled = None

# 프롬프트 템플릿 캐시 (prompt_name -> prompt 객체)
_prompt_cache: dict = {}


def is_langfuse_enabled() -> bool:
    """Langfuse 활성화 여부 (지연 평가)"""
    global _langfuse_enabled
    if _langfuse_enabled is None:
        settings = get_settings()
        _langfuse_enabled = bool(settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY)
    return _langfuse_enabled


# 하위 호환성 별칭 (함수 호출 필요)
LANGFUSE_ENABLED = is_langfuse_enabled


def get_langfuse_client():
    """Langfuse 클라이언트 싱글톤 반환"""
    global _langfuse_client
    if _langfuse_client is None and is_langfuse_enabled():
        from langfuse import Langfuse
        settings = get_settings()
        _langfuse_client = Langfuse(
            public_key=settings.LANGFUSE_PUBLIC_KEY,
            secret_key=settings.LANGFUSE_SECRET_KEY,
            host=settings.LANGFUSE_BASE_URL
        )
        logger.info("Langfuse SDK 클라이언트 초기화 완료")
    return _langfuse_client


def _get_cache_key(prompt_name: str, version: int | None, label: str) -> str:
    """캐시 키 생성"""
    if version is not None:
        return f"{prompt_name}:v{version}"
    return f"{prompt_name}:{label}"


def get_prompt_template(
    prompt_name: str,
    version: int | None = None,
    label: str = "latest"
):
    """
    Langfuse 프롬프트 템플릿을 캐싱하여 반환

    프롬프트 객체를 캐싱하여 Langfuse API 호출을 최소화합니다.
    서버 시작 후 첫 요청에만 API 호출, 이후는 캐시에서 반환.

    Args:
        prompt_name: Langfuse에 등록된 프롬프트 이름
        version: 특정 버전 번호 (None이면 label 기준)
        label: 버전 레이블 ("production", "latest" 등)

    Returns:
        Langfuse 프롬프트 객체 (compile 가능)
    """
    global _prompt_cache

    cache_key = _get_cache_key(prompt_name, version, label)

    # 캐시 히트
    if cache_key in _prompt_cache:
        return _prompt_cache[cache_key]

    # 캐시 미스 - Langfuse API 호출
    client = get_langfuse_client()
    if not client:
        raise Exception("Langfuse가 비활성화되어 있습니다")

    try:
        if version is not None:
            prompt = client.get_prompt(prompt_name, version=version)
            logger.info(f"Langfuse 프롬프트 로드 (캐싱): {prompt_name} (버전: {version})")
        else:
            prompt = client.get_prompt(prompt_name, label=label)
            logger.info(f"Langfuse 프롬프트 로드 (캐싱): {prompt_name} (label: {label})")

        # 캐시에 저장
        _prompt_cache[cache_key] = prompt
        return prompt

    except Exception as e:
        raise Exception(f"Langfuse 프롬프트 로드 실패: {e}")


def load_prompt_from_langfuse(
    prompt_name: str,
    version: int | None = None,
    label: str = "latest",
    **variables
) -> str:
    """
    Langfuse SDK를 통해 프롬프트를 가져오고 변수 치환

    프롬프트 템플릿은 캐싱되며, 변수 치환(compile)만 매번 수행됩니다.

    Args:
        prompt_name: Langfuse에 등록된 프롬프트 이름
        version: 특정 버전 번호 (None이면 label 기준)
        label: 버전 레이블 ("production", "latest" 등)
        **variables: 프롬프트 템플릿 변수들

    Returns:
        변수가 치환된 프롬프트 문자열
    """
    prompt = get_prompt_template(prompt_name, version, label)

    if variables:
        return prompt.compile(**variables)
    else:
        return prompt.compile()


def load_prompt_from_file(filename: str = "trade_instructions.txt") -> str:
    """
    로컬 파일에서 프롬프트 로드 (Fallback용)

    Args:
        filename: 프롬프트 파일명 (prompts/ 디렉토리 내)

    Returns:
        파일 내용 (프롬프트 문자열)
    """
    # ai-server/prompts/ 디렉토리에서 로드
    project_root = Path(__file__).parent.parent
    prompts_dir = project_root / "prompts"
    file_path = prompts_dir / filename

    with open(file_path, "r", encoding="utf-8") as f:
        return f.read()


def clear_prompt_cache():
    """
    프롬프트 캐시 초기화

    프롬프트가 Langfuse에서 업데이트된 경우 캐시를 클리어하여
    새 버전을 로드할 수 있습니다.
    """
    global _prompt_cache
    _prompt_cache = {}
    logger.info("프롬프트 캐시 초기화됨")
