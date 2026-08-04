from datetime import UTC, datetime

from app.tokens import (
    CODE_LENGTH,
    LOGIN_REQUEST_TTL,
    generate_code,
    generate_token,
    hash_token,
    new_login_code,
    new_session_token,
    normalize_code,
    token_matches,
)


def test_hash_is_not_plaintext():
    token = generate_token()
    token_hash = hash_token(token)
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


def test_session_token_has_expiry_in_the_future():
    _, _, expires_at = new_session_token()
    assert expires_at > datetime.now(UTC)


def test_tokens_are_unique():
    token_a = generate_token()
    token_b = generate_token()
    assert token_a != token_b


def test_generate_code_has_expected_length():
    assert len(generate_code()) == CODE_LENGTH


def test_generate_code_excludes_ambiguous_characters():
    for _ in range(200):
        code = generate_code()
        assert not any(c in code for c in "0O1IL")


def test_generate_code_is_uppercase():
    code = generate_code()
    assert code == code.upper()


def test_new_login_code_has_expiry_in_the_future():
    code, code_hash, expires_at = new_login_code(LOGIN_REQUEST_TTL)
    assert expires_at > datetime.now(UTC)
    assert code_hash == hash_token(code)


def test_normalize_code_strips_and_uppercases():
    assert normalize_code(" ab3d 9f2k ") == "AB3D9F2K"


def test_normalized_code_still_matches_its_hash():
    code, code_hash, _ = new_login_code(LOGIN_REQUEST_TTL)
    assert token_matches(normalize_code(code.lower()), code_hash) is True
