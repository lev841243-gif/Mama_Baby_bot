import * as migration_20261027_200019_init from './20261027_200019_init';
import * as migration_20261028_002952_step3_admin from './20261028_002952_step3_admin';
import * as migration_20261028_004353_step4_import_notes from './20261028_004353_step4_import_notes';
import * as migration_20261028_005153_step5_app from './20261028_005153_step5_app';
import * as migration_20261028_005916_step6_calm_music from './20261028_005916_step6_calm_music';
import * as migration_20261028_010000_seed_dictionaries from './20261028_010000_seed_dictionaries';
import * as migration_20261028_010517_step7_search from './20261028_010517_step7_search';
import * as migration_20261028_010520_step7_drop_search_soon from './20261028_010520_step7_drop_search_soon';
import * as migration_20261028_011106_step8_subscription from './20261028_011106_step8_subscription';
import * as migration_20261028_011917_step9_channel from './20261028_011917_step9_channel';
import * as migration_20261028_063943_step2_settings from './20261028_063943_step2_settings';
import * as migration_20261028_064707_step2_feed_texts from './20261028_064707_step2_feed_texts';
import * as migration_20261028_070121_step2_calendar from './20261028_070121_step2_calendar';
import * as migration_20261028_070655_step2_calendar_cleared from './20261028_070655_step2_calendar_cleared';
import * as migration_20261028_094313_step2_retention from './20261028_094313_step2_retention';
import * as migration_20261028_095330_step2_calendar_on from './20261028_095330_step2_calendar_on';
import * as migration_20261028_123146_etap3_how_moms_ask from './20261028_123146_etap3_how_moms_ask';
import * as migration_20261028_123934_etap3_search_settings from './20261028_123934_etap3_search_settings';
import * as migration_20261028_130146_etap3_search_checks from './20261028_130146_etap3_search_checks';

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
    name: '20261028_011106_step8_subscription',
  },
  {
    up: migration_20261028_011917_step9_channel.up,
    down: migration_20261028_011917_step9_channel.down,
    name: '20261028_011917_step9_channel',
  },
  {
    up: migration_20261028_063943_step2_settings.up,
    down: migration_20261028_063943_step2_settings.down,
    name: '20261028_063943_step2_settings',
  },
  {
    up: migration_20261028_064707_step2_feed_texts.up,
    down: migration_20261028_064707_step2_feed_texts.down,
    name: '20261028_064707_step2_feed_texts',
  },
  {
    up: migration_20261028_070121_step2_calendar.up,
    down: migration_20261028_070121_step2_calendar.down,
    name: '20261028_070121_step2_calendar',
  },
  {
    up: migration_20261028_070655_step2_calendar_cleared.up,
    down: migration_20261028_070655_step2_calendar_cleared.down,
    name: '20261028_070655_step2_calendar_cleared',
  },
  {
    up: migration_20261028_094313_step2_retention.up,
    down: migration_20261028_094313_step2_retention.down,
    name: '20261028_094313_step2_retention',
  },
  {
    up: migration_20261028_095330_step2_calendar_on.up,
    down: migration_20261028_095330_step2_calendar_on.down,
    name: '20261028_095330_step2_calendar_on',
  },
  {
    up: migration_20261028_123146_etap3_how_moms_ask.up,
    down: migration_20261028_123146_etap3_how_moms_ask.down,
    name: '20261028_123146_etap3_how_moms_ask',
  },
  {
    up: migration_20261028_123934_etap3_search_settings.up,
    down: migration_20261028_123934_etap3_search_settings.down,
    name: '20261028_123934_etap3_search_settings',
  },
  {
    up: migration_20261028_130146_etap3_search_checks.up,
    down: migration_20261028_130146_etap3_search_checks.down,
    name: '20261028_130146_etap3_search_checks'
  },
];
