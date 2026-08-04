from app.moderation import contains_blocked_content


def test_detects_word_term_case_insensitively():
    assert contains_blocked_content("Verkaufe NAZI-Devotionalien") is True


def test_does_not_false_positive_on_partial_word_match():
    # "Sieger" enthält "sieg" als Teilstring, ist aber kein Treffer -
    # Wortgrenzen-Matching verhindert das.
    assert contains_blocked_content("Ich bin stolzer Sieger im Kreuzworträtsel") is False


def test_numeric_code_only_checked_when_explicitly_enabled():
    assert contains_blocked_content("Hausnummer 88", check_numeric_codes=False) is False
    assert contains_blocked_content("Hausnummer 88", check_numeric_codes=True) is True


def test_numeric_code_does_not_match_inside_longer_number():
    assert contains_blocked_content("Baujahr 1988", check_numeric_codes=True) is False


def test_none_and_empty_text_are_never_blocked():
    assert contains_blocked_content(None) is False
    assert contains_blocked_content("") is False


def test_harmless_description_passes():
    assert contains_blocked_content("Gut erhaltene Kinderkleidung, Größe 86-116") is False
