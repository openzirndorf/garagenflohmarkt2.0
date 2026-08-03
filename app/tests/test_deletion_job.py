from datetime import datetime

from scripts import deletion_job


async def _seed_stand(pool, email="lösch-test@example.com"):
    await pool.execute(
        "INSERT INTO stands (nickname, adresse, email) VALUES ($1, $2, $3)",
        "Gscheide Testwurst", "Musterstraße 1, Zirndorf", email,
    )


async def test_noop_before_cutoff(pool, monkeypatch):
    await _seed_stand(pool)
    purge_calls = []
    monkeypatch.setattr(deletion_job, "purge_all_stand_objects", lambda: purge_calls.append(1) or 0)

    before_cutoff = datetime(2026, 9, 1, tzinfo=deletion_job.TIMEZONE)
    await deletion_job.run(now=before_cutoff)

    count = await pool.fetchval("SELECT count(*) FROM stands")
    assert count == 1
    assert purge_calls == []


async def test_deletes_everything_on_or_after_cutoff(pool, monkeypatch):
    await _seed_stand(pool)
    purge_calls = []
    monkeypatch.setattr(deletion_job, "purge_all_stand_objects", lambda: purge_calls.append(1) or 3)

    on_cutoff = datetime(2026, 10, 7, 0, 0, tzinfo=deletion_job.TIMEZONE)
    await deletion_job.run(now=on_cutoff)

    count = await pool.fetchval("SELECT count(*) FROM stands")
    assert count == 0
    assert purge_calls == [1]


async def test_idempotent_when_run_again_after_already_empty(pool, monkeypatch):
    monkeypatch.setattr(deletion_job, "purge_all_stand_objects", lambda: 0)

    after_cutoff = datetime(2026, 10, 8, tzinfo=deletion_job.TIMEZONE)
    await deletion_job.run(now=after_cutoff)  # Tabelle ist schon leer
    count = await pool.fetchval("SELECT count(*) FROM stands")
    assert count == 0


async def test_never_logs_email_or_nickname(pool, monkeypatch, caplog):
    import logging

    caplog.set_level(logging.INFO)
    await _seed_stand(pool, email="darf-nicht-im-log@example.com")
    monkeypatch.setattr(deletion_job, "purge_all_stand_objects", lambda: 0)

    await deletion_job.run(now=datetime(2026, 10, 7, tzinfo=deletion_job.TIMEZONE))

    log_text = "\n".join(r.getMessage() for r in caplog.records)
    assert "darf-nicht-im-log@example.com" not in log_text
    assert "Gscheide Testwurst" not in log_text
