# -*- coding: utf-8 -*-
"""
Chat Utils - 공통 유틸리티 함수

User 조회 및 관련 헬퍼 함수들
"""

import logging
from typing import Optional
from .models import User, Department

logger = logging.getLogger(__name__)


def get_user_by_id_or_emp_no(user_id) -> Optional[User]:
    """
    user_id(숫자) 또는 emp_no(사원번호)로 사용자 조회

    Args:
        user_id: emp_no(사원번호 문자열) 또는 user_id(정수)

    Returns:
        User 객체 또는 None (사용자가 없는 경우)
    """
    if user_id is None:
        return None

    try:
        # 1단계: emp_no(사원번호)로 먼저 조회 시도
        try:
            return User.objects.get(emp_no=str(user_id))
        except User.DoesNotExist:
            pass

        # 2단계: user_id(정수)로 조회
        if isinstance(user_id, int) or (isinstance(user_id, str) and user_id.isdigit()):
            try:
                return User.objects.get(user_id=int(user_id))
            except User.DoesNotExist:
                pass

        return None

    except Exception as e:
        logger.warning(f"User lookup failed: user_id={user_id}, error={e}")
        return None


def get_or_create_user(user_id) -> Optional[User]:
    """
    user_id(숫자) 또는 emp_no(사원번호)로 사용자 조회 또는 생성

    개발/테스트 환경에서 사용자가 없으면 자동 생성합니다.

    Args:
        user_id: emp_no(사원번호 문자열) 또는 user_id(정수)

    Returns:
        User 객체 또는 None
    """
    if user_id is None:
        return None

    # 먼저 기존 사용자 조회
    user = get_user_by_id_or_emp_no(user_id)
    if user:
        return user

    # 사용자가 없으면 자동 생성 (개발/테스트용)
    try:
        default_dept, _ = Department.objects.get_or_create(
            dept_name="Default",
            defaults={"dept_name": "Default"}
        )
        user = User.objects.create(
            emp_no=str(user_id),
            name=f"User_{user_id}",
            password="temp_password",
            dept=default_dept
        )
        logger.info(f"새 사용자 자동 생성: emp_no={user_id}, user_id={user.user_id}")
        return user

    except Exception as e:
        logger.error(f"사용자 조회/생성 실패: {e}")
        return None


def get_user_id_int(user_id) -> Optional[int]:
    """
    user_id 파라미터로부터 정수 user_id 반환

    Django ORM 조회를 수행하므로 반드시 sync 컨텍스트에서 호출해야 함.

    Args:
        user_id: emp_no(사원번호 문자열) 또는 user_id(정수)

    Returns:
        정수 user_id 또는 None
    """
    user = get_user_by_id_or_emp_no(user_id)
    return user.user_id if user else None
