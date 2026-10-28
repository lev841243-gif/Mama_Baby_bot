import * as migration_20261027_200019_init from './20261027_200019_init';
import * as migration_20261028_002952_step3_admin from './20261028_002952_step3_admin';
import * as migration_20261028_004353_step4_import_notes from './20261028_004353_step4_import_notes';
import * as migration_20261028_005153_step5_app from './20261028_005153_step5_app';
import * as migration_20261028_005916_step6_calm_music from './20261028_005916_step6_calm_music';
import * as migration_20261028_010000_seed_dictionaries from './20261028_010000_seed_dictionaries';
import * as migration_20261028_010517_step7_search from './20261028_010517_step7_search';
import * as migration_20261028_010520_step7_drop_search_soon from './20261028_010520_step7_drop_search_soon';
import * as migration_20261028_011106_step8_subscription from './20261028_011106_step8_subscription';

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
    name: '20261028_010000_seed_dictionaries',
  },
  {
    up: migration_20261028_010517_step7_search.up,
    down: migration_20261028_010517_step7_search.down,
    name: '20261028_010517_step7_search',
  },
  {
    up: migration_20261028_010520_step7_drop_search_soon.up,
    down: migration_20261028_010520_step7_drop_search_soon.down,
    name: '20261028_010520_step7_drop_search_soon',
  },
  {
    up: migration_20261028_011106_step8_subscription.up,
    down: migration_20261028_011106_step8_subscription.down,
    name: '20261028_011106_step8_subscription'
  },
];
