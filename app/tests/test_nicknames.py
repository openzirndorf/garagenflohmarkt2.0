from app.nicknames import ADJEKTIVE, NOMEN, generate_nickname, generate_unique_nickname


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
