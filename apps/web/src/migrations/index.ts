import * as migration_20261027_200019_init from './20261027_200019_init';

export const migrations = [
  {
    up: migration_20261027_200019_init.up,
    down: migration_20261027_200019_init.down,
    name: '20261027_200019_init'
  },
];
