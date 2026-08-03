from datetime import UTC, datetime

from app.tokens import (
    LOGIN_REQUEST_TTL,
    hash_token,
    new_login_token,
    new_session_token,
    token_matches,
)


def test_hash_is_not_plaintext():
    token, token_hash, _ = new_login_token(LOGIN_REQUEST_TTL)
    assert token_hash != token
    assert token not in token_hash


def test_hash_is_deterministic():
    assert hash_token("same-input") == hash_token("same-input")


def test_token_matches_correct_token():
    token, token_hash, _ = new_session_token()
    assert token_matches(token, token_hash) is True


def test_token_matches_rejects_wrong_token():
    _, token_hash, _ = new_session_token()
    assert token_matches("falsches-token", token_hash) is False


def test_login_token_has_expiry_in_the_future():
    _, _, expires_at = new_login_token(LOGIN_REQUEST_TTL)
    assert expires_at > datetime.now(UTC)


def test_session_token_has_expiry_in_the_future():
    _, _, expires_at = new_session_token()
    assert expires_at > datetime.now(UTC)


def test_tokens_are_unique():
    token_a, _, _ = new_login_token(LOGIN_REQUEST_TTL)
    token_b, _, _ = new_login_token(LOGIN_REQUEST_TTL)
    assert token_a != token_b
