"""
AWS S3 유틸리티 함수

문서 업로드를 위한 presigned URL 생성 및 S3 관련 작업을 처리합니다.
Django 의존성 제거 - pydantic-settings 사용
"""

import os
import uuid
import logging
from functools import lru_cache

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from config.settings import get_settings

logger = logging.getLogger(__name__)


class S3Manager:
    """S3 파일 관리 클래스"""

    def __init__(self):
        settings = get_settings()
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
            endpoint_url=f'https://s3.{settings.AWS_S3_REGION_NAME}.amazonaws.com',
            config=Config(
                signature_version='s3v4',
                s3={'addressing_style': 'virtual'}
            )
        )
        self.bucket_name = settings.AWS_STORAGE_BUCKET_NAME

    def generate_presigned_upload_url(
        self,
        file_name: str,
        file_type: str = 'application/pdf',
        expiration: int = 3600
    ) -> dict:
        """
        Presigned URL 생성 (업로드용)

        Args:
            file_name: 원본 파일명
            file_type: MIME 타입 (기본값: application/pdf)
            expiration: URL 만료 시간(초) (기본값: 3600 = 1시간)

        Returns:
            {
                'upload_url': str,  # 클라이언트가 사용할 업로드 URL
                's3_key': str,  # S3에 저장될 파일 키
                'file_url': str  # 업로드 완료 후 파일 접근 URL (presigned)
            }
        """
        try:
            # 고유한 파일명 생성 (UUID + 원본 파일명)
            file_extension = os.path.splitext(file_name)[1]
            unique_filename = f"{uuid.uuid4()}{file_extension}"
            s3_key = f"documents/{unique_filename}"

            # Presigned URL 생성 (PUT 요청용)
            upload_url = self.s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key,
                    'ContentType': file_type
                },
                ExpiresIn=expiration
            )

            # 업로드 완료 후 파일 다운로드용 presigned URL (GET)
            file_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=3600 * 24 * 7  # 7일
            )

            logger.info(f"업로드용 Presigned URL 생성 완료: {s3_key}")

            return {
                'upload_url': upload_url,
                's3_key': s3_key,
                'file_url': file_url
            }

        except ClientError as e:
            logger.error(f"Presigned URL 생성 실패: {e}")
            raise

    def generate_presigned_download_url(
        self,
        s3_key: str,
        expiration: int = 3600
    ) -> str:
        """
        Presigned URL 생성 (다운로드용)

        Args:
            s3_key: S3에 저장된 파일 키
            expiration: URL 만료 시간(초)

        Returns:
            str: Presigned download URL
        """
        try:
            url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={
                    'Bucket': self.bucket_name,
                    'Key': s3_key
                },
                ExpiresIn=expiration
            )

            logger.info(f"다운로드용 Presigned URL 생성 완료: {s3_key}")
            return url

        except ClientError as e:
            logger.error(f"다운로드용 Presigned URL 생성 실패: {e}")
            raise

    def delete_file(self, s3_key: str) -> bool:
        """
        S3에서 파일 삭제

        Args:
            s3_key: 삭제할 파일의 S3 키

        Returns:
            bool: 성공 여부
        """
        try:
            self.s3_client.delete_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            logger.info(f"S3 파일 삭제 완료: {s3_key}")
            return True

        except ClientError as e:
            logger.error(f"S3 파일 삭제 실패: {e}")
            return False

    def file_exists(self, s3_key: str) -> bool:
        """
        S3에 파일이 존재하는지 확인

        Args:
            s3_key: 확인할 파일의 S3 키

        Returns:
            bool: 존재 여부
        """
        try:
            self.s3_client.head_object(
                Bucket=self.bucket_name,
                Key=s3_key
            )
            return True

        except ClientError:
            return False

    def download_file_to_temp(self, s3_key: str) -> str:
        """
        S3에서 파일을 임시 디렉토리로 다운로드

        Args:
            s3_key: 다운로드할 파일의 S3 키

        Returns:
            str: 로컬 임시 파일 경로
        """
        import tempfile

        try:
            # 임시 파일 생성
            file_extension = os.path.splitext(s3_key)[1]
            temp_file = tempfile.NamedTemporaryFile(
                suffix=file_extension,
                delete=False
            )
            temp_path = temp_file.name
            temp_file.close()

            # S3에서 다운로드
            self.s3_client.download_file(
                self.bucket_name,
                s3_key,
                temp_path
            )

            logger.info(f"S3에서 임시 파일로 다운로드 완료: {s3_key} -> {temp_path}")
            return temp_path

        except ClientError as e:
            logger.error(f"S3 파일 다운로드 실패: {e}")
            raise


@lru_cache(maxsize=1)
def get_s3_manager() -> S3Manager:
    """S3Manager 싱글톤 인스턴스 (지연 초기화)"""
    return S3Manager()
