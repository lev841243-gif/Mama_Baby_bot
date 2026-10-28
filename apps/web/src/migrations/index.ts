import * as migration_20261027_200019_init from './20261027_200019_init';
import * as migration_20261028_002952_step3_admin from './20261028_002952_step3_admin';
import * as migration_20261028_004353_step4_import_notes from './20261028_004353_step4_import_notes';
import * as migration_20261028_005153_step5_app from './20261028_005153_step5_app';
import * as migration_20261028_005916_step6_calm_music from './20261028_005916_step6_calm_music';
import * as migration_20261028_010000_seed_dictionaries from './20261028_010000_seed_dictionaries';

export const migrations = [
  {
    up: migration_20261027_200019_init.up,
    down: migration_20261027_200019_init.down,
    name: '20261027_200019_init',
  },
  {
    up: migration_20261028_002952_step3_admin.up,
    down: migration_20261028_002952_step3_admin.down,
    name: '20261028_002952_step3_admin',
  },
  {
    up: migration_20261028_004353_step4_import_notes.up,
    down: migration_20261028_004353_step4_import_notes.down,
    name: '20261028_004353_step4_import_notes',
  },
  {
    up: migration_20261028_005153_step5_app.up,
    down: migration_20261028_005153_step5_app.down,
    name: '20261028_005153_step5_app',
  },
  {
    up: migration_20261028_005916_step6_calm_music.up,
    down: migration_20261028_005916_step6_calm_music.down,
    name: '20261028_005916_step6_calm_music',
  },
  {
    up: migration_20261028_010000_seed_dictionaries.up,
    down: migration_20261028_010000_seed_dictionaries.down,
    name: '20261028_010000_seed_dictionaries'
  },
];
