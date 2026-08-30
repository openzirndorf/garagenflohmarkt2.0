from app.identifiers import generate_unique_identifier


async def test_generate_unique_identifier_uses_address_when_free():
    async def never_exists(candidate: str) -> bool:
        return False

    identifier = await generate_unique_identifier("Musterstraße 1, Zirndorf", never_exists)
    assert identifier == "Musterstraße 1, Zirndorf"


async def test_generate_unique_identifier_appends_counter_on_collision():
    taken = {"Musterstraße 1, Zirndorf"}

    async def exists(candidate: str) -> bool:
        return candidate in taken

    identifier = await generate_unique_identifier("Musterstraße 1, Zirndorf", exists)
    assert identifier == "Musterstraße 1, Zirndorf #2"


async def test_generate_unique_identifier_keeps_counting_up():
    taken = {"Musterstraße 1, Zirndorf", "Musterstraße 1, Zirndorf #2", "Musterstraße 1, Zirndorf #3"}

    async def exists(candidate: str) -> bool:
        return candidate in taken

    identifier = await generate_unique_identifier("Musterstraße 1, Zirndorf", exists)
    assert identifier == "Musterstraße 1, Zirndorf #4"


async def test_generate_unique_identifier_terminates_under_permanent_collision():
    async def always_exists(candidate: str) -> bool:
        return True

    identifier = await generate_unique_identifier(
        "Musterstraße 1, Zirndorf", always_exists, max_attempts=3
    )
    assert identifier.startswith("Musterstraße 1, Zirndorf #")  # Fallback mit Zufallssuffix
