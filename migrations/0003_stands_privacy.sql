-- Datenschutz-Umbau: Klarname raus, serverseitig generierter Nickname rein;
-- echte Magic-Links statt eines permanenten edit_token. Zugriff auf den
-- eigenen Stand gibt es nur noch über einen frisch angeforderten,
-- kurzlebigen Login-Link (login_token) - der wird gegen ein kurzlebiges
-- Session-Token (session_token) eingetauscht, das für die Dauer der
-- Bearbeitung gilt. Nichts davon ist dauerhaft oder wird je an den Client
-- zurückgegeben, außer per E-Mail-Link.

ALTER TABLE stands RENAME COLUMN name TO nickname;

-- Ein Stand pro E-Mail-Adresse - E-Mail ist die einzige Login-Identität.
ALTER TABLE stands ADD CONSTRAINT stands_email_unique UNIQUE (email);

-- login_token: einmalig verwendbar, befristet. Wird sowohl bei der
-- Registrierung (Aktivierungslink) als auch bei jeder späteren
-- "Zugang anfordern"-Anfrage neu erzeugt (überschreibt den alten).
ALTER TABLE stands ADD COLUMN login_token_hash TEXT;
ALTER TABLE stands ADD COLUMN login_token_expires_at TIMESTAMPTZ;

-- session_token: nach Klick auf den Login-Link ausgestellt, mehrfach
-- verwendbar innerhalb seiner (kurzen) Gültigkeit - das ist der einzige
-- Nachweis, mit dem der eigene Stand bearbeitet werden kann.
ALTER TABLE stands ADD COLUMN session_token_hash TEXT;
ALTER TABLE stands ADD COLUMN session_token_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX stands_nickname_idx ON stands(nickname);
CREATE UNIQUE INDEX stands_login_token_hash_idx ON stands(login_token_hash)
  WHERE login_token_hash IS NOT NULL;
CREATE UNIQUE INDEX stands_session_token_hash_idx ON stands(session_token_hash)
  WHERE session_token_hash IS NOT NULL;
