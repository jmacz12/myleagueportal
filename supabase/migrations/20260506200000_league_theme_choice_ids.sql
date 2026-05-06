-- Map legacy preset-1..5 + appearance to five canonical theme ids: classic, bold, soft, bright, midnight.

UPDATE organizations
SET
  league_appearance_mode = 'dark',
  league_theme_preset = 'midnight'
WHERE coalesce(league_theme_preset, '') = 'preset-1'
  AND coalesce(lower(league_appearance_mode), 'light') = 'dark';

UPDATE organizations
SET
  league_appearance_mode = 'light',
  league_theme_preset = 'classic'
WHERE coalesce(league_theme_preset, '') = 'preset-1';

UPDATE organizations
SET
  league_theme_preset = 'bright',
  league_appearance_mode = 'light'
WHERE coalesce(league_theme_preset, '') = 'preset-2';

UPDATE organizations
SET
  league_theme_preset = 'bold',
  league_appearance_mode = 'light'
WHERE coalesce(league_theme_preset, '') IN ('preset-3', 'preset-4');

UPDATE organizations
SET
  league_theme_preset = 'soft',
  league_appearance_mode = 'light'
WHERE coalesce(league_theme_preset, '') = 'preset-5';
