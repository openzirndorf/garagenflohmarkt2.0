from app.nicknames import (
    ADJEKTIVE,
    NOMEN,
    generate_nickname,
    generate_unique_nickname,
    is_valid_nickname,
)


def test_generate_nickname_has_two_words():
    nickname = generate_nickname()
    parts = nickname.split(" ")
    assert len(parts) == 2
    assert parts[0] in ADJEKTIVE
    assert parts[1] in NOMEN


async def test_generate_unique_nickname_avoids_collision():
    seen = {generate_nickname()}

    async def exists(candidate: str) -> bool:
        return candidate in seen

    nickname = await generate_unique_nickname(exists)
    assert nickname not in seen


async def test_generate_unique_nickname_terminates_under_permanent_collision():
    async def always_exists(candidate: str) -> bool:
        return True

    nickname = await generate_unique_nickname(always_exists, max_attempts=3)
    assert nickname  # Fallback mit Zahlensuffix, aber kein Hänger/Exception


def test_is_valid_nickname_accepts_generated_combinations():
    assert is_valid_nickname(f"{ADJEKTIVE[0]} {NOMEN[0]}")


def test_is_valid_nickname_accepts_numeric_suffix_fallback():
    assert is_valid_nickname(f"{ADJEKTIVE[0]} {NOMEN[0]}-4213")


def test_is_valid_nickname_rejects_freetext():
    assert not is_valid_nickname("Max Mustermann")
    assert not is_valid_nickname(f"{ADJEKTIVE[0]} Mustermann")
    assert not is_valid_nickname("")
