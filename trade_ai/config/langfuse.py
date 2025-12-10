"""Langfuse 설정 및 프롬프트 로딩 유틸리티 - 실제 langfuse_config.py 기준"""

from pathlib import Path

from .settings import get_settings

# Langfuse 클라이언트 싱글톤
_langfuse_client = None
_langfuse_enabled = None


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
        print("✅ Langfuse SDK 클라이언트 초기화 완료")
    return _langfuse_client


def load_prompt_from_langfuse(
    prompt_name: str,
    version: int | None = None,
    label: str = "latest",
    **variables
) -> str:
    """
    Langfuse SDK를 통해 프롬프트를 가져오고 변수 치환

    Args:
        prompt_name: Langfuse에 등록된 프롬프트 이름
        version: 특정 버전 번호 (None이면 label 기준)
        label: 버전 레이블 ("production", "latest" 등)
        **variables: 프롬프트 템플릿 변수들

    Returns:
        변수가 치환된 프롬프트 문자열
    """
    client = get_langfuse_client()
    if not client:
        raise Exception("Langfuse가 비활성화되어 있습니다")

    try:
        if version is not None:
            prompt = client.get_prompt(prompt_name, version=version)
            print(f"✅ Langfuse 프롬프트 로드: {prompt_name} (버전: {version})")
        else:
            prompt = client.get_prompt(prompt_name, label=label)
            print(f"✅ Langfuse 프롬프트 로드: {prompt_name} (label: {label})")

        if variables:
            return prompt.compile(**variables)
        else:
            return prompt.compile()

    except Exception as e:
        raise Exception(f"Langfuse 프롬프트 로드 실패: {e}")


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
