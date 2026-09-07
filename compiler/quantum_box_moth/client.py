"""Origin-bound Moth client with explicit mutation approval and no POST retry."""

from __future__ import annotations

from dataclasses import dataclass
from email.utils import parsedate_to_datetime
import json
import os
import re
import time
from typing import Any, Dict, Mapping, Optional, Protocol
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .canonical import canonical_bytes, sha256_bytes
from .models import (
    AmbiguousMutationError,
    ContractError,
    EngineContract,
    MothApiError,
    MutationApproval,
    ResultGoneError,
    ResultNotReadyError,
    RetrievedResult,
    StatusSnapshot,
    SubmittedJob,
    UploadedAsset,
)


ALLOWED_ORIGIN = "https://api.mothquantum.com"
MAX_RESPONSE_BYTES = 16 * 1024 * 1024


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: Dict[str, str]
    body: bytes


class HttpTransport(Protocol):
    def request(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Optional[bytes],
        timeout: float,
    ) -> HttpResponse:
        ...


class _RejectRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class UrllibTransport:
    def __init__(self) -> None:
        self._opener = build_opener(_RejectRedirects())

    def request(
        self,
        method: str,
        url: str,
        headers: Mapping[str, str],
        body: Optional[bytes],
        timeout: float,
    ) -> HttpResponse:
        request = Request(url, data=body, headers=dict(headers), method=method)
        try:
            response = self._opener.open(request, timeout=timeout)
        except HTTPError as error:
            return HttpResponse(
                error.code,
                {key.lower(): value for key, value in error.headers.items()},
                error.read(MAX_RESPONSE_BYTES + 1),
            )
        with response:
            return HttpResponse(
                response.status,
                {key.lower(): value for key, value in response.headers.items()},
                response.read(MAX_RESPONSE_BYTES + 1),
            )


def _origin(value: str) -> str:
    parsed = urlsplit(value)
    if not parsed.scheme or not parsed.hostname or parsed.username or parsed.password:
        raise ContractError("URL", "must be an absolute origin")
    try:
        port = "" if parsed.port is None else ":{}".format(parsed.port)
    except ValueError:
        raise ContractError("URL", "contains an invalid port") from None
    return "{}://{}{}".format(parsed.scheme.lower(), parsed.hostname.lower(), port)


def _sanitize(value: Any, secret: str) -> str:
    text = value if isinstance(value, str) else ""
    if secret:
        text = text.replace(secret, "[REDACTED]")
    text = re.sub(r"(?i)bearer\s+[^\s,;]+", "Bearer [REDACTED]", text)
    text = re.sub(r"moth_[A-Za-z0-9._~-]+", "moth_[REDACTED]", text)
    text = re.sub(r"https?://[^\s\]\[<>'\"()]+", "[REDACTED_URL]", text)
    return text[:1000]


def _sanitize_metadata(value: Any, secret: str) -> Any:
    if isinstance(value, dict):
        sanitized: Dict[str, Any] = {}
        for key, item in value.items():
            rendered_key = str(key)
            lowered = rendered_key.lower()
            if any(
                marker in lowered
                for marker in (
                    "authorization",
                    "cookie",
                    "credential",
                    "password",
                    "secret",
                    "signature",
                    "signed",
                    "token",
                    "url",
                )
            ):
                sanitized[rendered_key] = "[REDACTED]"
            else:
                sanitized[rendered_key] = _sanitize_metadata(item, secret)
        return sanitized
    if isinstance(value, list):
        return [_sanitize_metadata(item, secret) for item in value]
    if isinstance(value, str):
        return _sanitize(value, secret)
    if value is None or isinstance(value, (bool, int, float)):
        return value
    return "[REDACTED_UNSUPPORTED_METADATA]"


class MothApiClient:
    def __init__(
        self,
        base_url: str,
        api_key: str,
        transport: Optional[HttpTransport] = None,
        timeout_seconds: float = 20.0,
        clock=time.time,
    ) -> None:
        parsed = urlsplit(base_url)
        if (
            _origin(base_url) != ALLOWED_ORIGIN
            or parsed.path not in ("", "/")
            or parsed.query
            or parsed.fragment
        ):
            raise ContractError(
                "MOTH_API_BASE_URL", "must be exactly {}".format(ALLOWED_ORIGIN)
            )
        if not api_key:
            raise ContractError(
                "MOTH_API_KEY", "must be present in the process environment"
            )
        if timeout_seconds <= 0:
            raise ContractError("timeout_seconds", "must be positive")
        self._base_url = ALLOWED_ORIGIN
        self._api_key = api_key
        self._transport = transport or UrllibTransport()
        self._timeout = float(timeout_seconds)
        self._clock = clock

    @classmethod
    def from_env(
        cls, transport: Optional[HttpTransport] = None
    ) -> "MothApiClient":
        return cls(
            os.environ.get("MOTH_API_BASE_URL", ""),
            os.environ.get("MOTH_API_KEY", ""),
            transport=transport,
        )

    def _api_url(self, path: str) -> str:
        if not path.startswith("/") or path.startswith("//"):
            raise ContractError("request path", "must be origin-relative")
        url = urljoin(self._base_url + "/", path.lstrip("/"))
        if _origin(url) != ALLOWED_ORIGIN:
            raise ContractError("request URL", "left the allowed API origin")
        return url

    def _send(
        self,
        method: str,
        url: str,
        body: Optional[bytes],
        *,
        authorized: bool,
        content_type: Optional[str] = None,
        exact_headers: Optional[Mapping[str, str]] = None,
    ) -> HttpResponse:
        if exact_headers is not None:
            headers = dict(exact_headers)
        else:
            headers = {
                "Accept": "application/json, application/problem+json",
                "User-Agent": "quantum-box-moth-acquisition/1",
            }
            if content_type is not None:
                headers["Content-Type"] = content_type
        if authorized:
            if _origin(url) != ALLOWED_ORIGIN:
                raise ContractError(
                    "authorization",
                    "refused to attach bearer authorization outside the Moth origin",
                )
            headers["Authorization"] = "Bearer {}".format(self._api_key)
        try:
            response = self._transport.request(
                method, url, headers, body, self._timeout
            )
        except (URLError, TimeoutError, OSError) as error:
            detail = _sanitize(
                str(getattr(error, "reason", error)), self._api_key
            ) or "transport failed without a safe detail"
            if method in ("POST", "PUT"):
                raise AmbiguousMutationError(
                    None, "Ambiguous mutation", detail
                ) from None
            raise MothApiError(None, "Transport error", detail) from None
        if len(response.body) > MAX_RESPONSE_BYTES:
            error_type = (
                AmbiguousMutationError
                if method in ("POST", "PUT")
                else MothApiError
            )
            raise error_type(
                response.status,
                (
                    "Ambiguous mutation"
                    if method in ("POST", "PUT")
                    else "Response too large"
                ),
                "body exceeded the local limit",
            )
        return response

    def _mutation_json(
        self, response: HttpResponse, expected_status: int
    ) -> Dict[str, Any]:
        """Decode a mutation response without making a retryable false negative.

        A malformed success response or any server-side failure can follow a
        mutation that actually reached durable provider state. Client-side
        rejections are the only response class treated as definite rejection.
        """

        try:
            return self._json(response, expected_status)
        except MothApiError as error:
            if response.status == expected_status or response.status >= 500:
                raise AmbiguousMutationError(
                    error.status,
                    "Ambiguous mutation",
                    error.detail,
                    error.retry_after_seconds,
                ) from None
            raise

    def _json(self, response: HttpResponse, expected_status: int) -> Dict[str, Any]:
        if response.status != expected_status:
            self._raise_problem(response)
        try:
            value = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise MothApiError(
                response.status,
                "Invalid response",
                "expected a UTF-8 JSON object",
            ) from None
        if not isinstance(value, dict):
            raise MothApiError(
                response.status, "Invalid response", "expected a JSON object"
            )
        return value

    def _raise_problem(self, response: HttpResponse) -> None:
        title = "Request failed"
        detail = "The API returned a non-success response."
        try:
            problem = json.loads(response.body.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            problem = None
        if isinstance(problem, dict):
            title = _sanitize(problem.get("title"), self._api_key) or title
            detail = _sanitize(problem.get("detail"), self._api_key) or detail
        retry_after = self._retry_after_seconds(response.headers)
        error_type = (
            ResultNotReadyError
            if response.status == 409
            else ResultGoneError
            if response.status == 410
            else MothApiError
        )
        raise error_type(response.status, title, detail, retry_after)

    def _retry_after_seconds(self, headers: Mapping[str, str]) -> Optional[float]:
        value = next(
            (item for key, item in headers.items() if key.lower() == "retry-after"),
            None,
        )
        if not value:
            return None
        try:
            return max(0.0, min(float(value), 30.0))
        except ValueError:
            try:
                parsed = parsedate_to_datetime(value)
                return max(0.0, min(parsed.timestamp() - self._clock(), 30.0))
            except (TypeError, ValueError, OverflowError):
                return None

    def me(self) -> Dict[str, Any]:
        return self._json(
            self._send("GET", self._api_url("/api/v1/me"), None, authorized=True),
            200,
        )

    def engines(self) -> Dict[str, Any]:
        return self._json(
            self._send(
                "GET", self._api_url("/api/v1/engines"), None, authorized=True
            ),
            200,
        )

    def engine(self, engine_id: str) -> Dict[str, Any]:
        return self._json(
            self._send(
                "GET",
                self._api_url(
                    "/api/v1/engines/{}".format(quote(engine_id, safe=""))
                ),
                None,
                authorized=True,
            ),
            200,
        )

    def submit(
        self,
        engine: EngineContract,
        request_body: Dict[str, Any],
        approval: MutationApproval,
    ) -> SubmittedJob:
        approval.validate(engine, request_body)
        response = self._send(
            "POST",
            self._api_url(
                "/api/v1/engines/{}/process".format(
                    quote(engine.engine_id, safe="")
                )
            ),
            canonical_bytes(request_body),
            authorized=True,
            content_type="application/json",
        )
        value = self._mutation_json(response, 202)
        required = ("job_id", "status", "submitted_at")
        missing = [
            key for key in required if not isinstance(value.get(key), str) or not value[key]
        ]
        if missing:
            raise AmbiguousMutationError(
                202,
                "Ambiguous mutation",
                "accepted response missing string fields: {}".format(
                    ", ".join(missing)
                ),
            )
        return SubmittedJob(value["job_id"], value["status"], value["submitted_at"])

    def upload_asset(
        self,
        engine: EngineContract,
        request_body: Dict[str, Any],
        approval: MutationApproval,
        *,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> UploadedAsset:
        approval.validate(engine, request_body)
        observed_sha256 = sha256_bytes(data)
        if approval.asset_sha256 != observed_sha256:
            raise ContractError(
                "approval.assetSha256", "does not match the selected upload bytes"
            )
        declaration = {
            "filename": filename,
            "content_type": content_type,
            "size_bytes": len(data),
        }
        created = self._json(
            self._send(
                "POST",
                self._api_url("/api/v1/assets"),
                canonical_bytes(declaration),
                authorized=True,
                content_type="application/json",
            ),
            201,
        )
        asset_id = created.get("asset_id")
        upload = created.get("upload")
        if not isinstance(asset_id, str) or not asset_id or not isinstance(upload, dict):
            raise ContractError("asset creation", "missing asset_id or upload record")
        upload_url = upload.get("url")
        upload_method = upload.get("method")
        upload_headers = upload.get("headers")
        if (
            not isinstance(upload_url, str)
            or urlsplit(upload_url).scheme != "https"
            or upload_method != "PUT"
            or not isinstance(upload_headers, dict)
            or not all(isinstance(key, str) and isinstance(value, str) for key, value in upload_headers.items())
        ):
            raise ContractError("asset upload", "presigned upload contract is invalid")
        uploaded = self._send(
            "PUT",
            upload_url,
            data,
            authorized=False,
            exact_headers=upload_headers,
        )
        if not 200 <= uploaded.status < 300:
            self._raise_problem(uploaded)
        completed = self._json(
            self._send(
                "POST",
                self._api_url(
                    "/api/v1/assets/{}/complete".format(quote(asset_id, safe=""))
                ),
                None,
                authorized=True,
            ),
            200,
        )
        if (
            completed.get("asset_id") != asset_id
            or completed.get("status") != "uploaded"
            or completed.get("content_type") != content_type
            or completed.get("size_bytes") != len(data)
        ):
            raise ContractError("asset completion", "completed asset does not match the upload")
        return UploadedAsset(asset_id, content_type, observed_sha256, len(data))

    def status(self, job_id: str) -> StatusSnapshot:
        value = self._json(
            self._send(
                "GET",
                self._api_url(
                    "/api/v1/jobs/{}/status".format(quote(job_id, safe=""))
                ),
                None,
                authorized=True,
            ),
            200,
        )
        required = ("job_id", "engine_id", "status", "submitted_at", "updated_at")
        missing = [
            key for key in required if not isinstance(value.get(key), str) or not value[key]
        ]
        if missing:
            raise ContractError(
                "job status", "missing string fields: {}".format(", ".join(missing))
            )
        if value["job_id"] != job_id:
            raise ContractError("job status.job_id", "does not match the requested job")
        return StatusSnapshot(
            job_id,
            value["engine_id"],
            value["status"],
            value["submitted_at"],
            value["updated_at"],
            value,
        )

    def result(self, job_id: str) -> RetrievedResult:
        value = self._json(
            self._send(
                "GET",
                self._api_url(
                    "/api/v1/jobs/{}/result".format(quote(job_id, safe=""))
                ),
                None,
                authorized=True,
            ),
            200,
        )
        output_asset_id = (
            value.get("output_asset_id")
            if isinstance(value.get("output_asset_id"), str)
            else None
        )
        content_type = (
            value.get("content_type")
            if isinstance(value.get("content_type"), str)
            else None
        )
        metadata = _sanitize_metadata(
            {key: item for key, item in value.items() if key not in ("result", "url")},
            self._api_key,
        )
        if "result" in value and value["result"] is not None:
            raw = canonical_bytes(value["result"])
            return RetrievedResult(
                "inline",
                raw,
                sha256_bytes(raw),
                content_type or "application/json",
                output_asset_id,
                metadata,
            )
        url = value.get("url")
        if isinstance(url, str) and url:
            if urlsplit(url).scheme != "https":
                raise ContractError("job result.url", "must use HTTPS")
            response = self._send(
                "GET", url, None, authorized=False, exact_headers={}
            )
            if response.status != 200:
                self._raise_problem(response)
            return RetrievedResult(
                "output-asset",
                response.body,
                sha256_bytes(response.body),
                content_type,
                output_asset_id,
                metadata,
            )
        raise ContractError(
            "job result", "contains neither an inline result nor an output asset URL"
        )
