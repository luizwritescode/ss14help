DROP TABLE IF EXISTS config;
DROP TABLE IF EXISTS app_data;

CREATE TABLE config (
	id INTEGER PRIMARY KEY,
	last_update INTEGER NOT NULL
);

INSERT INTO config (last_update) VALUES (-1);

CREATE TRIGGER config_no_insert
BEFORE INSERT ON config
WHEN (SELECT COUNT(*) FROM config) >= 1
BEGIN
	SELECT RAISE(FAIL, 'only one row!');
END;